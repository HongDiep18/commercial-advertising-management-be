import { AdPackageType } from '@prisma/client';
import type {
  ActiveAdInfo,
  AdEffect,
  AdEffectContext,
  CompanyData,
} from '../interfaces/ad-effect.interface';

/**
 * Effect for COMPANY_INFO_HIGHLIGHT
 * Sets companyInfoHighlight flag to true
 */
export class CompanyInfoHighlightEffect implements AdEffect {
  readonly packageType = AdPackageType.COMPANY_INFO_HIGHLIGHT;

  shouldApply(activeAds: ActiveAdInfo[]): boolean {
    return activeAds.some(
      (ad) => ad.packageType === AdPackageType.COMPANY_INFO_HIGHLIGHT,
    );
  }

  apply(context: AdEffectContext): CompanyData {
    const hasCompanyInfoHighlight = context.activeAds.some(
      (ad) => ad.packageType === AdPackageType.COMPANY_INFO_HIGHLIGHT,
    );

    if (hasCompanyInfoHighlight) {
      return {
        ...context.company,
        companyInfoHighlight: true,
      };
    }

    return { ...context.company };
  }
}
