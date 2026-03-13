import { AdPackageType } from '@prisma/client';
import type {
  ActiveAdInfo,
  AdEffect,
  AdEffectContext,
  CompanyData,
} from '../interfaces/ad-effect.interface';

/**
 * Effect for POPUP_PRIORITY_SLOT and POPUP_ROTATION_SLOT
 * These ads make companies eligible for popup display
 */
export class PopupSlotEffect implements AdEffect {
  readonly packageType: AdPackageType;

  constructor(packageType: AdPackageType) {
    this.packageType = packageType;
  }

  shouldApply(activeAds: ActiveAdInfo[]): boolean {
    return activeAds.some(
      (ad) =>
        ad.packageType === AdPackageType.POPUP_PRIORITY_SLOT ||
        ad.packageType === AdPackageType.POPUP_ROTATION_SLOT,
    );
  }

  apply(context: AdEffectContext): CompanyData {
    return { ...context.company };
  }
}

/**
 * Effect for POPUP_VIEW_DETAILS_LINK
 * Adds ad_link_url to company data if the company has this ad active
 */
export class PopupViewDetailsLinkEffect implements AdEffect {
  readonly packageType = AdPackageType.POPUP_VIEW_DETAILS_LINK;

  shouldApply(activeAds: ActiveAdInfo[]): boolean {
    return activeAds.some(
      (ad) => ad.packageType === AdPackageType.POPUP_VIEW_DETAILS_LINK,
    );
  }

  apply(context: AdEffectContext): CompanyData {
    const viewDetailsAd = context.activeAds.find(
      (ad) => ad.packageType === AdPackageType.POPUP_VIEW_DETAILS_LINK,
    );

    if (viewDetailsAd?.adLinkUrl) {
      return {
        ...context.company,
        adLinkUrl: viewDetailsAd.adLinkUrl,
      };
    }

    return { ...context.company };
  }
}

/**
 * Effect for POPUP_RANKING_ADJUSTMENT
 * Increases sort priority for companies with this ad
 */
export class PopupRankingAdjustmentEffect implements AdEffect {
  readonly packageType = AdPackageType.POPUP_RANKING_ADJUSTMENT;

  shouldApply(activeAds: ActiveAdInfo[]): boolean {
    return activeAds.some(
      (ad) => ad.packageType === AdPackageType.POPUP_RANKING_ADJUSTMENT,
    );
  }

  apply(context: AdEffectContext): CompanyData {
    const hasRankingAdjustment = context.activeAds.some(
      (ad) => ad.packageType === AdPackageType.POPUP_RANKING_ADJUSTMENT,
    );

    if (hasRankingAdjustment) {
      const currentPriority = context.company.sortPriority ?? 0;
      return {
        ...context.company,
        sortPriority: currentPriority + 1, // Boost priority significantly
      };
    }

    return { ...context.company };
  }
}
