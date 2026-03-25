import { Injectable } from '@nestjs/common';
import { MembershipTier } from '../../common/enums/membership-tier.enum';
import { Industry } from '../../common/enums/industry.enum';

export interface MaskingContext {
  userTier: MembershipTier | null;
  userIndustries: string[]; // primaryIndustry + selectedIndustries
  userId?: string;
  userCompanyId?: string;
  userRole?: string; // For admin check
}

@Injectable()
export class CompanyMaskingService {
  /**
   * Mask company name (show last 2 characters)
   * Example: "ABC Company" → "****ny"
   * Example: "越南公司" → "****司"
   */
  maskCompanyName(name: string): string {
    if (!name || name.length <= 2) return '****';
    const last2 = name.slice(-2);
    return `****${last2}`;
  }

  /**
   * Mask tax ID (show last 4 digits)
   * Example: "0123456789" → "****6789"
   */
  maskTaxId(taxId: string | null): string {
    if (!taxId) return '****';
    const last4 = taxId.slice(-4);
    return `****${last4}`;
  }

  /**
   * Mask phone number (show last 4 digits)
   * Example: "+84 123 456 789" → "****6789"
   */
  maskPhone(phone: string | null): string {
    if (!phone) return '****';
    // Extract digits only and get last 4
    const digits = phone.replace(/\D/g, '');
    const last4 = digits.slice(-4);
    return `****${last4}`;
  }

  /**
   * Mask email (show domain only)
   * Example: "contact@example.com" → "****@example.com"
   */
  maskEmail(email: string): string {
    const [, domain] = email.split('@');
    return `****@${domain}`;
  }

  /**
   * Check if user has access to a specific company based on industry
   */
  hasIndustryAccess(
    companyIndustry: string,
    context: MaskingContext,
  ): boolean {
    // Guest (no tier) can see all industries but with masked data
    if (!context.userTier) {
      return true;
    }

    // Admin has access to all industries
    if (context.userRole && (context.userRole === 'ADMIN' || context.userRole === 'SUPER_ADMIN')) {
      return true;
    }

    // Diamond has access to all industries
    if (context.userTier === MembershipTier.DIAMOND) {
      return true;
    }

    // Check if user has access to this industry
    // For Bronze/Silver/Gold, they can only see companies in their accessible industries
    const hasAccess = context.userIndustries.includes(companyIndustry);

    return hasAccess;
  }

  /**
   * Determine masking level for a company based on user tier and industry access
   */
  private getMaskingLevel(
    companyIndustry: string,
    companyId: string,
    context: MaskingContext,
  ): 'none' | 'partial' | 'full' {
    // Admin/Super Admin - no masking regardless of tier
    if (context.userRole && (context.userRole === 'ADMIN' || context.userRole === 'SUPER_ADMIN')) {
      return 'none';
    }

    // Check if this is the user's own company (Bronze users can see their own company fully)
    if (context.userCompanyId && context.userCompanyId === companyId) {
      return 'none'; // No masking for own company
    }

    // Guest - full masking
    if (!context.userTier || context.userTier === MembershipTier.NONE) {
      return 'full';
    }

    // Check industry access
    const hasAccess = this.hasIndustryAccess(companyIndustry, context);

    if (!hasAccess) {
      // User doesn't have access to this industry - should not see it at all
      // This case should be filtered out before masking
      return 'full';
    }

    // User has access to this industry
    switch (context.userTier) {
      case MembershipTier.BRONZE:
        return 'partial'; // Show name, taxId, region, industry (masked contacts)
      case MembershipTier.SILVER:
      case MembershipTier.GOLD:
      case MembershipTier.DIAMOND:
        return 'none'; // Show full info
      default:
        return 'full';
    }
  }

  /**
   * Apply masking to company data based on user tier and industry access
   */
  maskCompanyData(
    company: {
      id: string;
      companyNameVi: string | null;
      companyNameCn: string | null;
      taxId?: string | null;
      phone: string;
      email: string;
      industry: string;
      contactName?: string | null;
      contactPhone?: string | null;
      website?: string | null;
      address?: string;
      region?: string | null;
      country?: string | null;
      description?: string;
      logoUrl?: string | null;
    },
    context: MaskingContext,
  ): {
    id: string;
    companyNameVi: string | null;
    companyNameCn: string | null;
    taxId?: string | null;
    phone: string;
    email: string;
    industry: string;
    contactName?: string | null;
    contactPhone?: string | null;
    website?: string | null;
    address?: string;
    region?: string | null;
    country?: string | null;
    description?: string;
    logoUrl?: string | null;
  } {
    const maskingLevel = this.getMaskingLevel(
      company.industry,
      company.id,
      context,
    );

    if (maskingLevel === 'none') {
      // No masking - return as is
      return company;
    }

    if (maskingLevel === 'full') {
      // Full masking (Guest)
      return {
        id: company.id,
        companyNameVi: this.maskCompanyName(company.companyNameVi || ''),
        companyNameCn: this.maskCompanyName(company.companyNameCn || ''),
        taxId: company.taxId !== undefined ? '****' : undefined,
        phone: '****',
        email: this.maskEmail(company.email),
        industry: company.industry, // Always visible
        contactName: company.contactName !== undefined ? '****' : undefined,
        contactPhone: company.contactPhone !== undefined ? '****' : undefined,
        website: company.website !== undefined ? null : undefined,
        address: company.address,
        region: company.region, // Always visible
        country: company.country, // Always visible
        description: company.description,
        logoUrl: company.logoUrl, // Logo URL always sent (FE will blur it)
      };
    }

    // Partial masking (Bronze)
    return {
      id: company.id,
      companyNameVi: company.companyNameVi, // Visible
      companyNameCn: company.companyNameCn, // Visible
      taxId:
        company.taxId !== undefined ? this.maskTaxId(company.taxId) : undefined, // Masked (last 4)
      phone: this.maskPhone(company.phone), // Masked (last 4)
      email: this.maskEmail(company.email), // Masked
      industry: company.industry, // Always visible
      contactName: company.contactName !== undefined ? '****' : undefined, // Masked
      contactPhone: company.contactPhone !== undefined ? '****' : undefined, // Masked
      website: company.website !== undefined ? null : undefined, // Hidden
      address: company.address,
      region: company.region, // Always visible
      country: company.country, // Always visible
      description: company.description,
      logoUrl: company.logoUrl, // Logo URL always sent (FE will blur it)
    };
  }

  /**
   * Check if user has access to all industries
   * - Guests (no context): Yes
   * - Admin/Super Admin: Yes
   * - Diamond tier: Yes
   * - Others: No
   */
  hasAllIndustryAccess(context?: MaskingContext): boolean {
    if (!context) return true; // Guest

    // Admin roles have all access
    if (context.userRole && (context.userRole === 'ADMIN' || context.userRole === 'SUPER_ADMIN')) {
      return true;
    }

    // Diamond tier has all access
    if (context.userTier === MembershipTier.DIAMOND) {
      return true;
    }

    return false;
  }

  /**
   * Get accessible industries for a user based on their tier
   */
  getAccessibleIndustries(
    userTier: MembershipTier | null,
    primaryIndustry: string | null,
    selectedIndustries: string[],
    userRole?: string,
  ): { industries: string[]; hasAllAccess: boolean } {
    // Guest - can see ALL industries (with masked data)
    if (!userTier || userTier === MembershipTier.NONE) {
      return { industries: [Industry.ALL], hasAllAccess: true };
    }

    // Admin - can see ALL industries
    if (userRole && (userRole === 'ADMIN' || userRole === 'SUPER_ADMIN')) {
      return { industries: [Industry.ALL], hasAllAccess: true };
    }

    // Diamond - can see ALL industries
    if (userTier === MembershipTier.DIAMOND) {
      return { industries: [Industry.ALL], hasAllAccess: true };
    }

    // Bronze/Silver - only primary industry
    if (
      userTier === MembershipTier.BRONZE ||
      userTier === MembershipTier.SILVER
    ) {
      return {
        industries: primaryIndustry ? [primaryIndustry] : [],
        hasAllAccess: false,
      };
    }

    // Gold - primary + selected industries
    if (userTier === MembershipTier.GOLD) {
      const industries = primaryIndustry
        ? [primaryIndustry, ...selectedIndustries]
        : selectedIndustries;
      return { industries, hasAllAccess: false };
    }

    // Default - no access
    return { industries: [], hasAllAccess: false };
  }
}
