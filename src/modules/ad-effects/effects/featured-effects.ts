import { AdPackageType } from '@prisma/client';
import type {
  ActiveAdInfo,
  AdEffect,
  AdEffectContext,
  CompanyData,
} from '../interfaces/ad-effect.interface';

/**
 * Effect for FEATURED_HOMEPAGE_DISPLAY
 * Increases sort priority to move companies to the top
 */
export class FeaturedHomepageDisplayEffect implements AdEffect {
  readonly packageType = AdPackageType.FEATURED_HOMEPAGE_DISPLAY;

  shouldApply(activeAds: ActiveAdInfo[]): boolean {
    return activeAds.some(
      (ad) => ad.packageType === AdPackageType.FEATURED_HOMEPAGE_DISPLAY,
    );
  }

  apply(context: AdEffectContext): CompanyData {
    const hasFeaturedDisplay = context.activeAds.some(
      (ad) => ad.packageType === AdPackageType.FEATURED_HOMEPAGE_DISPLAY,
    );

    if (hasFeaturedDisplay) {
      return {
        ...context.company,
        sortPriority: 1000, // High priority to move to top
      };
    }

    return { ...context.company };
  }
}

/**
 * Effect for FEATURED_HIGHLIGHT_BOOST
 * Sets highlight flag to true
 */
export class FeaturedHighlightBoostEffect implements AdEffect {
  readonly packageType = AdPackageType.FEATURED_HIGHLIGHT_BOOST;

  shouldApply(activeAds: ActiveAdInfo[]): boolean {
    return activeAds.some(
      (ad) => ad.packageType === AdPackageType.FEATURED_HIGHLIGHT_BOOST,
    );
  }

  apply(context: AdEffectContext): CompanyData {
    const hasHighlightBoost = context.activeAds.some(
      (ad) => ad.packageType === AdPackageType.FEATURED_HIGHLIGHT_BOOST,
    );

    if (hasHighlightBoost) {
      return {
        ...context.company,
        featuredHighlight: true,
      };
    }

    return { ...context.company };
  }
}
