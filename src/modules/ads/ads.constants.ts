import { AdPackageType } from '@prisma/client';

/** Placeholder end date for ads with no expiry (ONE_TIME / indefinite). */
export const SENTINEL_DATE = new Date('2999-12-31T00:00:00.000Z');

/** Max concurrent occupants per slot-limited package type. */
export const SLOT_CAPACITY: Partial<Record<AdPackageType, number>> = {
  [AdPackageType.POPUP_PRIORITY_SLOT]: 1,
  [AdPackageType.POPUP_ROTATION_SLOT]: 4,
};

/** Package types that have a finite slot capacity. */
export const SLOT_LIMITED_PACKAGE_TYPES = Object.keys(
  SLOT_CAPACITY,
) as AdPackageType[];

/** Describes which order form fields are relevant for a given package type. */
export type AdPackageFormConfig = {
  requiresStartDate: boolean;
  requiresAdLink: boolean;
  requiresDesignService: boolean;
  requiresAssets: boolean;
};

const DEFAULT_FORM_CONFIG: AdPackageFormConfig = {
  requiresStartDate: true,
  requiresAdLink: true,
  requiresDesignService: true,
  requiresAssets: true,
};

const RENDER_AD_IMAGE_FORM_CONFIG: AdPackageFormConfig = {
  requiresStartDate: true,
  requiresDesignService: true,
  requiresAssets: true,
  requiresAdLink: false,
};

const ONLY_DATE_FORM_CONFIG: AdPackageFormConfig = {
  requiresStartDate: true,
  requiresDesignService: false,
  requiresAssets: false,
  requiresAdLink: false,
};

const ONLY_AD_LINK_FORM_CONFIG: AdPackageFormConfig = {
  requiresStartDate: false,
  requiresDesignService: false,
  requiresAssets: false,
  requiresAdLink: true,
};

const NO_FIELDS_FORM_CONFIG: AdPackageFormConfig = {
  requiresStartDate: false,
  requiresDesignService: false,
  requiresAssets: false,
  requiresAdLink: false,
};

/** Per-type overrides — only list fields that differ from the default. */
const PACKAGE_FORM_CONFIG: Partial<Record<AdPackageType, AdPackageFormConfig>> =
  {
    [AdPackageType.POPUP_PRIORITY_SLOT]: RENDER_AD_IMAGE_FORM_CONFIG,
    [AdPackageType.POPUP_ROTATION_SLOT]: RENDER_AD_IMAGE_FORM_CONFIG,
    [AdPackageType.POPUP_RANKING_ADJUSTMENT]: NO_FIELDS_FORM_CONFIG,
    [AdPackageType.POPUP_ROTATION_DETAILS_LINK]: ONLY_AD_LINK_FORM_CONFIG,
    [AdPackageType.POPUP_PRIORITY_DETAILS_LINK]: ONLY_AD_LINK_FORM_CONFIG,
    [AdPackageType.FEATURED_HOMEPAGE_DISPLAY]: RENDER_AD_IMAGE_FORM_CONFIG,
    [AdPackageType.FEATURED_HIGHLIGHT_BOOST]: ONLY_DATE_FORM_CONFIG,
    [AdPackageType.COMPANY_CATEGORY_TOP]: ONLY_DATE_FORM_CONFIG,
    [AdPackageType.COMPANY_INFO_HIGHLIGHT]: ONLY_DATE_FORM_CONFIG,
  };

/** Returns the form config for a package type, falling back to the default. */
export function getPackageFormConfig(type: AdPackageType): AdPackageFormConfig {
  return PACKAGE_FORM_CONFIG[type] ?? DEFAULT_FORM_CONFIG;
}
