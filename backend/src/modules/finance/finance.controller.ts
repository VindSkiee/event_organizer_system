import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  Query,
  Res,
  Header,
} from '@nestjs/common';
import type { Response } from 'express';
import { SystemRoleType } from '@prisma/client';

// Decorators
import { Roles } from '@common/decorators/roles.decorator';
import { ActiveUser } from '@common/decorators/active-user.decorator';
import type { ActiveUserData } from '@common/decorators/active-user.decorator';

// Services
import { FinanceService } from './services/finance.service';
import { DuesService } from './services/dues.service';
import { ReportService } from './services/report.service';

// DTOs
import { CreateManualTransactionDto } from './dto/create-manual-transaction.dto';
import { SetDuesDto } from './dto/set-dues.dto';
import { DownloadReportDto } from './dto/download-report.dto';

@Controller('finance')
export class FinanceController {
  constructor(
    private readonly financeService: FinanceService,
    private readonly duesService: DuesService,
    private readonly reportService: ReportService,
  ) { }

  // ==========================================
  // 1. MANAJEMEN DOMPET & KAS (Khusus Pengurus)
  // ==========================================

  @Roles(SystemRoleType.ADMIN, SystemRoleType.TREASURER, SystemRoleType.LEADER)
  @Get('wallet')
  @HttpCode(HttpStatus.OK)
  async getWalletDetails(@ActiveUser() user: ActiveUserData) {
    // Bendahara melihat saldo dompet grupnya sendiri
    return this.financeService.getWalletDetails(user.communityGroupId);
  }

  @Roles(SystemRoleType.ADMIN, SystemRoleType.TREASURER, SystemRoleType.LEADER)
  @Get('transactions')
  @HttpCode(HttpStatus.OK)
  async getTransactionHistory(@ActiveUser() user: ActiveUserData) {
    // Bendahara melihat mutasi rekening koran (history)
    return this.financeService.getTransactionHistory(user.communityGroupId);
  }

  @Roles(SystemRoleType.TREASURER, SystemRoleType.LEADER) // Admin RT tidak boleh pegang uang tunai (Opsional)
  @Post('transactions')
  @HttpCode(HttpStatus.CREATED)
  async createManualTransaction(
    @ActiveUser() user: ActiveUserData,
    @Body() dto: CreateManualTransactionDto
  ) {
    // Input pengeluaran tunai / belanja ATK / sumbangan offline
    return this.financeService.createManualTransaction(dto, user);
  }

  // ==========================================
  // 2. MANAJEMEN IURAN & TAGIHAN (Dues)
  // ==========================================

  // A. Setting Harga (Hanya Ketua & Bendahara)
  @Roles(SystemRoleType.ADMIN, SystemRoleType.LEADER, SystemRoleType.TREASURER)
  @Post('dues/config')
  @HttpCode(HttpStatus.OK)
  async setDuesConfig(
    @ActiveUser() user: ActiveUserData,
    @Body() dto: SetDuesDto
  ) {
    // Contoh: RT 01 set harga 15.000
    return this.duesService.setDuesRule(dto, user);
  }

  // B. Lihat Konfigurasi Iuran (Halaman Pengaturan)
  @Roles(SystemRoleType.ADMIN, SystemRoleType.LEADER, SystemRoleType.TREASURER)
  @Get('dues/config')
  @HttpCode(HttpStatus.OK)
  async getDuesConfig(@ActiveUser() user: ActiveUserData) {
    return this.duesService.getDuesConfig(user);
  }

  @Roles(SystemRoleType.RESIDENT)
  @Get('dues/my-bill')
  @HttpCode(HttpStatus.OK)
  async getMyBill(@ActiveUser() user: ActiveUserData) {
    // Logic cerdas yang memisahkan jatah RT dan RW
    // Output: { total: 30000, breakdown: [{RT: 15000}, {RW: 15000}] }
    return this.duesService.getMyBill(user);
  }

  // ==========================================
  // 4. CHILDREN WALLETS (Saldo semua RT di bawah RW)
  // ==========================================

  @Roles(SystemRoleType.ADMIN, SystemRoleType.TREASURER, SystemRoleType.LEADER)
  @Get('children-wallets')
  @HttpCode(HttpStatus.OK)
  async getChildrenWallets(@ActiveUser() user: ActiveUserData) {
    return this.financeService.getChildrenWallets(user);
  }

  // ==========================================
  // 5. GROUP FINANCE DETAIL
  // ==========================================

  @Roles(SystemRoleType.ADMIN, SystemRoleType.TREASURER, SystemRoleType.LEADER)
  @Get('groups/:groupId/detail')
  @HttpCode(HttpStatus.OK)
  async getGroupFinanceDetail(
    @Param('groupId', ParseIntPipe) groupId: number,
    @ActiveUser() user: ActiveUserData,
  ) {
    return this.financeService.getGroupFinanceDetail(groupId, user);
  }

  // ==========================================
  // 5b. DUES PROGRESS PER GROUP (Progres Iuran Warga)
  // ==========================================

  @Roles(SystemRoleType.ADMIN, SystemRoleType.TREASURER, SystemRoleType.LEADER)
  @Get('groups/:groupId/dues-progress')
  @HttpCode(HttpStatus.OK)
  async getDuesProgress(
    @Param('groupId', ParseIntPipe) groupId: number,
    @Query('year') year: string,
    @ActiveUser() user: ActiveUserData,
  ) {
    const targetYear = year ? parseInt(year, 10) : new Date().getFullYear();
    return this.financeService.getDuesProgress(groupId, targetYear, user);
  }

  
  // ==========================================
  // 5c. PARENT DUES PROGRESS (Rekapitulasi RT untuk RW)
  // ==========================================

  @Roles(SystemRoleType.LEADER, SystemRoleType.TREASURER)
  @Get('groups/:groupId/parent-dues-progress')
  @HttpCode(HttpStatus.OK)
  async getParentDuesProgress(
    @Param('groupId', ParseIntPipe) groupId: number,
    @Query('year') year: string,
    @ActiveUser() user: ActiveUserData,
  ) {
    const targetYear = year ? parseInt(year, 10) : new Date().getFullYear();
    return this.financeService.getParentDuesProgress(groupId, targetYear, user);
  }

  // ==========================================
  // 6. TRANSACTION DETAIL
  // ==========================================

  @Roles(SystemRoleType.ADMIN, SystemRoleType.TREASURER, SystemRoleType.LEADER, SystemRoleType.RESIDENT)
  @Get('transactions/:id')
  @HttpCode(HttpStatus.OK)
  async getTransactionDetail(
    @Param('id') id: string,
    @ActiveUser() user: ActiveUserData,
  ) {
    return this.financeService.getTransactionDetail(id, user);
  }

  // ==========================================
  // 7. TRANSPARANSI (Publik untuk Warga)
  // ==========================================

  // A. Cek Saldo RT & RW
  @Roles(SystemRoleType.RESIDENT, SystemRoleType.ADMIN, SystemRoleType.LEADER, SystemRoleType.TREASURER)
  @Get('transparency/balance')
  @HttpCode(HttpStatus.OK)
  async getPublicBalance(@ActiveUser() user: ActiveUserData) {
    return this.financeService.getTransparencyBalance(user);
  }

  // B. Cek Riwayat Transaksi
  @Roles(SystemRoleType.RESIDENT, SystemRoleType.ADMIN, SystemRoleType.LEADER, SystemRoleType.TREASURER)
  @Get('transparency/history')
  @HttpCode(HttpStatus.OK)
  async getPublicHistory(
    @ActiveUser() user: ActiveUserData,
    @Query('scope') scope: 'RT' | 'RW' = 'RT',
  ) {
    return this.financeService.getTransparencyHistory(user, scope);
  }

  // ==========================================
  // 8. UNDUH LAPORAN KEUANGAN (PDF)
  // ==========================================

  @Roles(SystemRoleType.LEADER, SystemRoleType.ADMIN, SystemRoleType.RESIDENT)
  @Get('report/download')
  @Header('Content-Type', 'application/pdf')
  async downloadReport(
    @Query() dto: DownloadReportDto,
    @ActiveUser() user: ActiveUserData,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.reportService.generateReport(dto, user);

    const filename = `laporan-keuangan-${dto.reportType}-${new Date().toISOString().slice(0, 10)}.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(pdfBuffer.length),
    });

    res.send(pdfBuffer);
  }

  
}