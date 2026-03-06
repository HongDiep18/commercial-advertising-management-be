import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class UploadAdOrderAssetDto {
  @ApiProperty({
    description: 'Pricing identifier this asset belongs to',
    format: 'uuid',
  })
  @IsString()
  pricingId!: string;

  @ApiProperty({
    description: 'Logical asset type, e.g. main_image, logo, banner',
    example: 'main_image',
  })
  @IsString()
  assetType!: string;

  @ApiProperty({
    description: 'Public URL of the uploaded file in object storage',
  })
  @IsString()
  fileUrl!: string;

  @ApiPropertyOptional({
    description: 'File size in kilobytes',
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  fileSizeKb?: number;

  @ApiPropertyOptional({
    description: 'Optional notes or description for this asset',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UploadAdOrderAssetsDto {
  @ApiPropertyOptional({
    description: 'Optional list of assets to attach to the order items',
    type: [UploadAdOrderAssetDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UploadAdOrderAssetDto)
  assets?: UploadAdOrderAssetDto[];
}

export class AttachAdOrderAssetsFormDto {
  @ApiPropertyOptional({
    description:
      'Optional pricing IDs, one per file. Repeat the same ID to attach multiple assets to the same order item.',
    type: [String],
    format: 'uuid',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }: { value: string | string[] }) => {
    if (Array.isArray(value)) {
      return value;
    }
    if (typeof value === 'string' && value.includes(',')) {
      return value
        .split(',')
        .map((v) => v.trim())
        .filter((v) => v.length > 0);
    }
    return value ? [value] : [];
  })
  pricingIds?: string[];

  @ApiPropertyOptional({
    description:
      'Optional asset types, one per file (e.g. main_image, logo, banner).',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }: { value: string | string[] }) => {
    if (Array.isArray(value)) {
      return value;
    }
    if (typeof value === 'string' && value.includes(',')) {
      return value
        .split(',')
        .map((v) => v.trim())
        .filter((v) => v.length > 0);
    }
    return value ? [value] : [];
  })
  assetTypes?: string[];

  @ApiPropertyOptional({
    description:
      'Optional field used by some multipart clients. If no files are uploaded, send nothing. If sent as an empty string, it will be ignored.',
  })
  @IsOptional()
  @IsString()
  files?: string;
}
