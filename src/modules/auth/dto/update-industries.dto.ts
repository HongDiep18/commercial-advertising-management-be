import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsEnum } from 'class-validator';
import { Industry, VALID_INDUSTRIES } from '../../../common/enums/industry.enum';

export class UpdateIndustriesDto {
  @ApiProperty({
    description: 'Selected industries (max 3 for Gold tier)',
    example: ['textile', 'electronics', 'machinery'],
    type: [String],
    enum: VALID_INDUSTRIES,
    maxItems: 3,
  })
  @IsArray()
  @IsEnum(Industry, { each: true })
  @ArrayMaxSize(3, {
    message: 'You can select a maximum of 3 industries',
  })
  selectedIndustries: string[];
}
