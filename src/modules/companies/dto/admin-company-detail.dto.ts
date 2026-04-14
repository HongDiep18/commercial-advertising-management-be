import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CompanyContactItemDto } from './company-detail.dto';

export class AdminCompanyMemberDto {
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

export class AdminCompanyDetailResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiPropertyOptional()
  logoUrl!: string | null;

  @ApiPropertyOptional()
  companyNameVi!: string | null;

  @ApiPropertyOptional()
  companyNameEn!: string | null;

  @ApiPropertyOptional()
  companyNameZh!: string | null;

  @ApiProperty({
    type: [String],
    description: 'Company industries (multi-select)',
  })
  industry!: string[];

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

  @ApiProperty({
    type: [String],
    description: 'All company emails as a flat list',
    example: ['info@company.com', 'sales@company.com'],
  })
  emails!: string[];

  @ApiPropertyOptional({
    description: 'Stable source/import natural key',
    format: 'uuid',
    nullable: true,
  })
  importKey!: string | null;

  @ApiProperty({
    description: 'Company active flag used for admin enable/disable flows',
  })
  isActive!: boolean;

  @ApiProperty({
    type: [CompanyContactItemDto],
    description: 'Raw company contact rows used by admin management UIs',
  })
  contacts!: CompanyContactItemDto[];

  @ApiPropertyOptional({
    type: AdminCompanyMemberDto,
    nullable: true,
    description:
      'Linked member account summary. Null when the company has no linked user account.',
  })
  member!: AdminCompanyMemberDto | null;

  @ApiPropertyOptional({
    description:
      'Free-form note from `company_contacts` row with type `note` (e.g. registration note)',
    nullable: true,
  })
  note!: string | null;
}
