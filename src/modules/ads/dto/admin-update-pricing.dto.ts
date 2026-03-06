import { ApiPropertyOptional } from '@nestjs/swagger';
import { DurationUnit, PricingModel } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  Min,
  ValidateIf,
} from 'class-validator';

export class AdminUpdatePricingDto {
  @ApiPropertyOptional({ enum: PricingModel })
  @IsOptional()
  @IsEnum(PricingModel)
  pricingModel?: PricingModel;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @ValidateIf(
    (o: AdminUpdatePricingDto) => o.pricingModel === PricingModel.DURATION,
  )
  durationValue?: number;

  @ApiPropertyOptional({ enum: DurationUnit })
  @IsOptional()
  @IsEnum(DurationUnit)
  @ValidateIf(
    (o: AdminUpdatePricingDto) => o.pricingModel === PricingModel.DURATION,
  )
  durationUnit?: DurationUnit;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  basePrice?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discountRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
