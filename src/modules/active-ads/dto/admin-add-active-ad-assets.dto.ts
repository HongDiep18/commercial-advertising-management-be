import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class AdminAddActiveAdAssetDto {
  @ApiProperty({
    description: 'Asset type identifier (e.g. banner, logo, popup_image)',
    example: 'banner',
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  assetType!: string;

  @ApiProperty({
    description: 'File URL for this asset (upload using /files/upload first)',
    example: 'http://localhost:9000/vn-buyer-guide/ad-assets/uuid.png',
  })
  @IsString()
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  fileUrl!: string;

  @ApiProperty({
    description: 'Optional file size in KB',
    example: 245,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000)
  fileSizeKb?: number;

  @ApiProperty({
    description: 'Optional notes for admin tracking',
    example: 'Cropped to 1:1',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class AdminAddActiveAdAssetsDto {
  @ApiProperty({
    description: 'Assets to attach to the active ad',
    type: AdminAddActiveAdAssetDto,
    isArray: true,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AdminAddActiveAdAssetDto)
  assets!: AdminAddActiveAdAssetDto[];
}

export class AdminAddActiveAdAssetsResponseDto {
  @ApiProperty({ description: 'Number of assets created', example: 2 })
  createdCount!: number;
}
