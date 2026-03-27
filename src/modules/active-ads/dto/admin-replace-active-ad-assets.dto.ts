import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class AdminReplaceAssetItemDto {
  @ApiProperty({ description: 'Public URL of the uploaded asset file' })
  @IsString()
  fileUrl!: string;

  @ApiProperty({
    description: 'Asset type (e.g. popup_image, banner, logo)',
  })
  @IsString()
  assetType!: string;

  @ApiPropertyOptional({ description: 'Optional note for this asset' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class AdminReplaceActiveAdAssetsDto {
  @ApiProperty({
    type: [AdminReplaceAssetItemDto],
    description:
      'Full replacement list of assets. All existing assets will be deleted and replaced with this list. Can be an empty array to delete all assets.',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminReplaceAssetItemDto)
  assets!: AdminReplaceAssetItemDto[];
}
