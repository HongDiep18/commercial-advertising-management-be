import {
  ApiHideProperty,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {
  CompanyContactItemDto,
  CompanyContactPhonesByNameItemDto,
  CompanyDetailResponseDto,
} from './company-detail.dto';

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

export class AdminCompanyDetailResponseDto extends CompanyDetailResponseDto {
  @ApiHideProperty()
  declare contactPhone?: never;

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

  @ApiPropertyOptional()
  declare companyNameEn: string | null;

  @ApiProperty({
    type: [CompanyContactItemDto],
    description: 'Raw company contact rows used by admin management UIs',
  })
  declare contacts: CompanyContactItemDto[];

  @ApiProperty({
    type: [String],
    description: 'All company emails as a flat list',
    example: ['info@company.com', 'sales@company.com'],
  })
  declare emails: string[];

  @ApiProperty({
    type: [CompanyContactPhonesByNameItemDto],
    description: 'Contact phones grouped by contact name',
  })
  declare contactPhonesByName: CompanyContactPhonesByNameItemDto[];

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
