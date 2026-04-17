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
  ORDER_ACCESS_DENIED: {
    code: 'AD_ORDER_NOT_OWNER',
    message: 'You do not have access to this order',
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
  ORDER_NOT_EDITABLE: {
    code: 'AD_ORDER_NOT_EDITABLE',
    message: 'Only draft or pending orders can be edited',
  },
  ORDER_CANNOT_BE_EMPTY: {
    code: 'AD_ORDER_CANNOT_BE_EMPTY',
    message: 'Cannot remove all items from an order',
  },
  ADDON_INVALID_TYPE: {
    code: 'AD_ORDER_ADDON_INVALID_TYPE',
    message:
      'Add-on packages must be Homepage Popup add-ons (Details Link or Ranking Adjustment)',
  },
  ADDON_REQUIRES_BASE_PACKAGE: {
    code: 'AD_ORDER_ADDON_REQUIRES_BASE',
    message: 'Order must contain a Homepage Popup base package to add add-ons',
  },
  EDIT_ITEM_NOT_IN_ORDER: {
    code: 'AD_ORDER_EDIT_ITEM_NOT_FOUND',
    message: 'One or more item IDs do not belong to this order',
  },
  ORDER_COMPANY_REQUIRED: {
    code: 'AD_ORDER_COMPANY_REQUIRED',
    message: 'Order must be associated with a company to activate ads',
  },
  SLOT_NOT_AVAILABLE: {
    code: 'AD_ORDER_SLOT_NOT_AVAILABLE',
    message: 'This ad slot is fully booked for the requested date range',
  },
} as const;

export type AdOrdersErrorKey = keyof typeof AdOrdersErrors;
