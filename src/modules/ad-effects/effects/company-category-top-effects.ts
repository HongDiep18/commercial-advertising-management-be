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
    const currentPriority = context.company.sortPriority ?? 0;

    if (hasCategoryTop) {
      return {
        ...context.company,
        sortPriority: currentPriority + 1,
      };
    }

    return { ...context.company };
  }
}
