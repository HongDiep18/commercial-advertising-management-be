import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class CreateAdOrderItemDto {
  @ApiProperty({
    description:
      'Selected pricing option identifier (implicitly defines the ad package)',
    format: 'uuid',
  })
  @IsString()
  pricingId!: string;

  @ApiProperty({
    description:
      'Whether design service is required for this order item (e.g. banner/popup creative production)',
    default: false,
  })
  @IsBoolean()
  designServiceRequired!: boolean;

  @ApiProperty({
    description: 'Destination URL for the ad click-through',
    example: 'https://www.example.com/landing-page',
  })
  @IsString()
  adLinkUrl!: string;

  @ApiProperty({
    description: 'Ad start date (ISO 8601)',
    example: '2026-03-10',
  })
  @IsDateString()
  startDate!: string;
}

export class CreateAdOrderDto {
  @ApiPropertyOptional({
    description: 'Additional notes from the customer about this order',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    description: 'List of ad items included in this order',
    type: [CreateAdOrderItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAdOrderItemDto)
  items!: CreateAdOrderItemDto[];
}
