export const AUDIT_ENTITY = {
  COMPANY_PROFILE_REQUEST: 'CompanyProfileRequest',
  USER: 'User',
  COMPANY: 'Company',
  AD_ORDER: 'AdOrder',
  AD_PRICING: 'AdPackagePricing',
  ACTIVE_AD: 'ActiveAd',
  LOYALTY_TRANSACTION: 'LoyaltyTransaction',
} as const;

export const AUDIT_ACTION = {
  // User actions
  SET_PASSWORD_USED: 'user.set_password_used',
  USER_PASSWORD_CHANGED: 'user.password_changed',
  USER_PROFILE_UPDATED: 'user.profile_updated',
  USER_ACTIVE_CHANGED: 'user.active_changed',
  USER_SOFT_DELETED: 'user.soft_deleted',

  // Company profile request actions
  PROFILE_REQUEST_CREATED: 'profile_request.created',
  PROFILE_REQUEST_STATUS_CHANGED: 'profile_request.status_changed',
  PROFILE_REQUEST_APPROVED: 'profile_request.approved',
  PROFILE_REQUEST_REJECTED: 'profile_request.rejected',

  // Company actions
  COMPANY_CREATED: 'company.created',
  COMPANY_UPDATED: 'company.updated',

  // Ad order actions
  AD_ORDER_CREATED: 'ad_order.created',
  AD_ORDER_APPROVED: 'ad_order.approved',
  AD_ORDER_REJECTED: 'ad_order.rejected',

  // Ad pricing actions
  AD_PRICING_CREATED: 'ad_pricing.created',
  AD_PRICING_UPDATED: 'ad_pricing.updated',
  AD_PRICING_DELETED: 'ad_pricing.deleted',

  // Active ad actions
  ACTIVE_AD_CREATED: 'active_ad.created',
  ACTIVE_AD_MANUALLY_CREATED: 'active_ad.manually_created',

  // Loyalty actions
  LOYALTY_POINTS_AWARDED: 'loyalty.points_awarded',
  LOYALTY_POINTS_DEDUCTED: 'loyalty.points_deducted',
  LOYALTY_TIER_CHANGED: 'loyalty.tier_changed',
  LOYALTY_TIER_RECALCULATED: 'loyalty.tier_recalculated',
} as const;
