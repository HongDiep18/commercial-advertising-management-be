export const AdOrdersErrors = {
  COMPANY_NOT_FOUND: {
    code: 'AD_ORDER_COMPANY_NOT_FOUND',
    message: 'Company not found',
  },
  INVALID_ITEMS_EMPTY: {
    code: 'AD_ORDER_INVALID_ITEMS',
    message: 'At least one order item is required',
  },
  INVALID_ITEMS_DUPLICATE: {
    code: 'AD_ORDER_INVALID_ITEMS',
    message: 'Duplicate order items are not allowed',
  },
  INVALID_PRICING_SET: {
    code: 'AD_ORDER_INVALID_PRICING',
    message: 'One or more pricing options are invalid or inactive',
  },
  INVALID_PRICING_NOT_FOUND: {
    code: 'AD_ORDER_INVALID_PRICING',
    message: 'Pricing option not found',
  },
  INVALID_START_DATE_VALUE: {
    code: 'AD_ORDER_INVALID_START_DATE',
    message: 'Invalid startDate value',
  },
  USER_NOT_FOUND: {
    code: 'AD_ORDER_USER_NOT_FOUND',
    message: 'User not found',
  },
  INVALID_ASSETS_EMPTY: {
    code: 'AD_ORDER_INVALID_ASSETS',
    message: 'At least one asset is required',
  },
  ORDER_NOT_FOUND: {
    code: 'AD_ORDER_NOT_FOUND',
    message: 'Ad order not found',
  },
  ORDER_NOT_OWNER: {
    code: 'AD_ORDER_NOT_OWNER',
    message: 'You cannot modify this order',
  },
  ORDER_NOT_DRAFT: {
    code: 'AD_ORDER_NOT_DRAFT',
    message: 'Only draft orders can be updated with assets',
  },
  INVALID_ASSET_PRICING_REF: {
    code: 'AD_ORDER_INVALID_ASSET_PRICING',
    message:
      'One or more assets reference pricing options that do not belong to this order',
  },
  INVALID_ASSET_METADATA_REQUIRED: {
    code: 'AD_ORDER_INVALID_ASSETS',
    message: 'When files are provided, pricingIds and assetTypes are required',
  },
  INVALID_ASSET_METADATA_MISMATCH: {
    code: 'AD_ORDER_INVALID_ASSETS',
    message:
      'Number of files must match number of pricingIds and assetTypes entries',
  },
  ORDER_NOT_PENDING: {
    code: 'AD_ORDER_NOT_PENDING',
    message: 'Only pending orders can be approved or rejected',
  },
  ORDER_COMPANY_REQUIRED: {
    code: 'AD_ORDER_COMPANY_REQUIRED',
    message: 'Order must be associated with a company to activate ads',
  },
} as const;

export type AdOrdersErrorKey = keyof typeof AdOrdersErrors;
