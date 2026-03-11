import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  AdCategoryType,
  AdOrderStatus,
  AdPackageType,
  DurationUnit,
  PricingModel,
} from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class AdminListOrdersQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by order status',
    enum: AdOrderStatus,
    example: AdOrderStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(AdOrderStatus)
  status?: AdOrderStatus;

  @ApiPropertyOptional({
    description: 'Search by company name or user email',
    example: 'acme corp',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Page number (1-based)',
    example: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Sort field',
    enum: ['createdAt', 'updatedAt', 'totalAmount'],
    example: 'createdAt',
  })
  @IsOptional()
  @IsString()
  sortBy?: 'createdAt' | 'updatedAt' | 'totalAmount' = 'createdAt';

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    example: 'desc',
  })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';
}

export class AdminOrderItemDto {
  @ApiPropertyOptional()
  id: string;

  @ApiPropertyOptional()
  pricingId: string;

  @ApiPropertyOptional()
  packageId: string;

  @ApiPropertyOptional()
  packageName: string;

  @ApiPropertyOptional({
    description: 'Ad package type',
    enum: AdPackageType,
  })
  packageType: AdPackageType;

  @ApiPropertyOptional()
  pricingName: string;

  @ApiPropertyOptional({
    description: 'Pricing model of the selected package pricing',
    enum: PricingModel,
  })
  pricingModel: PricingModel;

  @ApiPropertyOptional({
    description: 'Ad package category type',
    enum: AdCategoryType,
  })
  categoryType: AdCategoryType | null;

  @ApiPropertyOptional({
    description: 'Selected duration value for this order item',
    example: 3,
  })
  durationValue: number | null;

  @ApiPropertyOptional({
    description: 'Selected duration unit for this order item',
    enum: DurationUnit,
  })
  durationUnit: DurationUnit | null;

  @ApiPropertyOptional()
  price: number;

  @ApiPropertyOptional()
  designServiceRequired: boolean;

  @ApiPropertyOptional()
  startDate: Date;

  @ApiPropertyOptional()
  adLinkUrl?: string;

  @ApiPropertyOptional()
  assets: Array<{
    id: string;
    fileUrl: string;
    fileSizeKb: number;
    assetType: string;
  }>;

  @ApiPropertyOptional({
    description: 'Raw metadata from the related ad package',
  })
  packageMetadata?: Record<string, unknown> | null;
}

export class AdminOrderDto {
  @ApiPropertyOptional()
  id: string;

  @ApiPropertyOptional()
  status: AdOrderStatus;

  @ApiPropertyOptional()
  totalAmount: number;

  @ApiPropertyOptional()
  createdAt: Date;

  @ApiPropertyOptional()
  updatedAt: Date;

  @ApiPropertyOptional()
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };

  @ApiPropertyOptional()
  company?: {
    id: string;
    nameVi: string | null;
    nameCn: string | null;
    email: string;
    contactName: string;
    phone: string;
  };

  @ApiPropertyOptional({ type: [AdminOrderItemDto] })
  items: AdminOrderItemDto[];
}

export class AdminListOrdersResponseDto {
  @ApiPropertyOptional({ type: [AdminOrderDto] })
  orders: AdminOrderDto[];

  @ApiPropertyOptional()
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
