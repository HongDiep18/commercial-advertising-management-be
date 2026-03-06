import type { AdPackageType } from '@prisma/client';

/**
 * Company data that can be modified by ad effects
 */
export interface CompanyData {
  id: string;
  name: string;
  email: string;
  contactName: string;
  phone: string;
  industry: string;
  address: string;
  description: string;
  featuredHighlight?: boolean;
  companyInfoHighlight?: boolean;
  adLinkUrl?: string;
  metadata?: Record<string, unknown>;
  sortPriority?: number;
  [key: string]: unknown;
}

/**
 * Active ad information for effect processing
 */
export interface ActiveAdInfo {
  id: string;
  companyId: string;
  packageType: AdPackageType;
  orderItemId?: string | null;
  adLinkUrl?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Context for applying ad effects
 */
export interface AdEffectContext {
  activeAds: ActiveAdInfo[];
  company: CompanyData;
}

/**
 * Result of applying an ad effect
 */
export interface AdEffectResult {
  modified: boolean;
  company: CompanyData;
}

/**
 * Base interface for ad effects
 * Each ad package type can have an effect that modifies company data
 */
export interface AdEffect {
  /**
   * The ad package type this effect handles
   */
  readonly packageType: AdPackageType;

  /**
   * Apply the effect to company data
   * @param context - The context containing company and active ads
   * @returns Modified company data
   */
  apply(context: AdEffectContext): CompanyData;

  /**
   * Check if this effect should be applied to the given company
   * @param activeAds - List of active ads for the company
   * @returns true if the effect should be applied
   */
  shouldApply(activeAds: ActiveAdInfo[]): boolean;
}
