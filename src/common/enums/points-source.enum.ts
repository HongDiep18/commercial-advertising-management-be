export enum PointsSource {
  // One-time bonuses
  REGISTRATION = 'REGISTRATION',
  LOGO_UPLOAD = 'LOGO_UPLOAD',

  // Repeatable - Commercial
  AD_PURCHASE = 'AD_PURCHASE',
  STORE_PURCHASE = 'STORE_PURCHASE',

  // Admin adjustments
  ADMIN_ADJUSTMENT = 'ADMIN_ADJUSTMENT',
  ADMIN_DEDUCTION = 'ADMIN_DEDUCTION',
}

export const POINTS_VALUES: Record<PointsSource, number | 'DYNAMIC'> = {
  // One-time
  [PointsSource.REGISTRATION]: 50000,
  [PointsSource.LOGO_UPLOAD]: 20000,

  // Commercial (amount-based)
  [PointsSource.AD_PURCHASE]: 'DYNAMIC', // 1 VND = 1 point
  [PointsSource.STORE_PURCHASE]: 'DYNAMIC', // 1 VND = 1 point

  // Admin
  [PointsSource.ADMIN_ADJUSTMENT]: 'DYNAMIC',
  [PointsSource.ADMIN_DEDUCTION]: 'DYNAMIC',
};
