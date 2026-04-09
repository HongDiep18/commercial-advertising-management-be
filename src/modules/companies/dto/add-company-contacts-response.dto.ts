import { ApiProperty } from '@nestjs/swagger';

export class AddCompanyContactsResponseDto {
  @ApiProperty({
    description: 'Number of new contact rows created',
    example: 3,
  })
  added: number;

  @ApiProperty({
    description:
      'Number of values skipped because a row with the same type and value already exists for this company',
    example: 1,
  })
  skippedDuplicates: number;
}
