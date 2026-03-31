import { Injectable } from '@nestjs/common';
import { AdPackageType } from '@prisma/client';
import { CompanyCategoryTopEffect } from './effects/company-category-top-effects';
import { CompanyInfoHighlightEffect } from './effects/company-info-effects';
import {
  FeaturedHighlightBoostEffect,
  FeaturedHomepageDisplayEffect,
} from './effects/featured-effects';
import {
  PopupRankingAdjustmentEffect,
  PopupSlotEffect,
  PopupViewDetailsLinkEffect,
} from './effects/popup-effects';
import { PrintPlacementEffect } from './effects/print-placement-effects';
import type {
  ActiveAdInfo,
  AdEffect,
  CompanyData,
} from './interfaces/ad-effect.interface';

/**
 * Registry service for ad effects
 * Manages all available ad effects and applies them to company data
 */
@Injectable()
export class AdEffectsRegistryService {
  private readonly effects: Map<AdPackageType, AdEffect> = new Map();

  constructor() {
    this.registerEffects();
  }

  /**
   * Register all available ad effects
   */
  private registerEffects(): void {
    // Popup effects
    this.register(new PopupSlotEffect(AdPackageType.POPUP_PRIORITY_SLOT));
    this.register(new PopupSlotEffect(AdPackageType.POPUP_ROTATION_SLOT));
    this.register(
      new PopupViewDetailsLinkEffect(AdPackageType.POPUP_VIEW_DETAILS_LINK),
    );
    this.register(
      new PopupViewDetailsLinkEffect(AdPackageType.POPUP_PRIORITY_DETAILS_LINK),
    );
    this.register(
      new PopupViewDetailsLinkEffect(AdPackageType.POPUP_ROTATION_DETAILS_LINK),
    );
    this.register(new PopupRankingAdjustmentEffect());

    // Featured effects
    this.register(new FeaturedHomepageDisplayEffect());
    this.register(new FeaturedHighlightBoostEffect());

    // Company info effects
    this.register(new CompanyCategoryTopEffect());
    this.register(new CompanyInfoHighlightEffect());

    // Print placement effects
    this.register(new PrintPlacementEffect());
  }

  /**
   * Register an ad effect
   */
  register(effect: AdEffect): void {
    this.effects.set(effect.packageType, effect);
  }

  /**
   * Get effect for a specific package type
   */
  getEffect(packageType: AdPackageType): AdEffect | undefined {
    return this.effects.get(packageType);
  }

  /**
   * Get all effects that should be applied based on active ads
   */
  getApplicableEffects(activeAds: ActiveAdInfo[]): AdEffect[] {
    const applicableEffects: AdEffect[] = [];

    for (const ad of activeAds) {
      const effect = this.effects.get(ad.packageType);
      if (effect && effect.shouldApply(activeAds)) {
        applicableEffects.push(effect);
      }
    }

    return applicableEffects;
  }

  /**
   * Apply all applicable effects to company data
   */
  applyEffects(company: CompanyData, activeAds: ActiveAdInfo[]): CompanyData {
    const effects = this.getApplicableEffects(activeAds);
    let result = { ...company };

    for (const effect of effects) {
      result = effect.apply({
        company: result,
        activeAds,
      });
    }

    return result;
  }
}
