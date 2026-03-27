import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class AdminUpdateActiveAdDto {
  @ApiPropertyOptional({ description: 'Enable or disable the ad' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'New start date for the ad',
    type: String,
    format: 'date-time',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'New end date for the ad (null to clear)',
    type: String,
    format: 'date-time',
    nullable: true,
  })
  @IsOptional()
  @IsDateString()
  endDate?: string | null;

  @ApiPropertyOptional({
    description: 'Ad link URL (null to clear)',
    maxLength: 2048,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  adLinkUrl?: string | null;
}
