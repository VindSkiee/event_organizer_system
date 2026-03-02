import { Injectable, NotFoundException } from '@nestjs/common';
import { DuesRepository } from '../repositories/dues.repository'; // <-- Pakai Repo
import { FinanceService } from './finance.service';
import { PrismaService } from '@database/prisma.service';
import { ActiveUserData } from '@common/decorators/active-user.decorator';
import { SetDuesDto } from '../dto/set-dues.dto';
import { Prisma, TransactionType } from '@prisma/client';

@Injectable()
export class DuesService {
  constructor(
    private readonly duesRepo: DuesRepository,
    private readonly financeService: FinanceService,
    private readonly prisma: PrismaService
  ) { }

  // ==========================================
  // 1. SETTING IURAN
  // ==========================================
  async setDuesRule(dto: SetDuesDto, user: ActiveUserData) {
    return this.duesRepo.upsertDuesRule(user.communityGroupId, dto);
  }

  // ==========================================
  // 1b. GET DUES CONFIG (Untuk Halaman Pengaturan)
  // ==========================================
  async getDuesConfig(user: ActiveUserData) {
    const group = await this.duesRepo.findDuesConfigByGroupId(user.communityGroupId);
    if (!group) {
      throw new NotFoundException('Data lingkungan tidak ditemukan');
    }

    return {
      group: {
        id: group.id,
        name: group.name,
        type: group.type,
      },
      duesRule: group.duesRule
        ? {
          id: group.duesRule.id,
          amount: Number(group.duesRule.amount),
          dueDay: group.duesRule.dueDay,
          isActive: group.duesRule.isActive,
          updatedAt: group.duesRule.updatedAt,
        }
        : null,
      children: group.children.map((child) => ({
        group: {
          id: child.id,
          name: child.name,
          type: child.type,
        },
        duesRule: child.duesRule
          ? {
            id: child.duesRule.id,
            amount: Number(child.duesRule.amount),
            dueDay: child.duesRule.dueDay,
            isActive: child.duesRule.isActive,
            updatedAt: child.duesRule.updatedAt,
          }
          : null,
      })),
    };
  }

  // ==========================================
  // 2. LIHAT TAGIHAN (Split Bill Calculation)
  // ==========================================
  async getMyBill(user: ActiveUserData) {
    const now = new Date();

    // 1. Ambil data hierarki + lastPaidPeriod & createdAt user secara paralel
    const [groupData, userRecord] = await Promise.all([
      this.duesRepo.findGroupHierarchyWithRules(user.communityGroupId),
      this.prisma.user.findUnique({
        where: { id: user.id },
        select: { lastPaidPeriod: true, createdAt: true }, // Ambil createdAt untuk warga baru
      }),
    ]);

    if (!groupData) throw new NotFoundException('Data lingkungan tidak ditemukan');
    if (!userRecord) throw new NotFoundException('Data warga tidak ditemukan');

    // 2. Hitung TARIF DASAR BULANAN (Base Monthly Amount)
    let baseMonthlyTotal = 0;
    const baseBreakdown: Array<{ type: string; groupName: string; amount: number; destinationWalletId: number }> = [];

    // A. Jatah RT
    if (groupData.duesRule?.isActive) {
      const rtAmount = Number(groupData.duesRule.amount);
      baseMonthlyTotal += rtAmount;
      baseBreakdown.push({
        type: 'RT', groupName: groupData.name, amount: rtAmount, destinationWalletId: groupData.id
      });
    }

    // B. Jatah RW
    if (groupData.parent?.duesRule?.isActive) {
      const rwAmount = Number(groupData.parent.duesRule.amount);
      baseMonthlyTotal += rwAmount;
      baseBreakdown.push({
        type: 'RW', groupName: groupData.parent.name, amount: rwAmount, destinationWalletId: groupData.parent.id
      });
    }

    // 3. Tentukan BULAN MULAI DITAGIH (Next Bill Period)
    let nextBillMonth: number;
    let nextBillYear: number;

    if (userRecord.lastPaidPeriod) {
      // Skenario A: Warga Lama yang sudah pernah bayar. Lanjut dari bulan terakhir bayar + 1
      const lp = new Date(userRecord.lastPaidPeriod);
      nextBillMonth = lp.getMonth() + 2; // getMonth is 0-indexed, +2 to get next month 1-indexed
      nextBillYear = lp.getFullYear();

      if (nextBillMonth > 12) {
        nextBillMonth = 1;
        nextBillYear += 1;
      }
    } else {
      // Skenario B: Warga Baru (Belum pernah bayar). Mulai tagih dari bulan/tahun AKUN DIBUAT
      const joinDate = new Date(userRecord.createdAt);
      nextBillMonth = joinDate.getMonth() + 1;
      nextBillYear = joinDate.getFullYear();
    }

    // 4. Hitung TOTAL BULAN TERTUNGGAK (Unpaid Months)
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Rumus: Selisih tahun * 12 + selisih bulan + 1 (karena bulan berjalan ikut dihitung)
    let unpaidMonthsCount = (currentYear - nextBillYear) * 12 + (currentMonth - nextBillMonth) + 1;

    // Jika user bayar lebih awal (Advance Payment), tagihan bulan ini 0
    if (unpaidMonthsCount < 0) {
      unpaidMonthsCount = 0;
    }

    // 5. Kalkulasi Tagihan Aktual (Tarif Dasar x Jumlah Bulan Tertunggak)
    const totalAmount = baseMonthlyTotal * unpaidMonthsCount;

    // Sesuaikan nominal breakdown sesuai jumlah bulan agar Payment Gateway memproses dengan benar
    const breakdown = baseBreakdown.map(b => ({
      ...b,
      amount: b.amount * unpaidMonthsCount
    }));

    // 6. Buat deskripsi yang informatif untuk UI
    const dueDay = groupData.duesRule?.dueDay || 10;
    let dueDateDescription = `Setiap tanggal ${dueDay} bulan berjalan.`;

    if (unpaidMonthsCount > 0) {
      dueDateDescription = `Terdapat tunggakan ${unpaidMonthsCount} bulan (dimulai dari bulan ${String(nextBillMonth).padStart(2, '0')}/${nextBillYear}).`;
    } else {
      dueDateDescription = `Terima kasih! Iuran Anda sudah lunas hingga bulan berjalan.`;
    }

    return {
      totalAmount,
      currency: 'IDR',
      breakdown,
      baseBreakdown, // per-month rates (not multiplied by unpaidMonthsCount)
      dueDateDescription,
      nextBillMonth,
      nextBillYear,
      unpaidMonthsCount,
      baseMonthlyAmount: baseMonthlyTotal
    };
  }

  // ==========================================
  // 3. DISTRIBUSI UANG (Dipanggil Payment Service)
  // ==========================================
  // Logic: User bayar 30rb -> 15rb masuk RT, 15rb masuk RW
  // ==========================================
  // 3. UPDATE STATUS SETELAH BAYAR (Atomic)
  // ==========================================
  async distributeContribution(
    userId: string,
    totalPaid: number,
    tx?: Prisma.TransactionClient, // 👈 Parameter Transaksi Opsional
    paymentGatewayTxId?: string,  // 👈 ID PaymentGatewayTx untuk Contribution linking
  ) {
    // Gunakan Transaction Client jika ada, jika tidak pakai default Prisma Service
    const prismaClient = tx || this.prisma;

    // 1. AMBIL DATA USER & RULE (Read)
    const user = await prismaClient.user.findUnique({
      where: { id: userId },
      include: {
        communityGroup: {
          include: {
            wallet: true, // Ambil Wallet RT
            duesRule: true,
            parent: {
              include: {
                wallet: true, // Ambil Wallet RW
                duesRule: true
              }
            }
          }
        }
      }
    });

    if (!user || !user.communityGroup) {
      console.warn(`[DuesService] User ${userId} tidak memiliki grup komunitas.`);
      return;
    }

    const group = user.communityGroup;
    const parent = group.parent;

    // 2. HITUNG ALOKASI DANA
    // Berapa jatah RT dan RW per bulan?
    const rtRate = group.duesRule?.isActive ? Number(group.duesRule.amount) : 0;
    const rwRate = (parent && parent.duesRule?.isActive) ? Number(parent.duesRule.amount) : 0;
    const monthlyTotal = rtRate + rwRate;

    // Berapa bulan yang dibayar? (Pembulatan ke bawah untuk safety)
    const monthsPaid = monthlyTotal > 0 ? Math.floor(totalPaid / monthlyTotal) : 0;

    // Hitung total nominal uang yang akan masuk ke masing-masing kas
    const totalToRT = rtRate * monthsPaid;
    const totalToRW = rwRate * monthsPaid;

    // Sisa uang (kembalian/kelebihan) dianggap donasi ke RT (atau bisa diset logic lain)
    const donationToRT = totalPaid - (totalToRT + totalToRW);
    const finalToRT = totalToRT + donationToRT;

    console.log(`[DuesService] Distributing: RT=${finalToRT}, RW=${totalToRW}, Months=${monthsPaid}`);

    // 3. EKSEKUSI UPDATE SALDO RT (Write)
    if (finalToRT > 0 && group.wallet) {
      await prismaClient.wallet.update({
        where: { id: group.wallet.id },
        data: { balance: { increment: finalToRT } }
      });

      // Catat Log Transaksi RT
      await prismaClient.transaction.create({
        data: {
          walletId: group.wallet.id,
          amount: finalToRT,
          type: TransactionType.CREDIT,
          description: `Iuran Warga: ${user.fullName || user.email} (${monthsPaid} bulan)`,
          createdById: user.id, // Opsional: Siapa yang bayar
          paymentGatewayTxId: paymentGatewayTxId || undefined,
        }
      });
    }

    // 4. EKSEKUSI UPDATE SALDO RW (Write)
    if (totalToRW > 0 && parent && parent.wallet) {
      await prismaClient.wallet.update({
        where: { id: parent.wallet.id },
        data: { balance: { increment: totalToRW } }
      });

      // Catat Log Transaksi RW
      await prismaClient.transaction.create({
        data: {
          walletId: parent.wallet.id,
          amount: totalToRW,
          type: TransactionType.CREDIT,
          description: `Setoran Iuran dari RT ${group.name} - Warga: ${user.fullName || user.email}`,
          createdById: user.id,
          paymentGatewayTxId: paymentGatewayTxId || undefined,
        }
      });
    }

    // 5. CATAT CONTRIBUTION & UPDATE PERIODE PEMBAYARAN USER (Write)
    if (monthsPaid > 0) {
      // Tentukan bulan pertama yang dibayarkan:
      // - Jika belum pernah bayar (null): bayar untuk bulan berjalan saat ini
      // - Jika sudah pernah bayar: bayar untuk bulan berikutnya setelah lastPaidPeriod
      const now = new Date();
      let startMonth: number; // 1-indexed (1=Jan, 12=Dec)
      let startYear: number;

      if (user.lastPaidPeriod) {
        const lp = new Date(user.lastPaidPeriod);
        // getMonth() is 0-indexed → +1 for 1-indexed, +1 for "bulan berikutnya"
        startMonth = lp.getMonth() + 2;
        startYear = lp.getFullYear();
        if (startMonth > 12) { startMonth = 1; startYear += 1; }
      } else {
        // Belum pernah bayar → bayarkan untuk bulan berjalan
        startMonth = now.getMonth() + 1; // 0-indexed → 1-indexed
        startYear = now.getFullYear();
      }

      // Catat Contribution per bulan yang dibayarkan
      for (let i = 0; i < monthsPaid; i++) {
        let contribMonth = startMonth + i;
        let contribYear = startYear;
        while (contribMonth > 12) { contribMonth -= 12; contribYear += 1; }

        // Idempotency: jangan catat dua kali untuk bulan yang sama
        const existing = await prismaClient.contribution.findFirst({
          where: { userId: user.id, month: contribMonth, year: contribYear },
        });

        if (!existing) {
          await prismaClient.contribution.create({
            data: {
              userId: user.id,
              amount: monthlyTotal,
              month: contribMonth,
              year: contribYear,
              paidAt: now,
              // Hubungkan ke PaymentGatewayTx hanya untuk bulan pertama (unique constraint)
              ...(i === 0 && paymentGatewayTxId ? { paymentGatewayTxId } : {}),
            },
          });
        }
      }

      // Update lastPaidPeriod ke hari terakhir bulan terakhir yang dibayar
      let lastMonth = startMonth + monthsPaid - 1;
      let lastYear = startYear;
      while (lastMonth > 12) { lastMonth -= 12; lastYear += 1; }
      // new Date(year, month, 0) → hari terakhir bulan month (1-indexed) pada year
      const newPaidPeriod = new Date(lastYear, lastMonth, 0);

      await prismaClient.user.update({
        where: { id: user.id },
        data: { lastPaidPeriod: newPaidPeriod },
      });
    }
  }
}