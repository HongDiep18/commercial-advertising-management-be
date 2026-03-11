import { ApiProperty } from '@nestjs/swagger';

export class AdminOrdersStatusCountsDto {
  @ApiProperty()
  pending: number;

  @ApiProperty()
  approved: number;

  @ApiProperty()
  rejected: number;

  @ApiProperty()
  total: number;
}

export class AdminOrdersMetricsResponseDto {
  @ApiProperty({
    description:
      'Total revenue for approved ad orders in the current calendar month',
    example: 2450000,
  })
  currentMonthRevenue: number;

  @ApiProperty({
    description:
      'Order status counts for ad orders created in the current calendar month',
    type: AdminOrdersStatusCountsDto,
  })
  currentMonthOrders: AdminOrdersStatusCountsDto;

  @ApiProperty({
    description:
      'Revenue growth compared to last month in percentage. 0 if last month had no revenue.',
    example: 18.5,
  })
  monthlyGrowthPercentage: number;
}

