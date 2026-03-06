import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DurationUnit, PricingModel } from '@prisma/client';

export class AdminPricingResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  packageId!: string;

  @ApiProperty({ enum: PricingModel })
  pricingModel!: PricingModel;

  @ApiPropertyOptional({ minimum: 1 })
  durationValue?: number | null;

  @ApiPropertyOptional({ enum: DurationUnit })
  durationUnit?: DurationUnit | null;

  @ApiProperty({ minimum: 1, example: 50000 })
  basePrice!: number;

  @ApiProperty({ minimum: 0, maximum: 100, example: 10.5 })
  discountRate!: number;

  @ApiProperty({ minimum: 1, example: 45000 })
  finalPrice!: number;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;
}

export class AdminPricingListQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by package ID',
    format: 'uuid',
  })
  packageId?: string;

  @ApiPropertyOptional({
    description: 'Filter by pricing model',
    enum: PricingModel,
  })
  pricingModel?: PricingModel;

  @ApiPropertyOptional({
    description: 'Filter by active status',
    example: true,
  })
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Page number (1-based)',
    minimum: 1,
    default: 1,
  })
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  limit?: number = 20;
}

export class AdminPricingListResponseDto {
  @ApiProperty({ type: [AdminPricingResponseDto] })
  pricing!: AdminPricingResponseDto[];

  @ApiProperty({
    description: 'Pagination information',
    example: {
      page: 1,
      limit: 20,
      total: 150,
      totalPages: 8,
    },
  })
  pagination!: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
