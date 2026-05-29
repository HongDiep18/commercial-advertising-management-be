import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CompanyProfileRequestStatus } from '@prisma/client';

export class UnlinkedCompanyContactDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  type!: string;

  @ApiProperty()
  value!: string;

  @ApiPropertyOptional({ nullable: true })
  contactName!: string | null;

  @ApiProperty()
  createdAt!: string;
}

export class UnlinkedCompanyItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiPropertyOptional({ nullable: true })
  companyNameVi!: string | null;

  @ApiPropertyOptional({ nullable: true })
  companyNameEn!: string | null;

  @ApiPropertyOptional({ nullable: true })
  companyNameZh!: string | null;

  @ApiPropertyOptional({ nullable: true })
  taxId!: string | null;

  @ApiProperty({ type: [String] })
  industry!: string[];

  @ApiPropertyOptional({ nullable: true })
  description!: string;

  @ApiPropertyOptional({ nullable: true })
  logoUrl!: string | null;

  @ApiPropertyOptional({ nullable: true })
  country!: string | null;

  @ApiPropertyOptional({ nullable: true })
  region!: string | null;

  @ApiProperty({ enum: CompanyProfileRequestStatus })
  status!: CompanyProfileRequestStatus;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;

  @ApiProperty({ type: [UnlinkedCompanyContactDto] })
  contacts!: UnlinkedCompanyContactDto[];
}

export class AdminListUnlinkedCompaniesResponseDto {
  @ApiProperty({ type: [UnlinkedCompanyItemDto] })
  companies!: UnlinkedCompanyItemDto[];
}
