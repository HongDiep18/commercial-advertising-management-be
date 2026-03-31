import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdPackageType } from '@prisma/client';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

const COMPANY_POPUP_ADDON_TYPES = [
  AdPackageType.POPUP_RANKING_ADJUSTMENT,
  AdPackageType.POPUP_VIEW_DETAILS_LINK,
  AdPackageType.POPUP_PRIORITY_DETAILS_LINK,
  AdPackageType.POPUP_ROTATION_DETAILS_LINK,
] as const;

export class AdminCreateCompanyPopupAddonDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  companyId!: string;

  @ApiProperty({
    enum: COMPANY_POPUP_ADDON_TYPES,
    description:
      'Only ranking adjustment or view-details link popup add-ons are allowed.',
  })
  @IsIn([...COMPANY_POPUP_ADDON_TYPES])
  packageType!: (typeof COMPANY_POPUP_ADDON_TYPES)[number];

  @ApiProperty({ type: String, format: 'date-time' })
  @IsDateString()
  startDate!: string;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'Optional end of the active period.',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string | null;

  @ApiProperty({
    description: 'Target link URL for the ad',
    maxLength: 2048,
  })
  @IsString()
  @MaxLength(2048)
  adLinkUrl!: string;
}
