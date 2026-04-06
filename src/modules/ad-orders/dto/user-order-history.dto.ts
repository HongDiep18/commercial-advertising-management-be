import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { AdOrderStatus } from '@prisma/client';

export class UserOrderHistoryQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by order status',
    enum: AdOrderStatus,
    example: AdOrderStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(AdOrderStatus)
  status?: AdOrderStatus;

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
    example: 10,
    minimum: 1,
    maximum: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Sort field',
    enum: ['createdAt', 'updatedAt', 'totalAmount'],
    example: 'createdAt',
  })
  @IsOptional()
  sortBy?: 'createdAt' | 'updatedAt' | 'totalAmount' = 'createdAt';

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    example: 'desc',
  })
  @IsOptional()
  sortOrder?: 'asc' | 'desc' = 'desc';
}

export class UserOrderItemDto {
  @ApiPropertyOptional()
  id: string;

  @ApiPropertyOptional()
  pricingId: string;

  @ApiPropertyOptional()
  packageName: string;

  @ApiProperty({
    description: 'AdPackageType value for this line item',
  })
  packageType: string;

  @ApiPropertyOptional()
  pricingName: string;

  @ApiPropertyOptional()
  price: number;

  @ApiPropertyOptional()
  designServiceRequired: boolean;

  @ApiPropertyOptional()
  startDate: Date;

  @ApiPropertyOptional()
  durationValue: number | null;

  @ApiPropertyOptional({ enum: ['DAY', 'WEEK', 'MONTH', 'YEAR'] })
  durationUnit: string | null;

  @ApiPropertyOptional()
  adLinkUrl?: string;

  @ApiPropertyOptional()
  assetsCount: number;
}

export class UserOrderDto {
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
  submittedAt?: Date;

  @ApiPropertyOptional({ type: [UserOrderItemDto] })
  items: UserOrderItemDto[];
}

export class UserOrderHistoryResponseDto {
  @ApiPropertyOptional({ type: [UserOrderDto] })
  orders: UserOrderDto[];

  @ApiPropertyOptional()
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
