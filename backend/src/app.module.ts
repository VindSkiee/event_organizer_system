import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD, APP_INTERCEPTOR, APP_PIPE, APP_FILTER } from '@nestjs/core';

import { AppController } from './app.controller';
import { AppService } from './app.service';

// Configuration
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import midtransConfig from './config/midtrans.config';

// Global Modules
import { PrismaModule } from './database/prisma.module';
import { MailModule } from './providers/mail/mail.module';
import { StorageModule } from './providers/storage/storage.module';

// Feature Modules
import { AuthModule } from './modules/auth/auth.module';
import { CommunityModule } from './modules/community/community.module';
import { EventsModule } from './modules/events/events.module';
import { FinanceModule } from './modules/finance/finance.module';
import { PaymentModule } from './modules/payment/payment.module';
import { SettingsModule } from './modules/settings/settings.module';

// Global Providers
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter'; // Import Filter Anda
import { RolesGuard } from '@common/guards/roles.guard';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [appConfig, databaseConfig, midtransConfig],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    MailModule,
    StorageModule,
    AuthModule,
    CommunityModule,
    EventsModule,
    FinanceModule,
    PaymentModule,
    SettingsModule,
    ThrottlerModule.forRoot([
      // 1. Anti-Spam Cepat (Burst Protection)
      // Izinkan 30 request dalam 1 detik (untuk loading awal dashboard)
      // Jika lebih dari 30x klik dalam sedetik, langsung blokir.
      {
        name: 'short',
        ttl: 1000,
        limit: 30,
      },

      // 2. Mode Hemat CPU (Sustained Usage)
      // Maksimal 120 request per menit.
      // Ini setara 1 request tiap 0.5 detik secara rata-rata.
      // Cukup untuk navigasi cepat, tapi tetap memblokir bot/scraper.
      {
        name: 'long',
        ttl: 60000, // 1 menit
        limit: 120,
      },
    ]),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },

    // 1. GLOBAL GUARD (Keamanan - Default Secure)
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },

    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },

    // 2. GLOBAL INTERCEPTOR (Format Response Sukses)
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },

    // 3. GLOBAL VALIDATION PIPE (Validasi DTO) -- WAJIB ADA
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true, // Hapus properti JSON yang tidak ada di DTO (Security)
        forbidNonWhitelisted: true, // Error jika user kirim field sampah
        transform: true, // Otomatis ubah tipe data (misal string "1" jadi number 1)
      }),
    },

    // 4. GLOBAL EXCEPTION FILTER (Format Error)
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule { }