import { AdPackageType } from '@prisma/client';
import type {
  ActiveAdInfo,
  AdEffect,
  AdEffectContext,
  CompanyData,
} from '../interfaces/ad-effect.interface';

/**
 * Effect for COMPANY_CATEGORY_TOP
 * Increases sort priority to move companies to the top of category listings
 */
export class CompanyCategoryTopEffect implements AdEffect {
  readonly packageType = AdPackageType.COMPANY_CATEGORY_TOP;

  shouldApply(activeAds: ActiveAdInfo[]): boolean {
    return activeAds.some(
      (ad) => ad.packageType === AdPackageType.COMPANY_CATEGORY_TOP,
    );
  }

  apply(context: AdEffectContext): CompanyData {
    const hasCategoryTop = context.activeAds.some(
      (ad) => ad.packageType === AdPackageType.COMPANY_CATEGORY_TOP,
    );

    if (hasCategoryTop) {
      return {
        ...context.company,
        sortPriority: 500, // High priority for category top placement
      };
    }

    return { ...context.company };
  }
}
