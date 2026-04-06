import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdOrderStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class AdminApproveOrderDto {
  @ApiPropertyOptional({
    description: 'Optional reason or notes for approval',
    example: 'All assets verified and approved',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class AdminRejectOrderDto {
  @ApiProperty({
    description: 'Reason for rejection',
    example: 'Assets do not meet quality standards',
    maxLength: 1000,
  })
  @IsString()
  @MaxLength(1000)
  reason: string;
}

export class AdminEditOrderAssetDto {
  @ApiProperty({ description: 'Asset type (e.g. main_image, logo, banner)' })
  @IsString()
  assetType: string;

  @ApiProperty({ description: 'Publicly accessible URL of the uploaded file' })
  @IsUrl({
    require_tld: false,
    require_protocol: true,
  })
  fileUrl: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  fileSizeKb?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class AdminEditOrderItemDto {
  @ApiProperty({ description: 'ID of the existing order item to update' })
  @IsString()
  itemId: string;

  @ApiPropertyOptional({ description: 'New destination URL for the ad' })
  @IsOptional()
  @IsUrl()
  adLinkUrl?: string;

  @ApiPropertyOptional({ description: 'New start date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  designServiceRequired?: boolean;

  @ApiPropertyOptional({
    description:
      'If provided, replaces ALL existing assets for this item with the new list',
    type: [AdminEditOrderAssetDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminEditOrderAssetDto)
  assets?: AdminEditOrderAssetDto[];
}

export class AdminNewOrderItemDto {
  @ApiProperty({ description: 'Pricing ID of the package to add' })
  @IsString()
  pricingId: string;

  @ApiProperty({ description: 'Start date (ISO 8601)' })
  @IsDateString()
  startDate: string;

  @ApiProperty()
  @IsBoolean()
  designServiceRequired: boolean;

  @ApiPropertyOptional({
    description:
      'Destination URL for the ad (not required for PER_ACTION packages)',
  })
  @IsOptional()
  @IsUrl()
  adLinkUrl?: string;
}

export class AdminEditPendingOrderDto {
  @ApiPropertyOptional({
    description: 'Update order-level notes',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({
    description: 'Partial updates for existing order items',
    type: [AdminEditOrderItemDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminEditOrderItemDto)
  items?: AdminEditOrderItemDto[];

  @ApiPropertyOptional({
    description:
      'Item IDs to remove from the order. Blocked if all items would be removed.',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  deleteItemIds?: string[];

  @ApiPropertyOptional({
    description:
      'Homepage Popup add-on items to append (POPUP_PRIORITY_DETAILS_LINK, POPUP_ROTATION_DETAILS_LINK, or POPUP_RANKING_ADJUSTMENT only)',
    type: [AdminNewOrderItemDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminNewOrderItemDto)
  newItems?: AdminNewOrderItemDto[];
}

export class AdminOrderActionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: AdOrderStatus })
  status: AdOrderStatus;

  @ApiProperty()
  lastUpdatedBy: string;

  @ApiProperty()
  lastUpdatedAt: Date;

  @ApiPropertyOptional()
  reason?: string;

  @ApiPropertyOptional()
  message: string;
}
