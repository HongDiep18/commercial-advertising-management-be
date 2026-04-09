import { ApiProperty } from '@nestjs/swagger';

export class CompanyContactTypesResponseDto {
  @ApiProperty({
    type: [String],
    description: 'Distinct company contact types from company_contacts table',
    example: [
      'address',
      'contact_phone',
      'email',
      'phone',
      'tax_id',
      'website',
    ],
  })
  types!: string[];
}
