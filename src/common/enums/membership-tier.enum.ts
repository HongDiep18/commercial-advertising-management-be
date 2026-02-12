export enum MembershipTier {
  NONE = 'NONE',
  COPPER = 'COPPER',
  SILVER = 'SILVER',
  GOLD = 'GOLD',
  DIAMOND = 'DIAMOND',
}

export const TIER_THRESHOLDS = {
  [MembershipTier.COPPER]: { points: 50_000, spending: 0 },
  [MembershipTier.SILVER]: { points: 150_000, spending: 80_000 },
  [MembershipTier.GOLD]: { points: 300_000, spending: 230_000 },
  [MembershipTier.DIAMOND]: { points: 600_000, spending: 530_000 },
};

export function calculateTier(
  totalPoints: number,
  totalSpending: number,
): MembershipTier {
  if (
    totalPoints >= TIER_THRESHOLDS[MembershipTier.DIAMOND].points &&
    totalSpending >= TIER_THRESHOLDS[MembershipTier.DIAMOND].spending
  ) {
    return MembershipTier.DIAMOND;
  }
  if (
    totalPoints >= TIER_THRESHOLDS[MembershipTier.GOLD].points &&
    totalSpending >= TIER_THRESHOLDS[MembershipTier.GOLD].spending
  ) {
    return MembershipTier.GOLD;
  }
  if (
    totalPoints >= TIER_THRESHOLDS[MembershipTier.SILVER].points &&
    totalSpending >= TIER_THRESHOLDS[MembershipTier.SILVER].spending
  ) {
    return MembershipTier.SILVER;
  }
  if (totalPoints >= TIER_THRESHOLDS[MembershipTier.COPPER].points) {
    return MembershipTier.COPPER;
  }
  return MembershipTier.NONE;
}
