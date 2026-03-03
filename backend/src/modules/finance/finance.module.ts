import { Module } from '@nestjs/common';
import { FinanceController } from './finance.controller';
import { FinanceService } from './services/finance.service';
import { DuesService } from './services/dues.service';
import { ReportService } from './services/report.service';
import { DuesRepository } from './repositories/dues.repository';
import { FinanceRepository } from './repositories/finance.repository';

@Module({
  controllers: [FinanceController],
  providers: [FinanceService, DuesService, ReportService, DuesRepository, FinanceRepository],
  exports: [FinanceService, DuesService, ReportService, DuesRepository, FinanceRepository],
})
export class FinanceModule {}
