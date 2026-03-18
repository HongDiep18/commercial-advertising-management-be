// Re-export Prisma's MembershipTier to avoid type conflicts
export { MembershipTier } from '@prisma/client';
import { MembershipTier } from '@prisma/client';

export const REGISTRATION_MEMBERSHIP_LEVELS: MembershipTier[] = [
  MembershipTier.NONE,
  MembershipTier.BRONZE,
  MembershipTier.SILVER,
  MembershipTier.GOLD,
  MembershipTier.DIAMOND,
];

export const TIER_THRESHOLDS = {
  [MembershipTier.BRONZE]: { points: 50_000, spending: 0 },
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
  if (totalPoints >= TIER_THRESHOLDS[MembershipTier.BRONZE].points) {
    return MembershipTier.BRONZE;
  }
  return MembershipTier.NONE;
}
