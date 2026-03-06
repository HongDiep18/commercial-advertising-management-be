import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class AdminManualActivateAdDto {
  @ApiProperty({
    description: 'Company ID for which the ad will be manually activated',
    format: 'uuid',
  })
  @IsUUID()
  companyId!: string;

  @ApiProperty({
    description: 'Ad package pricing ID to base the activation on',
    format: 'uuid',
  })
  @IsUUID()
  pricingId!: string;

  @ApiPropertyOptional({
    description:
      'Optional ad link URL to associate with this manual activation',
    maxLength: 2048,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  adLinkUrl?: string;

  @ApiPropertyOptional({
    description: 'Optional custom start date for the ad (defaults to now)',
    type: String,
    format: 'date-time',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;
}

export class AdminManualActiveAdResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  companyId!: string;

  @ApiProperty({ description: 'Ad package type' })
  packageType!: string;

  @ApiProperty({ description: 'Pricing model used for this ad' })
  pricingModel!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  startDate!: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  endDate?: Date;

  @ApiPropertyOptional({
    description: 'Total allowed quantity for PER_ACTION pricing model',
  })
  totalQuantity?: number | null;

  @ApiProperty({
    description: 'Whether the ad is currently active',
  })
  isActive!: boolean;
}
