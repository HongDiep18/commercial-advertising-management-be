import { AdPackageType as AdPackageTypeEnum } from '@prisma/client';
import type { AdPackageType } from '@prisma/client';

/** Placeholder end date for ads with no expiry (ONE_TIME / indefinite). */
export const SENTINEL_DATE = new Date('2999-12-31T00:00:00.000Z');

/** Max concurrent occupants per slot-limited package type. */
export const SLOT_CAPACITY: Partial<Record<AdPackageType, number>> = {
  [AdPackageTypeEnum.POPUP_PRIORITY_SLOT]: 1,
  [AdPackageTypeEnum.POPUP_ROTATION_SLOT]: 4,
};

/** Package types that have a finite slot capacity. */
export const SLOT_LIMITED_PACKAGE_TYPES = Object.keys(
  SLOT_CAPACITY,
) as AdPackageType[];
