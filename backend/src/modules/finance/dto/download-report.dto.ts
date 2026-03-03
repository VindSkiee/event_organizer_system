import { IsEnum, IsOptional, IsDateString, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export enum ReportType {
  SUMMARY = 'summary',
  DETAIL = 'detail',
}

export class DownloadReportDto {
  @IsEnum(ReportType, {
    message: 'reportType harus berupa "summary" atau "detail"',
  })
  reportType!: ReportType;

  @IsOptional()
  @IsInt({ message: 'groupId harus berupa angka' })
  @Type(() => Number)
  groupId?: number;

  @IsDateString({}, { message: 'startDate harus berupa format tanggal ISO yang valid' })
  startDate!: string;

  @IsDateString({}, { message: 'endDate harus berupa format tanggal ISO yang valid' })
  endDate!: string;
}
