import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  Min,
  ValidateIf,
} from 'class-validator';
import { DurationUnit, PricingModel } from '@prisma/client';

export class AdminCreatePricingDto {
  @ApiProperty({ enum: PricingModel })
  @IsEnum(PricingModel)
  pricingModel!: PricingModel;

  @ApiProperty({ required: false, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @ValidateIf((o) => o.pricingModel === PricingModel.DURATION)
  durationValue?: number;

  @ApiProperty({ required: false, enum: DurationUnit })
  @IsOptional()
  @IsEnum(DurationUnit)
  @ValidateIf((o) => o.pricingModel === PricingModel.DURATION)
  durationUnit?: DurationUnit;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  basePrice!: number;

  @ApiProperty({ required: false, minimum: 0, maximum: 100, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discountRate?: number;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
