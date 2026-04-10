import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, ArrayMinSize, ValidateNested } from 'class-validator';
import { AdminCompanyContactDto } from './admin-update-company.dto';

/**
 * Request body for appending contact rows to a company.
 * Duplicates (same company + type + normalized value) are skipped.
 * Supported types: email, tel, fax, website, hotline, wechat, line, skype, zalo, facebook, viber, address, contact_person
 */
export class AddCompanyContactsDto {
  @ApiProperty({
    type: [AdminCompanyContactDto],
    description: 'Contact rows to append. Duplicates are skipped.',
    example: [
      { type: 'email', value: 'sales@example.com', contactName: 'Jane Nguyen' },
      { type: 'wechat', value: 'wxid_abc' },
      { type: 'zalo', value: '+84901234567' },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AdminCompanyContactDto)
  contacts!: AdminCompanyContactDto[];
}