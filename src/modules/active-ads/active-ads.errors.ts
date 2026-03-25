export const ActiveAdsErrors = {
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
