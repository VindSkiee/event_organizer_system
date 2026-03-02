import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  HttpCode, 
  HttpStatus,
  Query, 
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { SystemRoleType } from '@prisma/client';

import { Public } from '@common/decorators/public.decorator'; 
import { Roles } from '@common/decorators/roles.decorator'; 
import { ActiveUser } from '@common/decorators/active-user.decorator';
import type { ActiveUserData } from '@common/decorators/active-user.decorator';

import { CreateTransactionDto } from './dto/create-transaction.dto';
import { RequestRefundDto } from './dto/request-refund.dto';
import { PayDuesDto } from './dto/pay-dues.dto';
import { SkipThrottle, Throttle } from '@nestjs/throttler/dist/throttler.decorator';

@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  // ==========================================
  // 1. ENDPOINT USER BISA DIAKSES SEMUA ROLE (MEMBER BISA BAYAR)
  // ==========================================

  @Roles(SystemRoleType.RESIDENT)
  @Post('create')
  @HttpCode(HttpStatus.CREATED)
  async createTransaction(
    @ActiveUser() user: ActiveUserData, 
    @Body() createTransactionDto: CreateTransactionDto
  ) {
    const orderId = createTransactionDto.orderId || `EO-PAY-${Date.now()}`;
    return this.paymentService.createTransaction(user.id, orderId, createTransactionDto.amount);
  }

  // Endpoint: GET /payment/history
  // Endpoint: GET /payment/history?userId=xxx-yyy-zzz (Khusus Admin)
  @Get('history')
  async getPaymentHistory(
    @ActiveUser() user: ActiveUserData,
    @Query('userId') targetUserId?: string // Opsional
  ) {
    // Kita kirim "User yang Request" (Actor) dan "User yang Mau Dilihat" (Target)
    return this.paymentService.getPaymentHistory(user, targetUserId); 
  }

  @Roles(SystemRoleType.RESIDENT)
  @Post('refund')
  async requestRefund(
    @ActiveUser() user: ActiveUserData, 
    @Body() requestRefundDto: RequestRefundDto
  ) {
    // Service idealnya juga butuh user.id untuk memastikan user ini yg berhak request
    return this.paymentService.requestRefund(
      requestRefundDto.paymentId, 
      requestRefundDto.amount, 
      requestRefundDto.reason,
      user.id
    );
  }

  // ==========================================
  // 2. ENDPOINT "ZONA ABU-ABU" (BUTUH ACTIVE USER UNTUK CEK KEPEMILIKAN)
  // ==========================================

  @Get('status/:orderId')
  async getTransactionStatus(
    @ActiveUser() user: ActiveUserData, 
    @Param('orderId') orderId: string
  ) {
    // Kita kirim user data ke service agar service bisa mengecek:
    // "Apakah user ini ADMIN? Jika ya, kasih lihat. Jika bukan, pastikan transaksi ini miliknya."
    return this.paymentService.getTransactionStatus(orderId, user);
  }

  @Post('cancel/:orderId')
  async cancelTransaction(
    @ActiveUser() user: ActiveUserData, 
    @Param('orderId') orderId: string
  ) {
    return this.paymentService.cancelTransaction(orderId, user);
  }

  // ==========================================
  // 3. ENDPOINT KHUSUS PENGURUS (ADMIN, TREASURER, LEADER)
  // ==========================================

  // Saya tambahkan endpoint ini karena biasanya Bendahara butuh melihat SEMUA transaksi
  @Roles(SystemRoleType.TREASURER, SystemRoleType.ADMIN, SystemRoleType.LEADER)
  @Get('all-transactions')
  async getAllTransactions() {
    return this.paymentService.getAllTransactions(); 
  }

  @Roles(SystemRoleType.TREASURER, SystemRoleType.ADMIN, SystemRoleType.LEADER)
  @Post('refund/:refundId/process')
  async processRefund(@Param('refundId') refundId: string) {
    return this.paymentService.processRefund(refundId);
  }

  // ==========================================
  // 4. ENDPOINT WEBHOOK (PUBLIC)
  // ==========================================

  @Public() 
  @SkipThrottle()
  @Post('notification')
  @HttpCode(HttpStatus.OK)
  async handleNotification(@Body() notification: Record<string, any>) {
    return this.paymentService.handleNotification(notification);
  }

  @Roles(SystemRoleType.RESIDENT)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('pay-dues')
  @HttpCode(HttpStatus.OK)
  async payDues(
    @ActiveUser() user: ActiveUserData,
    @Body() dto: PayDuesDto,
  ) {
    // months: 1-12, server tervalidasi via DTO
    return this.paymentService.createDuesPayment(user, dto.months ?? 1);
  }

  // ==========================================
  // 5. SYNC PAYMENT STATUS FROM MIDTRANS
  // Digunakan di development (localhost) dimana webhook tidak bisa diterima,
  // atau sebagai fallback ketika webhook terlambat.
  // ==========================================
  @Post('sync/:orderId')
  @HttpCode(HttpStatus.OK)
  async syncPaymentStatus(
    @ActiveUser() user: ActiveUserData,
    @Param('orderId') orderId: string,
  ) {
    return this.paymentService.syncPaymentFromMidtrans(orderId, user);
  }
}