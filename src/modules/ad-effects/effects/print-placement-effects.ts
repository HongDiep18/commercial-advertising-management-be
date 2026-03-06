import { AdPackageType } from '@prisma/client';
import type {
  ActiveAdInfo,
  AdEffect,
  AdEffectContext,
  CompanyData,
} from '../interfaces/ad-effect.interface';

/**
 * Effect for PRINT_PLACEMENT
 * Adds metadata from the ad package to company data
 */
export class PrintPlacementEffect implements AdEffect {
  readonly packageType = AdPackageType.PRINT_PLACEMENT;

  shouldApply(activeAds: ActiveAdInfo[]): boolean {
    return activeAds.some(
      (ad) => ad.packageType === AdPackageType.PRINT_PLACEMENT,
    );
  }

  apply(context: AdEffectContext): CompanyData {
    const printPlacementAds = context.activeAds.filter(
      (ad) => ad.packageType === AdPackageType.PRINT_PLACEMENT,
    );

    if (printPlacementAds.length > 0) {
      // Merge metadata from all PRINT_PLACEMENT ads
      const mergedMetadata: Record<string, unknown> = {
        ...context.company.metadata,
        printPlacements: printPlacementAds.map((ad) => ({
          adId: ad.id,
          orderItemId: ad.orderItemId,
          metadata: ad.metadata || {},
        })),
      };

      return {
        ...context.company,
        metadata: mergedMetadata,
      };
    }

    return { ...context.company };
  }
}
