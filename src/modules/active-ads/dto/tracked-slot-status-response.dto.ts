import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdPackageType } from '@prisma/client';

export class TrackedSlotAdItemResponseDto {
  @ApiProperty({
    description: 'Data source for this slot entry',
    enum: ['active_ad', 'pending_order'],
    example: 'active_ad',
  })
  source!: 'active_ad' | 'pending_order';

  @ApiPropertyOptional({
    description: 'Active ad ID when the source is active_ad',
    format: 'uuid',
    nullable: true,
  })
  activeAdId!: string | null;

  @ApiPropertyOptional({
    description: 'Order ID related to this ad item',
    format: 'uuid',
    nullable: true,
  })
  orderId!: string | null;

  @ApiPropertyOptional({
    description: 'Order item ID related to this ad item',
    format: 'uuid',
    nullable: true,
  })
  orderItemId!: string | null;

  @ApiPropertyOptional({
    description: 'Company ID of the ad owner',
    format: 'uuid',
    nullable: true,
  })
  companyId!: string | null;

  @ApiPropertyOptional({
    description: 'Display name of the company',
    nullable: true,
    example: 'Công ty TNHH ABC',
  })
  companyName!: string | null;

  @ApiProperty({
    description: 'Ad start date',
    type: String,
    format: 'date-time',
  })
  startDate!: Date;

  @ApiPropertyOptional({
    description: 'Ad end date (null for non-duration ads)',
    type: String,
    format: 'date-time',
    nullable: true,
  })
  endDate!: Date | null;

  @ApiPropertyOptional({
    description: 'Ad click-through link URL',
    nullable: true,
    example: 'https://example.com/campaign',
  })
  adLinkUrl!: string | null;
}

export class TrackedAdSlotStatusResponseDto {
  @ApiProperty({
    description: 'Ad package type representing this tracked slot',
    enum: AdPackageType,
    example: AdPackageType.POPUP_PRIORITY_SLOT,
  })
  packageType!: AdPackageType;

  @ApiProperty({
    description: 'Display name of the tracked package',
    example: 'Priority Display (First Position)',
  })
  packageName!: string;

  @ApiPropertyOptional({
    description: 'Traditional Chinese display name of the tracked package',
    nullable: true,
    example: '優先展示（第一位）',
  })
  packageNameZh!: string | null;

  @ApiProperty({
    description: 'Whether this slot currently has at least one active ad',
    example: true,
  })
  hasActiveAds!: boolean;

  @ApiPropertyOptional({
    description:
      'Nearest end date among currently active ads for this slot (null if no active duration ads)',
    type: String,
    format: 'date-time',
    nullable: true,
  })
  expiresAt!: Date | null;

  @ApiProperty({
    description: 'Ads currently active in this slot',
    type: TrackedSlotAdItemResponseDto,
    isArray: true,
  })
  activeAds!: TrackedSlotAdItemResponseDto[];

  @ApiProperty({
    description: 'Ads in this slot that are already expired',
    type: TrackedSlotAdItemResponseDto,
    isArray: true,
  })
  expiredAds!: TrackedSlotAdItemResponseDto[];

  @ApiProperty({
    description:
      'Ads waiting in this slot (includes scheduled active ads and PENDING order items)',
    type: TrackedSlotAdItemResponseDto,
    isArray: true,
  })
  waitingAds!: TrackedSlotAdItemResponseDto[];
}
