import { ApiProperty } from '@nestjs/swagger';
import { AdPackageType } from '@prisma/client';
import { IsIn } from 'class-validator';
import { SLOT_LIMITED_PACKAGE_TYPES } from '../ads.constants';

export class GetBookedDatesQueryDto {
  @ApiProperty({
    enum: SLOT_LIMITED_PACKAGE_TYPES,
    description:
      'The slot-limited package type to check availability for. ' +
      'Only slot-limited types are accepted (POPUP_PRIORITY_SLOT, POPUP_ROTATION_SLOT).',
    example: AdPackageType.POPUP_PRIORITY_SLOT,
  })
  @IsIn(SLOT_LIMITED_PACKAGE_TYPES)
  packageType: AdPackageType;
}
