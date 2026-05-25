import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CompanyProfileRequestStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import {
  COMPANY_EXPORT_TYPES,
  type CompanyExportFileType,
  COMPANY_EXPORT_LOCALES,
  type CompanyExportLocale,
} from '../company-export.locale';

export class AdminExportCompaniesQueryDto {
  @ApiProperty({
    description: 'Export file format',
    enum: COMPANY_EXPORT_TYPES,
    example: 'excel',
  })
  @IsIn([...COMPANY_EXPORT_TYPES])
  type!: CompanyExportFileType;

  @ApiProperty({
    description:
      'Locale for column headers and company display name (with locale-specific fallback)',
    enum: COMPANY_EXPORT_LOCALES,
    example: 'vi',
  })
  @IsIn([...COMPANY_EXPORT_LOCALES])
  locale!: CompanyExportLocale;

  @ApiPropertyOptional({
    description:
      'Search by consecutive word-start sequence or initials across company names (VI/EN/ZH), tax id, industry tags, and contact values.',
    example: 'acme',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by company registration status',
    enum: CompanyProfileRequestStatus,
  })
  @IsOptional()
  @IsIn([
    CompanyProfileRequestStatus.PENDING,
    CompanyProfileRequestStatus.APPROVED,
    CompanyProfileRequestStatus.REJECTED,
  ])
  status?: CompanyProfileRequestStatus;

  @ApiPropertyOptional({
    description: 'Filter by company `isActive`. Omit for all companies.',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      const normalized = value.toLowerCase();
      if (normalized === 'true') {
        return true;
      }
      if (normalized === 'false') {
        return false;
      }
    }
    return undefined;
  })
  @IsBoolean()
  isActive?: boolean;
}
