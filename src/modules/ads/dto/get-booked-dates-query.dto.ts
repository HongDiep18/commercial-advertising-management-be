import { ApiProperty } from '@nestjs/swagger';
import { AdPackageType } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class GetBookedDatesQueryDto {
  @ApiProperty({
    enum: AdPackageType,
    description: 'The slot-limited package type to check availability for',
    example: AdPackageType.POPUP_PRIORITY_SLOT,
  })
  @IsEnum(AdPackageType)
  packageType: AdPackageType;
}
