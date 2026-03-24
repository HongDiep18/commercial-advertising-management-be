import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AdPackageType,
  DurationUnit,
  PricingModel,
  type Prisma,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CompaniesService } from '../companies/companies.service';
import { AuditService } from '../audit/audit.service';
import { AUDIT_ACTION, AUDIT_ENTITY } from '../audit/audit.constants';
import type { CompanyWithAdsResponseDto } from '../companies/dto/company-with-ads-response.dto';
import { ActiveAdsErrors } from './active-ads.errors';
import type { AdminManualActiveAdResponseDto } from './dto/admin-manual-activate-ad.dto';

type ActiveAdWithOrderItemRecord = {
  id: string;
  packageType: AdPackageType;
  pricingModel: PricingModel;
  startDate: Date;
  endDate: Date | null;
  isActive: boolean;
  adLinkUrl: string | null;
  company: { id: string; name: string; description: string };
  assets: Array<{ fileUrl: string | null; assetType: string }>;
  orderItem: {
    adLinkUrl: string;
    assets: Array<{ fileUrl: string | null; assetType: string }>;
  } | null;
};

export interface ActiveAdResponse {
  id: string;
  company: {
    id: string;
    name: string;
    description: string;
  };
  packageType: AdPackageType;
  pricingModel: PricingModel;
  assets: Array<{
    fileUrl: string;
    assetType: string;
  }>;
  adLinkUrl?: string;
  startDate: Date;
  endDate?: Date;
  isActive: boolean;
}

@Injectable()
export class ActiveAdsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companiesService: CompaniesService,
    private readonly auditService: AuditService,
  ) {}

  async addAssetsToActiveAd(input: {
    activeAdId: string;
    assets: Array<{
      assetType: string;
      fileUrl: string;
      fileSizeKb?: number;
      notes?: string;
    }>;
  }): Promise<{ createdCount: number }> {
    const { activeAdId, assets } = input;
    const activeAd = await this.prisma.activeAd.findUnique({
      where: { id: activeAdId },
      select: { id: true },
    });
    if (!activeAd) {
      throw new NotFoundException(ActiveAdsErrors.ACTIVE_AD_NOT_FOUND);
    }
    const created = await this.prisma.activeAdAsset.createMany({
      data: assets.map((asset) => ({
        activeAdId,
        assetType: asset.assetType,
        fileUrl: asset.fileUrl,
        fileSizeKb: asset.fileSizeKb ?? null,
        notes: asset.notes ?? null,
      })),
    });
    return { createdCount: created.count };
  }

  async deleteActiveAdAsset(assetId: string): Promise<void> {
    try {
      await this.prisma.activeAdAsset.delete({ where: { id: assetId } });
    } catch {
      throw new NotFoundException(ActiveAdsErrors.ACTIVE_AD_ASSET_NOT_FOUND);
    }
  }

  /**
   * Get active ads by package type for frontend rendering
   */
  async getActiveAdsByType(
    packageType: AdPackageType,
    limit: number = 10,
  ): Promise<ActiveAdResponse[]> {
    const now = new Date();

    const queryArgs = {
      where: {
        packageType,
        isActive: true,
        startDate: { lte: now },
        OR: [
          { endDate: null }, // ONE_TIME or PER_ACTION
          { endDate: { gte: now } }, // DURATION not expired
        ],
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        assets: {
          select: {
            fileUrl: true,
            assetType: true,
          },
        },
        orderItem: {
          include: {
            assets: {
              select: {
                fileUrl: true,
                assetType: true,
              },
            },
          },
        },
      },
    } as const;

    const activeAds = (await this.prisma.activeAd.findMany(
      queryArgs as unknown as Prisma.ActiveAdFindManyArgs,
    )) as unknown as ActiveAdWithOrderItemRecord[];

    return activeAds.map((ad) => {
      const assetsSource =
        ad.assets.length > 0 ? ad.assets : (ad.orderItem?.assets ?? []);
      return {
        id: ad.id,
        company: {
          id: ad.company.id,
          name: ad.company.name,
          description: ad.company.description,
        },
        packageType: ad.packageType,
        pricingModel: ad.pricingModel,
        assets: assetsSource
          .filter((asset) => Boolean(asset.fileUrl))
          .map((asset) => ({
            fileUrl: asset.fileUrl || '',
            assetType: asset.assetType,
          })),
        adLinkUrl: ad.orderItem?.adLinkUrl ?? ad.adLinkUrl ?? undefined,
        startDate: ad.startDate,
        endDate: ad.endDate || undefined,
        isActive: ad.isActive,
      };
    });
  }

  /**
   * Get companies for popup display based on active popup-related ads.
   * Delegates to CompaniesService to apply ad effects.
   */
  async getPopupCompanies(): Promise<CompanyWithAdsResponseDto[]> {
    return this.companiesService.getPopupCompanies();
  }

  /**
   * Get companies for popup priority display (POPUP_PRIORITY_SLOT).
   * Delegates to CompaniesService to apply ad effects.
   */
  async getPopupPriorityCompanies(): Promise<CompanyWithAdsResponseDto[]> {
    return this.companiesService.getPopupPriorityCompanies();
  }

  /**
   * Get companies for popup rotational display (POPUP_ROTATION_SLOT).
   * Delegates to CompaniesService to apply ad effects.
   */
  async getPopupRotationalCompanies(): Promise<CompanyWithAdsResponseDto[]> {
    return this.companiesService.getPopupRotationalCompanies();
  }

  /**
   * Get companies for print placement based on active print placement ads.
   * Delegates to CompaniesService to apply ad effects.
   */
  async getPrintPlacementCompanies(): Promise<CompanyWithAdsResponseDto[]> {
    return this.companiesService.getPrintPlacementCompanies();
  }

  /**
   * Get all active ads for a specific company
   */
  async getCompanyActiveAds(companyId: string): Promise<ActiveAdResponse[]> {
    const now = new Date();

    const queryArgs = {
      where: {
        companyId,
        isActive: true,
        startDate: { lte: now },
        OR: [
          { endDate: null }, // ONE_TIME or PER_ACTION
          { endDate: { gte: now } }, // DURATION not expired
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        assets: {
          select: {
            fileUrl: true,
            assetType: true,
          },
        },
        orderItem: {
          include: {
            assets: {
              select: {
                fileUrl: true,
                assetType: true,
              },
            },
          },
        },
      },
    } as const;

    const activeAds = (await this.prisma.activeAd.findMany(
      queryArgs as unknown as Prisma.ActiveAdFindManyArgs,
    )) as unknown as ActiveAdWithOrderItemRecord[];

    return activeAds.map((ad) => {
      const assetsSource =
        ad.assets.length > 0 ? ad.assets : (ad.orderItem?.assets ?? []);
      return {
        id: ad.id,
        company: {
          id: ad.company.id,
          name: ad.company.name,
          description: ad.company.description,
        },
        packageType: ad.packageType,
        pricingModel: ad.pricingModel,
        assets: assetsSource
          .filter((asset) => Boolean(asset.fileUrl))
          .map((asset) => ({
            fileUrl: asset.fileUrl || '',
            assetType: asset.assetType,
          })),
        adLinkUrl: ad.orderItem?.adLinkUrl ?? ad.adLinkUrl ?? undefined,
        startDate: ad.startDate,
        endDate: ad.endDate || undefined,
        isActive: ad.isActive,
      };
    });
  }

  async manuallyActivateAdForCompany(input: {
    companyId: string;
    pricingId: string;
    adminUserId: string;
    startDate: Date;
    adLinkUrl?: string;
  }): Promise<AdminManualActiveAdResponseDto> {
    const { companyId, pricingId, adminUserId, startDate, adLinkUrl } = input;

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });
    if (!company) {
      throw new NotFoundException(ActiveAdsErrors.COMPANY_NOT_FOUND);
    }

    const pricing = await this.prisma.adPackagePricing.findUnique({
      where: { id: pricingId },
      include: { package: true },
    });
    if (!pricing) {
      throw new NotFoundException(ActiveAdsErrors.PRICING_NOT_FOUND);
    }

    let endDate: Date | null = null;
    let totalQuantity: number | null = null;

    switch (pricing.pricingModel) {
      case PricingModel.DURATION:
        if (!pricing.durationUnit) {
          throw new Error(
            'Duration unit is required for duration pricing model',
          );
        }
        endDate = this.calculateEndDate(
          startDate,
          pricing.durationValue ?? 0,
          pricing.durationUnit,
        );
        break;
      case PricingModel.PER_ACTION:
        totalQuantity = 1;
        break;
      case PricingModel.ONE_TIME:
        break;
    }

    const createArgs = {
      data: {
        companyId,
        pricingId: pricing.id,
        packageType: pricing.package.type,
        pricingModel: pricing.pricingModel,
        adLinkUrl: adLinkUrl ?? null,
        startDate,
        endDate,
        totalQuantity,
        usedQuantity: 0,
        approvedBy: adminUserId,
        approvedAt: new Date(),
      },
    } as const;

    const activeAd = await this.prisma.activeAd.create(createArgs);

    await this.auditService.record({
      action: AUDIT_ACTION.ACTIVE_AD_MANUALLY_CREATED,
      entityType: AUDIT_ENTITY.ACTIVE_AD,
      entityId: activeAd.id,
      actorId: adminUserId,
      metadata: {
        companyId,
        packageType: pricing.package.type,
        pricingModel: pricing.pricingModel,
        packageName: pricing.package.name,
      },
    });

    const response: AdminManualActiveAdResponseDto = {
      id: activeAd.id,
      companyId: activeAd.companyId,
      packageType: activeAd.packageType,
      pricingModel: activeAd.pricingModel,
      startDate: activeAd.startDate,
      endDate: activeAd.endDate ?? undefined,
      totalQuantity: activeAd.totalQuantity ?? null,
      isActive: activeAd.isActive,
    };

    return response;
  }

  private calculateEndDate(
    startDate: Date,
    value: number,
    unit: DurationUnit,
  ): Date {
    const end = new Date(startDate);

    switch (unit) {
      case DurationUnit.DAY:
        end.setDate(end.getDate() + value);
        break;
      case DurationUnit.WEEK:
        end.setDate(end.getDate() + value * 7);
        break;
      case DurationUnit.MONTH:
        end.setMonth(end.getMonth() + value);
        break;
      case DurationUnit.YEAR:
        end.setFullYear(end.getFullYear() + value);
        break;
    }

    return end;
  }
}
