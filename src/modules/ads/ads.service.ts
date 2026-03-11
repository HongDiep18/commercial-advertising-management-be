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
import { AdCategoryType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AdsErrors } from './ads.errors';
import type { AdminCreateAdPackageCategoryDto } from './dto/admin-create-ad-package-category.dto';
import type { AdminUpdateAdPackageCategoryDto } from './dto/admin-update-ad-package-category.dto';

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
