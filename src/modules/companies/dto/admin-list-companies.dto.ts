import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CompanyProfileRequestStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class AdminListCompaniesQueryDto {
  @ApiPropertyOptional({
    description:
      'Search company names (VI/EN/ZH), tax id, industry tags, and email/phone contact values',
    example: 'acme',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Sort field',
    enum: ['createdAt', 'updatedAt', 'companyNameVi'],
    default: 'createdAt',
  })
  @IsOptional()
  @IsIn(['createdAt', 'updatedAt', 'companyNameVi'])
  sortBy?: 'createdAt' | 'updatedAt' | 'companyNameVi' = 'createdAt';

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}

export class AdminCompanyListItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  userId!: string | null;

  @ApiPropertyOptional()
  companyNameVi!: string | null;

  @ApiPropertyOptional()
  companyNameEn!: string | null;

  @ApiPropertyOptional()
  companyNameZh!: string | null;

  @ApiProperty({ type: [String] })
  industry!: string[];

  @ApiProperty({ enum: CompanyProfileRequestStatus })
  status!: CompanyProfileRequestStatus;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  primaryEmail!: string;

  @ApiProperty()
  primaryPhone!: string;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class AdminListCompaniesResponseDto {
  @ApiProperty({ type: [AdminCompanyListItemDto] })
  companies!: AdminCompanyListItemDto[];

  @ApiProperty({
    example: { page: 1, limit: 20, total: 150, totalPages: 8 },
  })
  pagination!: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
