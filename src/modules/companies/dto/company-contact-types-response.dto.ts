import { ApiProperty } from '@nestjs/swagger';

export class CompanyContactTypesResponseDto {
  @ApiProperty({
    type: [String],
    description: 'Distinct company contact types from company_contacts table',
    example: [
      'address',
      'email',
      'facebook',
      'fax',
      'hotline',
      'line',
      'skype',
      'tel',
      'viber',
      'website',
      'wechat',
      'zalo',
    ],
  })
  types!: string[];
}
