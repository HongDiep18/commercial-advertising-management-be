import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CompanyContactPhonesByNameItemDto,
  CompanyDetailResponseDto,
} from './company-detail.dto';

export class AdminCompanyContactItemDto {
  @ApiProperty()
  type!: string;

  @ApiProperty()
  value!: string;

  @ApiPropertyOptional()
  contactName!: string | null;
}

export class AdminCompanyDetailResponseDto extends CompanyDetailResponseDto {
  @ApiPropertyOptional()
  companyNameEn!: string | null;

  @ApiProperty({
    type: [AdminCompanyContactItemDto],
    description: 'Raw company contact rows used by admin management UIs',
  })
  contacts!: AdminCompanyContactItemDto[];

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
}
