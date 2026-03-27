export const ActiveAdsErrors = {
  SLOT_NOT_AVAILABLE: {
    code: 'ADS_SLOT_NOT_AVAILABLE',
    message: 'This ad slot is fully booked for the requested date range.',
  },
  ACTIVE_AD_NOT_FOUND: {
    code: 'ACTIVE_ADS_ACTIVE_AD_NOT_FOUND',
    message: 'Active ad not found',
  },
  ACTIVE_AD_ASSET_NOT_FOUND: {
    code: 'ACTIVE_ADS_ACTIVE_AD_ASSET_NOT_FOUND',
    message: 'Active ad asset not found',
  },
  COMPANY_NOT_FOUND: {
    code: 'ACTIVE_ADS_COMPANY_NOT_FOUND',
    message: 'Company not found',
  },
  PRICING_NOT_FOUND: {
    code: 'ACTIVE_ADS_PRICING_NOT_FOUND',
    message: 'Ad package pricing not found',
  },
  INVALID_ADDON_DATE_RANGE: {
    code: 'ACTIVE_ADS_INVALID_ADDON_DATE_RANGE',
    message: 'End date must be after start date',
  },
  INVALID_ADDON_PACKAGE_TYPE: {
    code: 'ACTIVE_ADS_INVALID_ADDON_PACKAGE_TYPE',
    message: 'Only popup ranking adjustment or view-details link add-ons are allowed',
  },
  ACTIVE_AD_ASSETS_FILES_REQUIRED: {
    code: 'ACTIVE_ADS_ACTIVE_AD_ASSETS_FILES_REQUIRED',
    message: 'At least one file is required',
  },
  ACTIVE_AD_ASSETS_ASSET_TYPES_LENGTH_MISMATCH: {
    code: 'ACTIVE_ADS_ACTIVE_AD_ASSETS_ASSET_TYPES_LENGTH_MISMATCH',
    message: 'assetTypes length must match files length',
  },
  ACTIVE_AD_ASSETS_NOTES_LENGTH_MISMATCH: {
    code: 'ACTIVE_ADS_ACTIVE_AD_ASSETS_NOTES_LENGTH_MISMATCH',
    message: 'notes length must match files length',
  },
} as const;
