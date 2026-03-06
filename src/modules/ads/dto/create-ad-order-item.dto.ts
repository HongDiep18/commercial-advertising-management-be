import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class CreateAdOrderItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  packageId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  pricingId!: string;

  @ApiProperty({ required: false, default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity?: number;
}
