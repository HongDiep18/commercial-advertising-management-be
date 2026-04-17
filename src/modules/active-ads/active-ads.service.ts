import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AdOrderStatus,
  AdPackageType,
  DurationUnit,
  PricingModel,
  type Prisma,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  getPackageFormConfig,
  SENTINEL_DATE,
  SLOT_CAPACITY,
} from '../ads/ads.constants';
import { AUDIT_ACTION, AUDIT_ENTITY } from '../audit/audit.constants';
import { AuditService } from '../audit/audit.service';
import { CompaniesService } from '../companies/companies.service';
import type { CompanyWithAdsResponseDto } from '../companies/dto/company-with-ads-response.dto';
import { ActiveAdsErrors } from './active-ads.errors';
import type { ActiveAdDto } from './dto/active-ads.dto';
import { AdStatus } from './dto/active-ads.dto';
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

const TRACKED_SLOT_PACKAGE_TYPES: readonly AdPackageType[] = [
  AdPackageType.POPUP_PRIORITY_SLOT,
  AdPackageType.POPUP_ROTATION_SLOT,
  AdPackageType.FEATURED_HIGHLIGHT_BOOST,
  AdPackageType.FEATURED_HOMEPAGE_DISPLAY,
];

type TrackedSlotAdSource = 'active_ad' | 'pending_order';

type TrackedCompanyNameRecord = {
  companyNameVi: string | null;
  companyNameEn: string | null;
  companyNameZh: string | null;
};

type TrackedSlotPackageRecord = {
  type: AdPackageType;
  name: string;
  nameZh: string | null;
  sortOrder: number;
  createdAt: Date;
};

type TrackedSlotActiveAdRecord = {
  id: string;
  packageType: AdPackageType;
  companyId: string;
  orderId: string | null;
  orderItemId: string | null;
  adLinkUrl: string | null;
  startDate: Date;
  endDate: Date | null;
  isActive: boolean;
  company: TrackedCompanyNameRecord | null;
};

type TrackedSlotPendingOrderItemRecord = {
  id: string;
  startDate: Date;
  adLinkUrl: string;
  durationValue: number | null;
  durationUnit: DurationUnit | null;
  pricing: {
    pricingModel: PricingModel;
    durationValue: number | null;
    durationUnit: DurationUnit | null;
    package: {
      type: AdPackageType;
    };
  };
  order: {
    id: string;
    companyId: string | null;
    company: TrackedCompanyNameRecord | null;
  };
};

export type TrackedSlotAdItem = {
  source: TrackedSlotAdSource;
  activeAdId: string | null;
  orderId: string | null;
  orderItemId: string | null;
  companyId: string | null;
  companyName: string | null;
  startDate: Date;
  endDate: Date | null;
  adLinkUrl: string | null;
};

export type TrackedAdSlotStatus = {
  packageType: AdPackageType;
  packageName: string;
  packageNameZh: string | null;
  hasActiveAds: boolean;
  expiresAt: Date | null;
  activeAds: TrackedSlotAdItem[];
  expiredAds: TrackedSlotAdItem[];
  waitingAds: TrackedSlotAdItem[];
};

@Injectable()
export class ActiveAdsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companiesService: CompaniesService,
    private readonly auditService: AuditService,
  ) {}

  async checkSlotAvailability(input: {
    db: Pick<Prisma.TransactionClient, 'activeAd'> | PrismaService;
    packageType: AdPackageType;
    startDate: Date;
    endDate: Date | null;
    excludeActiveAdId?: string;
  }): Promise<void> {
    const { db, packageType, startDate, endDate, excludeActiveAdId } = input;
    const capacity = SLOT_CAPACITY[packageType];
    if (!capacity) return;
    const effectiveEndDate = endDate ?? SENTINEL_DATE;
    const occupiedCount = await db.activeAd.count({
      where: {
        packageType,
        isActive: true,
        ...(excludeActiveAdId ? { id: { not: excludeActiveAdId } } : {}),
        startDate: { lt: effectiveEndDate },
        OR: [{ endDate: null }, { endDate: { gt: startDate } }],
      },
    });
    if (occupiedCount >= capacity) {
      throw new BadRequestException(ActiveAdsErrors.SLOT_NOT_AVAILABLE);
    }
  }

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
        adLinkUrl: ad.adLinkUrl ?? ad.orderItem?.adLinkUrl ?? undefined,
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
  async getCompanyActiveAds(companyId: string): Promise<ActiveAdDto> {
    const activeAds = await this.prisma.activeAd.findMany({
      where: {
        companyId,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        assets: {
          select: {
            fileUrl: true,
            assetType: true,
          },
        },
      },
    });
    const now = new Date();
    const items = activeAds.map((ad) => {
      let status: AdStatus;
      if (!ad.isActive) {
        status = AdStatus.DISABLED;
      } else if (ad.endDate && ad.endDate < now) {
        status = AdStatus.EXPIRED;
      } else if (ad.startDate > now) {
        status = AdStatus.PENDING;
      } else {
        status = AdStatus.ACTIVATING;
      }
      return {
        id: ad.id,
        packageType: ad.packageType,
        pricingModel: ad.pricingModel,
        assets: ad.assets.map((asset) => ({
          fileUrl: asset.fileUrl ?? '',
          assetType: asset.assetType,
        })),
        adLinkUrl: ad.adLinkUrl,
        startDate: ad.startDate,
        endDate: ad.endDate,
        isActive: ad.isActive,
        status,
        formConfig: getPackageFormConfig(ad.packageType),
      };
    });
    return {
      company_id: companyId,
      items,
    };
  }

  async getTrackedSlotStatuses(): Promise<TrackedAdSlotStatus[]> {
    const now = new Date();
    const trackedTypes: AdPackageType[] = [...TRACKED_SLOT_PACKAGE_TYPES];
    const [slotPackages, slotActiveAds, slotPendingOrderItems] =
      await Promise.all([
        this.prisma.adPackage.findMany({
          where: {
            type: { in: trackedTypes },
            isActive: true,
          },
          select: {
            type: true,
            name: true,
            nameZh: true,
            sortOrder: true,
            createdAt: true,
          },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        }) as unknown as Promise<TrackedSlotPackageRecord[]>,
        this.prisma.activeAd.findMany({
          where: {
            packageType: { in: trackedTypes },
          },
          select: {
            id: true,
            packageType: true,
            companyId: true,
            orderId: true,
            orderItemId: true,
            adLinkUrl: true,
            startDate: true,
            endDate: true,
            isActive: true,
            company: {
              select: {
                companyNameVi: true,
                companyNameEn: true,
                companyNameZh: true,
              },
            },
          },
        }) as unknown as Promise<TrackedSlotActiveAdRecord[]>,
        this.prisma.adOrderItem.findMany({
          where: {
            order: { status: AdOrderStatus.PENDING },
            pricing: {
              package: {
                type: { in: trackedTypes },
              },
            },
          },
          select: {
            id: true,
            startDate: true,
            adLinkUrl: true,
            durationValue: true,
            durationUnit: true,
            pricing: {
              select: {
                pricingModel: true,
                durationValue: true,
                durationUnit: true,
                package: {
                  select: {
                    type: true,
                  },
                },
              },
            },
            order: {
              select: {
                id: true,
                companyId: true,
                company: {
                  select: {
                    companyNameVi: true,
                    companyNameEn: true,
                    companyNameZh: true,
                  },
                },
              },
            },
          },
        }) as unknown as Promise<TrackedSlotPendingOrderItemRecord[]>,
      ]);

    const packageByType = new Map<
      AdPackageType,
      { name: string; nameZh: string | null }
    >();
    for (const slotPackage of slotPackages) {
      if (packageByType.has(slotPackage.type)) continue;
      packageByType.set(slotPackage.type, {
        name: slotPackage.name,
        nameZh: slotPackage.nameZh,
      });
    }

    const slotStatusByType = new Map<AdPackageType, TrackedAdSlotStatus>(
      trackedTypes.map((trackedType) => {
        const packageInfo = packageByType.get(trackedType);
        return [
          trackedType,
          {
            packageType: trackedType,
            packageName: packageInfo?.name ?? trackedType,
            packageNameZh: packageInfo?.nameZh ?? null,
            hasActiveAds: false,
            expiresAt: null,
            activeAds: [],
            expiredAds: [],
            waitingAds: [],
          },
        ];
      }),
    );

    for (const slotActiveAd of slotActiveAds) {
      const slotStatus = slotStatusByType.get(slotActiveAd.packageType);
      if (!slotStatus) continue;
      const item: TrackedSlotAdItem = {
        source: 'active_ad',
        activeAdId: slotActiveAd.id,
        orderId: slotActiveAd.orderId,
        orderItemId: slotActiveAd.orderItemId,
        companyId: slotActiveAd.companyId,
        companyName: this.resolveCompanyDisplayName(slotActiveAd.company),
        startDate: slotActiveAd.startDate,
        endDate: slotActiveAd.endDate,
        adLinkUrl: slotActiveAd.adLinkUrl,
      };
      const isScheduled = slotActiveAd.isActive && slotActiveAd.startDate > now;
      const isCurrentActive =
        slotActiveAd.isActive &&
        slotActiveAd.startDate <= now &&
        (!slotActiveAd.endDate || slotActiveAd.endDate > now);
      const isExpired =
        slotActiveAd.endDate !== null && slotActiveAd.endDate <= now;
      if (isCurrentActive) {
        slotStatus.activeAds.push(item);
        continue;
      }
      if (isScheduled) {
        slotStatus.waitingAds.push(item);
        continue;
      }
      if (isExpired) {
        slotStatus.expiredAds.push(item);
      }
    }

    for (const slotPendingOrderItem of slotPendingOrderItems) {
      const packageType = slotPendingOrderItem.pricing.package.type;
      const slotStatus = slotStatusByType.get(packageType);
      if (!slotStatus) continue;
      const endDate = this.computeProjectedEndDate({
        startDate: slotPendingOrderItem.startDate,
        pricingModel: slotPendingOrderItem.pricing.pricingModel,
        durationValue:
          slotPendingOrderItem.durationValue ??
          slotPendingOrderItem.pricing.durationValue,
        durationUnit:
          slotPendingOrderItem.durationUnit ??
          slotPendingOrderItem.pricing.durationUnit,
      });
      slotStatus.waitingAds.push({
        source: 'pending_order',
        activeAdId: null,
        orderId: slotPendingOrderItem.order.id,
        orderItemId: slotPendingOrderItem.id,
        companyId: slotPendingOrderItem.order.companyId,
        companyName: this.resolveCompanyDisplayName(
          slotPendingOrderItem.order.company,
        ),
        startDate: slotPendingOrderItem.startDate,
        endDate,
        adLinkUrl: slotPendingOrderItem.adLinkUrl,
      });
    }

    for (const packageType of trackedTypes) {
      const slotStatus = slotStatusByType.get(packageType);
      if (!slotStatus) continue;
      slotStatus.activeAds.sort(
        (left, right) => left.startDate.getTime() - right.startDate.getTime(),
      );
      slotStatus.expiredAds.sort(
        (left, right) =>
          (right.endDate?.getTime() ?? 0) - (left.endDate?.getTime() ?? 0),
      );
      slotStatus.waitingAds.sort(
        (left, right) => left.startDate.getTime() - right.startDate.getTime(),
      );
      slotStatus.hasActiveAds = slotStatus.activeAds.length > 0;
      const endingDates: Date[] = slotStatus.activeAds
        .map((item) => item.endDate)
        .filter((dateValue): dateValue is Date => dateValue instanceof Date);
      if (endingDates.length === 0) {
        slotStatus.expiresAt = null;
        continue;
      }
      const nearestEndTimestamp = Math.min(
        ...endingDates.map((dateValue) => dateValue.getTime()),
      );
      slotStatus.expiresAt = new Date(nearestEndTimestamp);
    }

    return trackedTypes
      .map((packageType) => slotStatusByType.get(packageType))
      .filter((slotStatus): slotStatus is TrackedAdSlotStatus =>
        Boolean(slotStatus),
      );
  }

  async updateActiveAd(
    activeAdId: string,
    input: {
      isActive?: boolean;
      startDate?: string;
      endDate?: string | null;
      adLinkUrl?: string | null;
    },
    adminUserId: string,
  ): Promise<void> {
    const activeAd = await this.prisma.activeAd.findUnique({
      where: { id: activeAdId },
      select: {
        id: true,
        packageType: true,
        isActive: true,
        startDate: true,
        endDate: true,
      },
    });
    if (!activeAd) {
      throw new NotFoundException(ActiveAdsErrors.ACTIVE_AD_NOT_FOUND);
    }
    const nextIsActive = input.isActive ?? activeAd.isActive;
    const nextStartDate =
      input.startDate !== undefined
        ? new Date(input.startDate)
        : activeAd.startDate;
    const nextEndDate =
      'endDate' in input
        ? input.endDate
          ? new Date(input.endDate)
          : null
        : activeAd.endDate;
    if (nextIsActive) {
      await this.checkSlotAvailability({
        db: this.prisma,
        packageType: activeAd.packageType,
        startDate: nextStartDate,
        endDate: nextEndDate,
        excludeActiveAdId: activeAdId,
      });
    }

    const data: Prisma.ActiveAdUpdateInput = {};
    if (input.isActive !== undefined) data.isActive = input.isActive;
    if (input.startDate !== undefined) data.startDate = nextStartDate;
    if ('endDate' in input) data.endDate = nextEndDate;
    if ('adLinkUrl' in input) data.adLinkUrl = input.adLinkUrl ?? null;

    await this.prisma.activeAd.update({ where: { id: activeAdId }, data });

    await this.auditService.record({
      action: AUDIT_ACTION.ACTIVE_AD_MANUALLY_CREATED,
      entityType: AUDIT_ENTITY.ACTIVE_AD,
      entityId: activeAdId,
      actorId: adminUserId,
      metadata: { updatedFields: Object.keys(data) },
    });
  }

  async replaceActiveAdAssets(
    activeAdId: string,
    assets: Array<{ fileUrl: string; assetType: string; notes?: string }>,
  ): Promise<{ replacedCount: number }> {
    const activeAd = await this.prisma.activeAd.findUnique({
      where: { id: activeAdId },
      select: { id: true },
    });
    if (!activeAd) {
      throw new NotFoundException(ActiveAdsErrors.ACTIVE_AD_NOT_FOUND);
    }

    const deleteAssetsOperation = this.prisma.activeAdAsset.deleteMany({
      where: { activeAdId },
    });

    if (assets.length > 0) {
      await this.prisma.$transaction([
        deleteAssetsOperation,
        this.prisma.activeAdAsset.createMany({
          data: assets.map((asset) => ({
            activeAdId,
            assetType: asset.assetType,
            fileUrl: asset.fileUrl,
            notes: asset.notes ?? null,
          })),
        }),
      ]);
    } else {
      await this.prisma.$transaction([deleteAssetsOperation]);
    }

    return { replacedCount: assets.length };
  }

  async deleteActiveAd(activeAdId: string, adminUserId: string): Promise<void> {
    const activeAd = await this.prisma.activeAd.findUnique({
      where: { id: activeAdId },
    });
    if (!activeAd) {
      throw new NotFoundException(ActiveAdsErrors.ACTIVE_AD_NOT_FOUND);
    }
    await this.prisma.$transaction([
      this.prisma.activeAdAsset.deleteMany({ where: { activeAdId } }),
      this.prisma.activeAd.delete({ where: { id: activeAdId } }),
    ]);
    await this.auditService.record({
      action: 'active_ad.deleted',
      entityType: AUDIT_ENTITY.ACTIVE_AD,
      entityId: activeAdId,
      actorId: adminUserId,
      metadata: activeAd,
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

  /**
   * Admin-only: create a popup add-on active ad (ranking adjustment or view-details link)
   * for a company with explicit start/end and link. No order and no assets required.
   */
  async createCompanyPopupAddonActiveAd(input: {
    companyId: string;
    packageType: AdPackageType;
    startDate: Date;
    endDate: Date | null;
    adLinkUrl: string;
    adminUserId: string;
  }): Promise<AdminManualActiveAdResponseDto> {
    const allowed: AdPackageType[] = [
      AdPackageType.POPUP_RANKING_ADJUSTMENT,
      AdPackageType.POPUP_VIEW_DETAILS_LINK,
      AdPackageType.POPUP_PRIORITY_DETAILS_LINK,
      AdPackageType.POPUP_ROTATION_DETAILS_LINK,
    ];
    if (!allowed.includes(input.packageType)) {
      throw new BadRequestException(ActiveAdsErrors.INVALID_ADDON_PACKAGE_TYPE);
    }
    const company = await this.prisma.company.findUnique({
      where: { id: input.companyId },
      select: { id: true },
    });
    if (!company) {
      throw new NotFoundException(ActiveAdsErrors.COMPANY_NOT_FOUND);
    }
    if (input.endDate && input.endDate <= input.startDate) {
      throw new BadRequestException(ActiveAdsErrors.INVALID_ADDON_DATE_RANGE);
    }
    const pricing = await this.prisma.adPackagePricing.findFirst({
      where: {
        isActive: true,
        deletedAt: null,
        package: {
          type: input.packageType,
          isActive: true,
        },
      },
      include: { package: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!pricing) {
      throw new NotFoundException(ActiveAdsErrors.PRICING_NOT_FOUND);
    }
    let totalQuantity: number | null = null;
    if (pricing.pricingModel === PricingModel.PER_ACTION) {
      totalQuantity = 1;
    }
    const activeAd = await this.prisma.activeAd.create({
      data: {
        companyId: input.companyId,
        pricingId: pricing.id,
        packageType: pricing.package.type,
        pricingModel: pricing.pricingModel,
        adLinkUrl: input.adLinkUrl.trim(),
        startDate: input.startDate,
        endDate: input.endDate,
        totalQuantity,
        usedQuantity: 0,
        approvedBy: input.adminUserId,
        approvedAt: new Date(),
      },
    });
    await this.auditService.record({
      action: AUDIT_ACTION.ACTIVE_AD_CREATED,
      entityType: AUDIT_ENTITY.ACTIVE_AD,
      entityId: activeAd.id,
      actorId: input.adminUserId,
      metadata: {
        companyId: input.companyId,
        packageType: activeAd.packageType,
        pricingModel: activeAd.pricingModel,
        source: 'admin_company_popup_addon',
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

  private computeProjectedEndDate(input: {
    startDate: Date;
    pricingModel: PricingModel;
    durationValue: number | null;
    durationUnit: DurationUnit | null;
  }): Date | null {
    if (input.pricingModel !== PricingModel.DURATION || !input.durationUnit) {
      return null;
    }
    return this.calculateEndDate(
      input.startDate,
      input.durationValue ?? 0,
      input.durationUnit,
    );
  }

  private resolveCompanyDisplayName(
    company: TrackedCompanyNameRecord | null | undefined,
  ): string | null {
    if (!company) {
      return null;
    }
    const names: Array<string | null> = [
      company.companyNameVi,
      company.companyNameEn,
      company.companyNameZh,
    ];
    const foundName = names.find(
      (name) => typeof name === 'string' && name.trim().length > 0,
    );
    return foundName ?? null;
  }
}
