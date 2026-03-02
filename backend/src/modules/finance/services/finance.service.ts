import { 
  Injectable, 
  BadRequestException, 
  NotFoundException, 
  ForbiddenException 
} from '@nestjs/common';
import { FinanceRepository } from '../repositories/finance.repository';
import { PrismaService } from '../../../database/prisma.service';
import { TransactionType } from '@prisma/client';
import { ActiveUserData } from '@common/decorators/active-user.decorator';
import { CreateManualTransactionDto } from '../dto/create-manual-transaction.dto'; // Pastikan DTO ini ada

@Injectable()
export class FinanceService {
  constructor(
    private readonly financeRepo: FinanceRepository,
    private readonly prisma: PrismaService, // Dibutuhkan untuk memulai $transaction
  ) {}

  // ==========================================
  // 1. CEK INFORMASI DOMPET
  // ==========================================
  async getWalletDetails(communityGroupId: number) {
    const wallet = await this.financeRepo.findWalletByGroupId(communityGroupId);
    if (!wallet) throw new NotFoundException('Dompet digital belum diaktifkan untuk lingkungan ini');
    return wallet;
  }

  async getTransactionHistory(communityGroupId: number) {
    return this.financeRepo.findTransactions(communityGroupId);
  }

  // ==========================================
  // 2. TRANSAKSI MANUAL (Bendahara Input Kas Tunai/Belanja)
  // ==========================================
  async createManualTransaction(dto: CreateManualTransactionDto, user: ActiveUserData) {
    // Ambil info wallet
    const wallet = await this.getWalletDetails(user.communityGroupId);

    // Validasi Saldo (Hanya jika uang keluar/DEBIT)
    if (dto.type === TransactionType.DEBIT && Number(wallet.balance) < dto.amount) {
      throw new BadRequestException('Saldo kas tidak mencukupi untuk transaksi ini');
    }

    // Eksekusi Atomic Transaction
    return this.prisma.$transaction(async (tx) => {
      // A. Update Saldo
      await this.financeRepo.updateWalletBalance(tx, wallet.id, dto.amount, dto.type);

      // B. Catat Log
      return this.financeRepo.createTransactionRecord(tx, {
        walletId: wallet.id,
        amount: dto.amount,
        type: dto.type,
        description: `[MANUAL] ${dto.description}`,
        createdById: user.id, // Track siapa bendaharanya
      });
    });
  }

  // ==========================================
  // 3. SYSTEM DEPOSIT (Untuk Split Bill Iuran / Midtrans)
  // ==========================================
  // Fungsi ini dipanggil oleh DuesService/PaymentService saat ada uang masuk otomatis
  async processSystemDeposit(communityGroupId: number, amount: number, description: string) {
    const wallet = await this.financeRepo.findWalletByGroupId(communityGroupId);
    if (!wallet) return; // Silent fail or log error

    await this.prisma.$transaction(async (tx) => {
      // A. Tambah Saldo (CREDIT)
      await this.financeRepo.updateWalletBalance(tx, wallet.id, amount, TransactionType.CREDIT);
      
      // B. Catat Log
      await this.financeRepo.createTransactionRecord(tx, {
        walletId: wallet.id,
        amount: amount,
        type: TransactionType.CREDIT,
        description: `[SYSTEM] ${description}`,
      });
    });
  }

  // ==========================================
  // 4. PENCAIRAN DANA EVENT (Integrasi Events Module)
  // ==========================================
  // Dipanggil saat Event statusnya menjadi FUNDED
  async disburseEventFund(communityGroupId: number, amount: number, eventId: string) {
    const wallet = await this.getWalletDetails(communityGroupId);

    if (Number(wallet.balance) < amount) {
      throw new BadRequestException('Gagal mencairkan dana event: Saldo Kas tidak mencukupi.');
    }

    await this.prisma.$transaction(async (tx) => {
      // A. Kurangi Saldo (DEBIT)
      await this.financeRepo.updateWalletBalance(tx, wallet.id, amount, TransactionType.DEBIT);
      
      // B. Catat Log
      await this.financeRepo.createTransactionRecord(tx, {
        walletId: wallet.id,
        amount: amount,
        type: TransactionType.DEBIT,
        description: `Pencairan dana kegiatan operasional`,
        eventId: eventId
      });
    });
  }

  // ==========================================
  // 5. PENGEMBALIAN DANA EVENT (Refund/Settlement)
  // ==========================================
  // Dipanggil saat Event SETTLED (Sisa uang) atau CANCELLED (Full refund)
  async refundEventFund(communityGroupId: number, amount: number, eventId: string, reason: string) {
    const wallet = await this.getWalletDetails(communityGroupId);

    await this.prisma.$transaction(async (tx) => {
      // A. Tambah Saldo (CREDIT)
      await this.financeRepo.updateWalletBalance(tx, wallet.id, amount, TransactionType.CREDIT);
      
      // B. Catat Log
      await this.financeRepo.createTransactionRecord(tx, {
        walletId: wallet.id,
        amount: amount,
        type: TransactionType.CREDIT,
        description: `Pengembalian dana: ${reason}`,
        eventId: eventId
      });
    });
  }

  // ==========================================
  // 6. TRANSFER ANTAR GRUP (RT ke RW atau sebaliknya)
  // ==========================================
  // Dipanggil saat FundRequest disetujui (tanpa event)
  async transferInterGroup(sourceGroupId: number, targetGroupId: number, amount: number, description: string) {
    const sourceWallet = await this.getWalletDetails(sourceGroupId);
    const targetWallet = await this.getWalletDetails(targetGroupId);

    if (Number(sourceWallet.balance) < amount) {
      throw new BadRequestException(`Gagal transfer: Saldo ${sourceWallet.communityGroup.name} tidak mencukupi.`);
    }

    await this.prisma.$transaction(async (tx) => {
      // 1. Potong saldo Pengirim (DEBIT)
      await this.financeRepo.updateWalletBalance(tx, sourceWallet.id, amount, TransactionType.DEBIT);
      await this.financeRepo.createTransactionRecord(tx, {
        walletId: sourceWallet.id,
        amount: amount,
        type: TransactionType.DEBIT,
        description: `Transfer Keluar ke ${targetWallet.communityGroup.name}: ${description}`,
      });

      // 2. Tambah saldo Penerima (CREDIT)
      await this.financeRepo.updateWalletBalance(tx, targetWallet.id, amount, TransactionType.CREDIT);
      await this.financeRepo.createTransactionRecord(tx, {
        walletId: targetWallet.id,
        amount: amount,
        type: TransactionType.CREDIT,
        description: `Transfer Masuk dari ${sourceWallet.communityGroup.name}: ${description}`,
      });
    });
  }

  // ==========================================
  // 7. TRANSFER ANTAR GRUP + LANGSUNG CAIR KE EVENT
  // ==========================================
  // Dipanggil saat FundRequest EVENT disetujui:
  // RW DEBIT → uang masuk ke kas RT (ditag eventId) → langsung DEBIT lagi ke event
  // Net effect pada kas RT = 0; event mendapat tambahan dana
  async transferAndDisburseForEvent(
    sourceGroupId: number, // RW
    targetGroupId: number, // RT
    amount: number,
    description: string,
    eventId: string,
  ) {
    const sourceWallet = await this.getWalletDetails(sourceGroupId);
    const targetWallet = await this.getWalletDetails(targetGroupId);

    if (Number(sourceWallet.balance) < amount) {
      throw new BadRequestException(
        `Gagal transfer: Saldo ${sourceWallet.communityGroup.name} tidak mencukupi.`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // 1. Potong saldo RW (DEBIT) — transfer keluar
      await this.financeRepo.updateWalletBalance(tx, sourceWallet.id, amount, TransactionType.DEBIT);
      await this.financeRepo.createTransactionRecord(tx, {
        walletId: sourceWallet.id,
        amount,
        type: TransactionType.DEBIT,
        description: `Transfer Keluar ke ${targetWallet.communityGroup.name}: ${description}`,
        eventId,
      });

      // 2. Catat penerimaan di kas RT (CREDIT, ditag eventId) — untuk jejak audit
      await this.financeRepo.updateWalletBalance(tx, targetWallet.id, amount, TransactionType.CREDIT);
      await this.financeRepo.createTransactionRecord(tx, {
        walletId: targetWallet.id,
        amount,
        type: TransactionType.CREDIT,
        description: `Dana Tambahan Diterima dari ${sourceWallet.communityGroup.name}: ${description}`,
        eventId,
      });

      // 3. Langsung cair ke event dari kas RT (DEBIT, ditag eventId)
      // Net kas RT = 0; uang masuk langsung dialokasikan ke acara
      await this.financeRepo.updateWalletBalance(tx, targetWallet.id, amount, TransactionType.DEBIT);
      await this.financeRepo.createTransactionRecord(tx, {
        walletId: targetWallet.id,
        amount,
        type: TransactionType.DEBIT,
        description: `Pencairan Dana Tambahan untuk Acara: ${description}`,
        eventId,
      });
    });
  }

  // A. Ambil Saldo RT dan RW sekaligus
  async getTransparencyBalance(user: ActiveUserData) {
    // 1. Ambil info Group User (RT) dan Parent-nya (RW)
    const userGroup = await this.prisma.communityGroup.findUnique({
      where: { id: user.communityGroupId },
      include: { 
        wallet: true, // Dompet RT
        parent: {     // Group RW (Parent)
          include: { wallet: true } // Dompet RW
        } 
      }
    });

    if (!userGroup) throw new NotFoundException('Data lingkungan tidak ditemukan');

    // 2. Format Data untuk Frontend
    return {
      rt: {
        groupName: userGroup.name,
        balance: userGroup.wallet ? Number(userGroup.wallet.balance) : 0,
        lastUpdated: userGroup.wallet?.updatedAt || null
      },
      rw: userGroup.parent ? {
        groupName: userGroup.parent.name,
        balance: userGroup.parent.wallet ? Number(userGroup.parent.wallet.balance) : 0,
        lastUpdated: userGroup.parent.wallet?.updatedAt || null
      } : null // Jika tidak ada RW (misal user tinggal di komplek tanpa RW)
    };
  }

  // B. Ambil Riwayat Transaksi (Bisa pilih mau lihat RT atau RW)
  async getTransparencyHistory(user: ActiveUserData, scope: 'RT' | 'RW') {
    const userGroup = await this.prisma.communityGroup.findUnique({
      where: { id: user.communityGroupId },
      select: { type: true, parentId: true }
    });

    if (!userGroup) throw new NotFoundException('Data grup tidak ditemukan');

    let targetGroupId = user.communityGroupId;

    // Logika penentuan target ID yang aman
    if (scope === 'RW') {
      if (userGroup.type === 'RW') {
        // Jika user memang RW, targetnya ya grup dia sendiri
        targetGroupId = user.communityGroupId; 
      } else if (userGroup.parentId) {
        // Jika user adalah RT, targetnya adalah Parent (RW)
        targetGroupId = userGroup.parentId;
      } else {
        throw new BadRequestException('Lingkungan Anda tidak terdaftar dalam RW manapun');
      }
    } else {
      // Jika scope === 'RT'
      if (userGroup.type === 'RW') {
        // Jika RW mau lihat RT spesifik, biasanya butuh param ID RT-nya. 
        // Tapi untuk default (warga/admin RT), biarkan pakai grup sendiri
        targetGroupId = user.communityGroupId;
      }
    }

    // Ambil data mentah dari repo
    const rawTransactions = await this.financeRepo.findTransactions(targetGroupId);

    // FIX DECIMAL: Map/Format data agar angka Decimal berubah jadi Number biasa
    return rawTransactions.map((tx) => ({
      id: tx.id,
      type: tx.type, // 'INCOME' | 'EXPENSE'
      amount: Number(tx.amount), // <--- INI KUNCI UTAMANYA
      description: tx.description,
      createdAt: tx.createdAt,
      
      // Ambil relasi (optional chaining untuk menghindari error jika null)
      eventName: tx.event?.title || null,
      adminName: tx.createdBy?.fullName || 'Sistem',
      
      // Payment Gateway info (jika transaksi berasal dari Midtrans)
      paymentGatewayTx: tx.paymentGatewayTx ? {
        id: tx.paymentGatewayTx.id,
        orderId: tx.paymentGatewayTx.orderId,
        status: tx.paymentGatewayTx.status,
        methodCategory: tx.paymentGatewayTx.methodCategory,
        providerCode: tx.paymentGatewayTx.providerCode,
        amount: Number(tx.paymentGatewayTx.amount),
        paidAt: tx.paymentGatewayTx.paidAt,
      } : null,
    }));
  }

  // ==========================================
  // 7. CHILDREN WALLETS (Saldo semua RT/anak)
  // ==========================================
  async getChildrenWallets(user: ActiveUserData) {
    // Determine the RW group ID
    let rwGroupId: number;

    const userGroup = await this.prisma.communityGroup.findUnique({
      where: { id: user.communityGroupId },
      select: { type: true, parentId: true },
    });

    if (!userGroup) throw new NotFoundException('Data lingkungan tidak ditemukan');

    if (userGroup.type === 'RW') {
      rwGroupId = user.communityGroupId;
    } else if (userGroup.parentId) {
      rwGroupId = userGroup.parentId;
    } else {
      throw new NotFoundException('Tidak ditemukan hierarki RW');
    }

    const data = await this.financeRepo.findChildrenWallets(rwGroupId);
    if (!data) throw new NotFoundException('Data RW tidak ditemukan');

    return {
      rw: {
        id: data.id,
        name: data.name,
        balance: data.wallet ? Number(data.wallet.balance) : 0,
      },
      children: data.children.map((child) => {
        const admin = child.users.find((u) => u.role.type === 'ADMIN');
        const treasurer = child.users.find((u) => u.role.type === 'TREASURER');
        return {
          group: { id: child.id, name: child.name, type: child.type },
          balance: child.wallet ? Number(child.wallet.balance) : 0,
          memberCount: child._count.users,
          admin: admin ? { id: admin.id, fullName: admin.fullName } : null,
          treasurer: treasurer ? { id: treasurer.id, fullName: treasurer.fullName } : null,
          duesRule: child.duesRule
            ? { amount: Number(child.duesRule.amount), dueDay: child.duesRule.dueDay, isActive: child.duesRule.isActive }
            : null,
          walletUpdatedAt: child.wallet?.updatedAt || null,
        };
      }),
    };
  }

  // ==========================================
  // 8. GROUP FINANCE DETAIL (Detail keuangan 1 grup)
  // ==========================================
  async getGroupFinanceDetail(groupId: number, user: ActiveUserData) {
    // Security: user must be LEADER of parent, or member of same parent, or member of that group
    const userGroup = await this.prisma.communityGroup.findUnique({
      where: { id: user.communityGroupId },
      select: { type: true, parentId: true },
    });

    const targetGroup = await this.prisma.communityGroup.findUnique({
      where: { id: groupId },
      select: { parentId: true },
    });

    if (!userGroup || !targetGroup) throw new NotFoundException('Data lingkungan tidak ditemukan');

    // LEADER can see any child group
    const isLeaderOfParent = userGroup.type === 'RW' && targetGroup.parentId === user.communityGroupId;
    // ADMIN/TREASURER can see sibling groups (same parent) or own group
    const isSibling = userGroup.parentId && userGroup.parentId === targetGroup.parentId;
    const isOwnGroup = user.communityGroupId === groupId;

    if (!isLeaderOfParent && !isSibling && !isOwnGroup) {
      throw new ForbiddenException('Anda tidak memiliki akses ke data keuangan lingkungan ini');
    }

    const group = await this.financeRepo.findGroupFinanceDetail(groupId);
    if (!group) throw new NotFoundException('Data lingkungan tidak ditemukan');

    const transactions = await this.financeRepo.findTransactions(groupId);

    const admin = group.users.find((u) => u.role.type === 'ADMIN');
    const treasurer = group.users.find((u) => u.role.type === 'TREASURER');

    return {
      group: {
        id: group.id,
        name: group.name,
        type: group.type,
        parent: group.parent,
        memberCount: group._count.users,
      },
      admin: admin ? { id: admin.id, fullName: admin.fullName, email: admin.email, phone: admin.phone } : null,
      treasurer: treasurer ? { id: treasurer.id, fullName: treasurer.fullName, email: treasurer.email, phone: treasurer.phone } : null,
      wallet: group.wallet
        ? { id: group.wallet.id, balance: Number(group.wallet.balance), updatedAt: group.wallet.updatedAt }
        : null,
      duesRule: group.duesRule
        ? {
            id: group.duesRule.id,
            amount: Number(group.duesRule.amount),
            dueDay: group.duesRule.dueDay,
            isActive: group.duesRule.isActive,
            updatedAt: group.duesRule.updatedAt,
          }
        : null,
      transactions: transactions.map((tx) => ({
        id: tx.id,
        amount: Number(tx.amount),
        type: tx.type,
        description: tx.description,
        createdAt: tx.createdAt,
        createdBy: tx.createdBy?.fullName || null,
        event: tx.event?.title || null,
        paymentGatewayTx: tx.paymentGatewayTx ? {
          id: tx.paymentGatewayTx.id,
          orderId: tx.paymentGatewayTx.orderId,
          status: tx.paymentGatewayTx.status,
          methodCategory: tx.paymentGatewayTx.methodCategory,
          providerCode: tx.paymentGatewayTx.providerCode,
          amount: Number(tx.paymentGatewayTx.amount),
          monthCount: tx.paymentGatewayTx.monthCount,
          paidAt: tx.paymentGatewayTx.paidAt,
        } : null,
      })),
    };
  }

  // ==========================================
  // 9. TRANSACTION DETAIL (Detail 1 transaksi)
  // ==========================================
  async getTransactionDetail(transactionId: string, user: ActiveUserData) {
    // Try finding by Transaction ID first, then by PaymentGatewayTx ID
    let tx = await this.financeRepo.findTransactionById(transactionId);
    if (!tx) {
      tx = await this.financeRepo.findTransactionByPaymentGatewayTxId(transactionId);
    }
    // Fallback: PENDING payment — PaymentGatewayTx exists but no Transaction yet
    if (!tx) {
      const pgTx = await this.financeRepo.findPaymentGatewayTxById(transactionId);
      if (!pgTx) throw new NotFoundException('Transaksi tidak ditemukan');

      // Security: RESIDENT can only see their own payment
      if (user.roleType === 'RESIDENT' && pgTx.userId !== user.id) {
        throw new ForbiddenException('Anda tidak memiliki akses ke transaksi ini');
      }

      // Build a synthetic response shape matching the transaction detail
      return {
        id: pgTx.id,
        amount: Number(pgTx.amount),
        type: 'INCOME' as const,
        description: 'Pembayaran iuran (menunggu konfirmasi)',
        createdAt: pgTx.createdAt,
        group: null,
        createdBy: pgTx.user,
        event: null,
        contribution: null,
        paymentGatewayTx: {
          id: pgTx.id,
          orderId: pgTx.orderId,
          status: pgTx.status,
          methodCategory: pgTx.methodCategory,
          providerCode: pgTx.providerCode,
          vaNumber: pgTx.vaNumber,
          amount: Number(pgTx.amount),
          grossAmount: Number(pgTx.grossAmount),
          monthCount: pgTx.monthCount,
          midtransId: pgTx.midtransId,
          redirectUrl: pgTx.redirectUrl,
          paidAt: pgTx.paidAt,
          createdAt: pgTx.createdAt,
          user: pgTx.user,
          contribution: pgTx.contribution ?? null,
        },
      };
    }

    // Security check: user must be in same group hierarchy OR be the payment owner (RESIDENT)
    const txGroupId = tx.wallet.communityGroup.id;

    // RESIDENT: can see their own payment transactions
    if (user.roleType === 'RESIDENT') {
      const isPaymentOwner = tx.paymentGatewayTx?.userId === user.id;
      const isCreator = tx.createdById === user.id;
      if (!isPaymentOwner && !isCreator) {
        throw new ForbiddenException('Anda tidak memiliki akses ke transaksi ini');
      }
    } else {
      // ADMIN/TREASURER/LEADER: check group hierarchy
      const userGroup = await this.prisma.communityGroup.findUnique({
        where: { id: user.communityGroupId },
        select: { type: true, parentId: true },
      });

      if (!userGroup) throw new ForbiddenException('Data pengguna tidak ditemukan');

      const isOwner = user.communityGroupId === txGroupId;
      const isParent = userGroup.type === 'RW';

      // LEADER (RW) can see any child's transactions
      // ADMIN/TREASURER can see own group transactions
      if (!isOwner && !isParent) {
        throw new ForbiddenException('Anda tidak memiliki akses ke transaksi ini');
      }
    }

    return {
      id: tx.id,
      amount: Number(tx.amount),
      type: tx.type,
      description: tx.description,
      createdAt: tx.createdAt,
      group: tx.wallet.communityGroup,
      createdBy: tx.createdBy,
      event: tx.event,
      contribution: tx.contribution
        ? {
            id: tx.contribution.id,
            month: tx.contribution.month,
            year: tx.contribution.year,
            amount: Number(tx.contribution.amount),
            paidAt: tx.contribution.paidAt,
            user: tx.contribution.user,
          }
        : null,
      paymentGatewayTx: tx.paymentGatewayTx
        ? {
            id: tx.paymentGatewayTx.id,
            orderId: tx.paymentGatewayTx.orderId,
            status: tx.paymentGatewayTx.status,
            methodCategory: tx.paymentGatewayTx.methodCategory,
            providerCode: tx.paymentGatewayTx.providerCode,
            vaNumber: tx.paymentGatewayTx.vaNumber,
            amount: Number(tx.paymentGatewayTx.amount),
            grossAmount: Number(tx.paymentGatewayTx.grossAmount),
            monthCount: tx.paymentGatewayTx.monthCount,
            midtransId: tx.paymentGatewayTx.midtransId,
            redirectUrl: tx.paymentGatewayTx.redirectUrl,
            paidAt: tx.paymentGatewayTx.paidAt,
            createdAt: tx.paymentGatewayTx.createdAt,
            user: tx.paymentGatewayTx.user,
            contribution: tx.paymentGatewayTx.contribution ?? null,
          }
        : null,
    };
  }

  // ==========================================
  // 10. DUES PROGRESS (Progres Iuran Warga per Grup)
  // ==========================================
  async getDuesProgress(groupId: number, year: number, user: ActiveUserData) {
    // Security: same as getGroupFinanceDetail
    const userGroup = await this.prisma.communityGroup.findUnique({
      where: { id: user.communityGroupId },
      select: { type: true, parentId: true },
    });
    const targetGroup = await this.prisma.communityGroup.findUnique({
      where: { id: groupId },
      select: { parentId: true, name: true, type: true },
    });

    if (!userGroup || !targetGroup) throw new NotFoundException('Data lingkungan tidak ditemukan');

    const isLeaderOfParent = userGroup.type === 'RW' && targetGroup.parentId === user.communityGroupId;
    const isSibling = userGroup.parentId && userGroup.parentId === targetGroup.parentId;
    const isOwnGroup = user.communityGroupId === groupId;

    if (!isLeaderOfParent && !isSibling && !isOwnGroup) {
      throw new ForbiddenException('Anda tidak memiliki akses ke data iuran lingkungan ini');
    }

    // Fetch group info + dues rule
    const group = await this.prisma.communityGroup.findUnique({
      where: { id: groupId },
      include: {
        duesRule: true,
        parent: { select: { id: true, name: true, duesRule: { select: { amount: true, dueDay: true, isActive: true } } } },
      },
    });

    // Fetch only RESIDENT users in this group (exclude LEADER, ADMIN, TREASURER)
    const members = await this.prisma.user.findMany({
      where: {
        communityGroupId: groupId,
        isActive: true,
        role: { type: 'RESIDENT' },
      },
      select: {
        id: true,
        fullName: true,
        phone: true,
        createdAt: true,
        lastPaidPeriod: true,
        role: { select: { type: true } },
      },
      orderBy: { fullName: 'asc' },
    });

    // Fetch contributions for this year for all members in this group
    const memberIds = members.map((m) => m.id);
    const contributions = await this.prisma.contribution.findMany({
      where: {
        userId: { in: memberIds },
        year: year,
      },
      select: {
        userId: true,
        month: true,
        year: true,
        amount: true,
        paidAt: true,
      },
      orderBy: { month: 'asc' },
    });

    // Group contributions by userId
    const contributionsByUser: Record<string, Array<{ month: number; year: number; amount: number; paidAt: Date }>> = {};
    for (const c of contributions) {
      if (!contributionsByUser[c.userId]) contributionsByUser[c.userId] = [];
      contributionsByUser[c.userId].push({
        month: c.month,
        year: c.year,
        amount: Number(c.amount),
        paidAt: c.paidAt,
      });
    }

    return {
      group: { id: groupId, name: targetGroup.name, type: targetGroup.type },
      year,
      duesRule: group?.duesRule
        ? { amount: Number(group.duesRule.amount), dueDay: group.duesRule.dueDay, isActive: group.duesRule.isActive }
        : null,
      parentDuesRule: group?.parent?.duesRule
        ? { amount: Number(group.parent.duesRule.amount), dueDay: group.parent.duesRule.dueDay, isActive: group.parent.duesRule.isActive }
        : null,
      members: members.map((m) => ({
        id: m.id,
        fullName: m.fullName,
        phone: m.phone,
        roleType: m.role.type,
        createdAt: m.createdAt,
        lastPaidPeriod: m.lastPaidPeriod,
        contributions: contributionsByUser[m.id] || [],
      })),
    };
  }

  // ==========================================
  // PARENT DUES PROGRESS (REKAPITULASI RT UNTUK RW)
  // ==========================================
  async getParentDuesProgress(groupId: number, targetYear: number, user: ActiveUserData) {
    // 1. Ambil data mentah dari database
    const rwData = await this.financeRepo.findParentWithChildrenProgress(groupId, targetYear);
    
    if (!rwData) {
      throw new NotFoundException('Data lingkungan (RW) tidak ditemukan');
    }

    if (rwData.type !== 'RW') {
      throw new BadRequestException('Endpoint ini hanya untuk level RW / Parent Group');
    }

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    // 2. Olah data anak-anak (RT)
    const childGroupsProgress = rwData.children.map((rt) => {
      // a. Pisahkan pengurus dan warga biasa
      const admins = rt.users.filter(u => u.role?.type === 'ADMIN');
      const treasurers = rt.users.filter(u => u.role?.type === 'TREASURER');
      const residents = rt.users.filter(u => u.role?.type === 'RESIDENT');

      // Ambil nama pengurus (jika ada lebih dari 1, gabungkan pakai koma)
      const adminName = admins.length > 0 ? admins.map(a => a.fullName).join(', ') : '-';
      const treasurerName = treasurers.length > 0 ? treasurers.map(t => t.fullName).join(', ') : '-';

      // b. Kalkulasi status kolektif per bulan (Jan-Des)
      const monthlyStatus: string[] = [];
      let isGroupFullyPaid = true; // Asumsi lunas semua, nanti dibuktikan salah jika ada yg nunggak

      // Loop dari Januari (1) sampai Desember (12)
      for (let month = 1; month <= 12; month++) {
        // Tentukan apakah bulan ini ada di masa depan
        const isFuture = targetYear > currentYear || (targetYear === currentYear && month > currentMonth);

        if (isFuture) {
          monthlyStatus.push('FUTURE');
          continue; // Skip kalkulasi untuk bulan depan
        }

        // Cari tahu warga mana saja yang SUDAH TERCATAT aktif di bulan ini
        const eligibleResidents = residents.filter(r => {
          if (!r.createdAt) return true;
          const cDate = new Date(r.createdAt);
          const cYear = cDate.getFullYear();
          const cMonth = cDate.getMonth() + 1;
          // Warga dihitung jika mendaftar SEBELUM ATAU PADA bulan tagihan ini
          return targetYear > cYear || (targetYear === cYear && month >= cMonth);
        });

        // Jika bulan ini RT belum punya warga sama sekali
        if (eligibleResidents.length === 0) {
          monthlyStatus.push('NOT_REGISTERED');
          continue;
        }

        // Hitung berapa warga yang sudah lunas di bulan ini
        let paidResidentsCount = 0;

        for (const resident of eligibleResidents) {
          let isPaid = false;

          // Cek array contributions eceran
          const hasContrib = resident.contributions.some(c => c.month === month && c.year === targetYear);
          if (hasContrib) {
            isPaid = true;
          } else if (resident.lastPaidPeriod) {
            // Cek tracker akumulasi tunggakan
            const lp = new Date(resident.lastPaidPeriod);
            const lpYear = lp.getFullYear();
            const lpMonth = lp.getMonth() + 1;
            if (lpYear > targetYear || (lpYear === targetYear && lpMonth >= month)) {
              isPaid = true;
            }
          }

          if (isPaid) {
            paidResidentsCount++;
          }
        }

        // Tentukan Status Kolektif RT untuk bulan ini
        if (paidResidentsCount === 0) {
          monthlyStatus.push('UNPAID');     // Merah: Nol besar
          isGroupFullyPaid = false;
        } else if (paidResidentsCount === eligibleResidents.length) {
          monthlyStatus.push('PAID');       // Hijau: Lunas semua warga
        } else {
          monthlyStatus.push('PARTIAL');    // Kuning: Sebagian bayar, sebagian belum
          isGroupFullyPaid = false;
        }
      }

      // c. Return object sesuai struktur ParentProgressData di Frontend
      return {
        id: rt.id,
        name: rt.name,
        adminName,
        treasurerName,
        balance: rt.wallet ? Number(rt.wallet.balance) : 0,
        hasDuesRule: !!(rt as any).duesRule,
        isFullyPaid: isGroupFullyPaid,
        monthlyStatus,
      };
    });

    // 3. Return final object pembungkus
    return {
      group: {
        name: rwData.name,
        type: rwData.type,
      },
      childGroups: childGroupsProgress,
    };
  }
}