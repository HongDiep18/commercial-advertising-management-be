import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AdCategoryType as AdCategoryTypeEnum,
  AdPackageCategory,
  AdPackageType,
  DurationUnit,
  PricingModel,
} from '@prisma/client';
import { AdCategoryType, AdPackageType as AdPackageTypeEnum } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AdsErrors } from './ads.errors';
import type { AdminCreateAdPackageCategoryDto } from './dto/admin-create-ad-package-category.dto';
import type { AdminUpdateAdPackageCategoryDto } from './dto/admin-update-ad-package-category.dto';

const SENTINEL_DATE = new Date('2999-12-31T00:00:00.000Z');

/** Max concurrent occupants per slot-limited package type */
const SLOT_CAPACITY: Partial<Record<AdPackageType, number>> = {
  [AdPackageTypeEnum.POPUP_PRIORITY_SLOT]: 1,
  [AdPackageTypeEnum.POPUP_ROTATION_SLOT]: 4,
};

export type BookedDateRange = {
  startDate: string; // ISO string
  endDate: string | null; // null = indefinite (ONE_TIME ads)
};

export type BookedDatesResult = {
  packageType: AdPackageType;
  capacity: number;
  fullyBookedRanges: BookedDateRange[];
};

// ─── Member-facing DTOs ──────────────────────────────────────────────────────
// Note: exported types are referenced by the controller for strong typing.
// They mirror Prisma models but flatten BigInt/Decimal into numbers for JSON safety.

export type AdPackagePricingItem = {
  id: string;
  pricingModel: PricingModel;
  durationValue: number | null;
  durationUnit: DurationUnit | null;
  basePrice: number;
  discountRate: number;
  finalPrice: number;
  isActive: boolean;
};

export type AdPackageItem = {
  id: string;
  categoryId: string;
  type: AdPackageType;
  name: string;
  nameZh: string | null;
  description: string | null;
  pricingModel: PricingModel;
  metadata: Record<string, unknown> | null;
  sortOrder: number;
  isActive: boolean;
  pricing: AdPackagePricingItem[];
};

export type AdPackageCategoryItem = {
  id: string;
  type: AdCategoryTypeEnum;
  name: string;
  nameZh: string | null;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  packages: AdPackageItem[];
};

@Injectable()
export class AdsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List all ad package categories for admin.
   */
  async listAdminCategories(): Promise<AdPackageCategory[]> {
    return this.prisma.adPackageCategory.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * Update category display fields.
   */
  async updateAdminCategory(
    categoryId: string,
    data: AdminUpdateAdPackageCategoryDto,
  ): Promise<AdPackageCategory> {
    const category = await this.prisma.adPackageCategory.findUnique({
      where: { id: categoryId },
    });
    if (!category) {
      throw new NotFoundException({
        ...AdsErrors.CATEGORY_NOT_FOUND,
      });
    }
    return this.prisma.adPackageCategory.update({
      where: { id: categoryId },
      data,
    });
  }

  /**
   * Create a new ad package category.
   */
  async createAdminCategory(
    dto: AdminCreateAdPackageCategoryDto,
  ): Promise<AdPackageCategory> {
    if (!Object.values(AdCategoryType).includes(dto.type)) {
      throw new BadRequestException({
        ...AdsErrors.INVALID_CATEGORY_TYPE,
      });
    }
    const existing = await this.prisma.adPackageCategory.findUnique({
      where: { type: dto.type },
    });
    if (existing) {
      throw new BadRequestException({
        ...AdsErrors.CATEGORY_TYPE_EXISTS,
      });
    }
    return this.prisma.adPackageCategory.create({
      data: {
        type: dto.type,
        name: dto.name,
        nameZh: dto.nameZh,
        description: dto.description,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  /**
   * Deactivate an ad package category.
   */
  async deactivateAdminCategory(
    categoryId: string,
  ): Promise<{ id: string; isActive: boolean }> {
    const category = await this.prisma.adPackageCategory.findUnique({
      where: { id: categoryId },
    });
    if (!category) {
      throw new NotFoundException({
        ...AdsErrors.CATEGORY_NOT_FOUND,
      });
    }
    const updated = await this.prisma.adPackageCategory.update({
      where: { id: categoryId },
      data: { isActive: false },
      select: { id: true, isActive: true },
    });
    return updated;
  }

  /**
   * Return fully-booked date ranges for a slot-limited package type.
   * Used by the frontend calendar to grey out unavailable start dates.
   */
  async getBookedDates(packageType: AdPackageType): Promise<BookedDatesResult> {
    const capacity = SLOT_CAPACITY[packageType];
    if (!capacity) {
      return { packageType, capacity: 0, fullyBookedRanges: [] };
    }

    const now = new Date();
    const activeAds = await this.prisma.activeAd.findMany({
      where: {
        packageType,
        isActive: true,
        OR: [{ endDate: null }, { endDate: { gte: now } }],
      },
      select: { startDate: true, endDate: true },
    });

    const fullyBookedRanges = this.computeFullyBookedRanges(activeAds, capacity);
    return { packageType, capacity, fullyBookedRanges };
  }

  /**
   * Sweep through ad date ranges and return sub-ranges where occupancy >= capacity.
   * Uses an event-based sweep: START events increment count, END events decrement.
   * Transitions from < capacity to >= capacity mark the start of a fully-booked range,
   * and transitions back mark the end.
   */
  private computeFullyBookedRanges(
    ads: { startDate: Date; endDate: Date | null }[],
    capacity: number,
  ): BookedDateRange[] {
    if (ads.length === 0) return [];

    type SweepEvent = { date: Date; type: 'start' | 'end' };
    const events: SweepEvent[] = [];

    for (const ad of ads) {
      events.push({ date: ad.startDate, type: 'start' });
      events.push({ date: ad.endDate ?? SENTINEL_DATE, type: 'end' });
    }

    // Sort by date; on same date process END before START so a slot freed on day T
    // is available for a new ad also starting on day T.
    events.sort((a, b) => {
      const diff = a.date.getTime() - b.date.getTime();
      if (diff !== 0) return diff;
      if (a.type === 'end' && b.type === 'start') return -1;
      if (a.type === 'start' && b.type === 'end') return 1;
      return 0;
    });

    const ranges: BookedDateRange[] = [];
    let count = 0;
    let fullStart: Date | null = null;

    for (const event of events) {
      const prevCount = count;
      count += event.type === 'start' ? 1 : -1;

      if (prevCount < capacity && count >= capacity) {
        // Slot just became fully booked
        fullStart = event.date;
      } else if (prevCount >= capacity && count < capacity) {
        // Slot just freed up — close the fully-booked range
        const isSentinel = event.date.getTime() === SENTINEL_DATE.getTime();
        ranges.push({
          startDate: fullStart!.toISOString(),
          endDate: isSentinel ? null : event.date.toISOString(),
        });
        fullStart = null;
      }
    }

    // If still at capacity after all events (e.g., ONE_TIME ads with no endDate)
    if (count >= capacity && fullStart !== null) {
      ranges.push({ startDate: fullStart.toISOString(), endDate: null });
    }

    return ranges;
  }

  /**
   * Get member-facing catalog of active categories, packages, and pricing.
   */
  async getAvailableAdPackages(): Promise<AdPackageCategoryItem[]> {
    const categories = await this.prisma.adPackageCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        packages: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          include: {
            pricing: {
              where: { isActive: true, deletedAt: null },
              orderBy: { finalPrice: 'asc' },
            },
          },
        },
      },
    });

    return categories.map<AdPackageCategoryItem>((cat) => ({
      id: cat.id,
      type: cat.type,
      name: cat.name,
      nameZh: cat.nameZh ?? null,
      description: cat.description ?? null,
      sortOrder: cat.sortOrder,
      isActive: cat.isActive,
      packages: cat.packages.map<AdPackageItem>((pkg) => ({
        id: pkg.id,
        categoryId: pkg.categoryId,
        type: pkg.type,
        name: pkg.name,
        nameZh: pkg.nameZh ?? null,
        description: pkg.description ?? null,
        pricingModel: pkg.pricingModel,
        metadata: (pkg.metadata as Record<string, unknown> | null) ?? null,
        sortOrder: pkg.sortOrder,
        isActive: pkg.isActive,
        pricing: pkg.pricing.map<AdPackagePricingItem>((p) => ({
          id: p.id,
          pricingModel: p.pricingModel,
          durationValue: p.durationValue ?? null,
          durationUnit: p.durationUnit ?? null,
          basePrice: Number(p.basePrice),
          discountRate: Number(p.discountRate),
          finalPrice: Number(p.finalPrice),
          isActive: p.isActive,
        })),
      })),
    }));
  }
}
