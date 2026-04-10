import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CompanyContactPhonesByNameItemDto {
  @ApiProperty()
  contactName!: string;

  @ApiProperty({ type: [String] })
  contactPhones!: string[];
}

export class CompanyDetailResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiPropertyOptional()
  logoUrl!: string | null;

  @ApiPropertyOptional()
  companyNameVi!: string | null;

  @ApiPropertyOptional()
  companyNameZh!: string | null;

  @ApiProperty({
    type: [String],
    description: 'Company industries (multi-select)',
  })
  industry!: string[];

  @ApiProperty()
  email!: string;

  @ApiProperty()
  phone!: string;

  @ApiProperty()
  address!: string;

  @ApiProperty()
  description!: string;

  @ApiPropertyOptional()
  taxId!: string | null;

  @ApiPropertyOptional()
  country!: string | null;

  @ApiPropertyOptional()
  region!: string | null;

  @ApiPropertyOptional()
  website!: string | null;

  @ApiPropertyOptional()
  contactName!: string | null;

  @ApiPropertyOptional()
  contactPhone?: string | null;

  @ApiProperty({
    type: [String],
    description: 'All company emails as a flat list',
    example: ['info@company.com', 'sales@company.com'],
  })
  emails!: string[];

  @ApiProperty({
    type: [CompanyContactPhonesByNameItemDto],
    description: 'Contact phones grouped by contact name',
  })
  contactPhonesByName!: CompanyContactPhonesByNameItemDto[];
}

