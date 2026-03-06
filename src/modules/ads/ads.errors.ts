export const AdsErrors = {
  CATEGORY_NOT_FOUND: {
    code: 'ADS_CATEGORY_NOT_FOUND',
    message: 'Ad package category not found',
  },
  INVALID_CATEGORY_TYPE: {
    code: 'ADS_INVALID_CATEGORY_TYPE',
    message: 'Invalid category type',
  },
  CATEGORY_TYPE_EXISTS: {
    code: 'ADS_CATEGORY_TYPE_EXISTS',
    message: 'Category type already exists',
  },
} as const;

export type AdsErrorKey = keyof typeof AdsErrors;
