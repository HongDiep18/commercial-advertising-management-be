import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CompanyMemberDto {
  @ApiProperty({
    description: 'Local-part extracted from the linked user email',
    example: 'john.doe',
  })
  userName!: string;

  @ApiProperty({
    description: 'Registered email of the linked user account',
    example: 'john.doe@company.com',
  })
  registeredEmail!: string;

  @ApiProperty({
    description: 'Linked user account creation timestamp (ISO 8601)',
    example: '2026-04-10T03:12:45.000Z',
  })
  memberSince!: string;

  @ApiProperty({
    description: 'Linked user membership tier',
    example: 'BRONZE',
  })
  membershipTier!: string;
}

export class CompanyContactItemDto {
  @ApiProperty()
  type!: string;

  @ApiProperty()
  value!: string;

  @ApiPropertyOptional()
  contactName!: string | null;
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

  @ApiPropertyOptional()
  companyNameEn!: string | null;

  @ApiProperty({
    type: [String],
    description: 'Company industries (multi-select)',
  })
  industry!: string[];

  @ApiProperty()
  description!: string;

  @ApiPropertyOptional()
  taxId!: string | null;

  @ApiPropertyOptional()
  country!: string | null;

  @ApiPropertyOptional()
  region!: string | null;

  @ApiProperty({
    type: [String],
    description: 'All company emails as a flat list',
    example: ['info@company.com', 'sales@company.com'],
  })
  emails!: string[];

  @ApiProperty({
    type: [CompanyContactItemDto],
    description: 'Raw company contact rows',
  })
  contacts!: CompanyContactItemDto[];

  @ApiPropertyOptional({
    type: CompanyMemberDto,
    nullable: true,
    description:
      'Linked member account summary. Null when the company has no linked user account.',
  })
  member!: CompanyMemberDto | null;
}
