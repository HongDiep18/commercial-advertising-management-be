import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AdPackagePricing, PricingModel, type Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { AdminCreatePricingDto } from './dto/admin-create-pricing.dto';
import type {
  AdminPricingListQueryDto,
  AdminPricingListResponseDto,
  AdminPricingResponseDto,
} from './dto/admin-pricing-response.dto';
import type { AdminUpdatePricingDto } from './dto/admin-update-pricing.dto';

@Injectable()
export class AdPackagePricingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new pricing option for an ad package
   */
  async createPricing(
    packageId: string,
    dto: AdminCreatePricingDto,
  ): Promise<AdminPricingResponseDto> {
    // Verify the package exists
    const adPackage = await this.prisma.adPackage.findUnique({
      where: { id: packageId },
      select: { id: true, name: true, type: true },
    });

    if (!adPackage) {
      throw new NotFoundException({
        code: 'AD_PACKAGE_NOT_FOUND',
        message: 'Ad package not found',
      });
    }

    // Validate duration fields for DURATION pricing model
    if (dto.pricingModel === PricingModel.DURATION) {
      if (!dto.durationValue || !dto.durationUnit) {
        throw new BadRequestException({
          code: 'INVALID_DURATION_PRICING',
          message:
            'Duration value and unit are required for DURATION pricing model',
        });
      }
    }

    // Calculate final price
    const discountRate = dto.discountRate ?? 0;
    const finalPrice = Math.round(dto.basePrice * (1 - discountRate / 100));

    const pricing = await this.prisma.adPackagePricing.create({
      data: {
        packageId,
        pricingModel: dto.pricingModel,
        durationValue: dto.durationValue ?? null,
        durationUnit: dto.durationUnit ?? null,
        basePrice: BigInt(dto.basePrice),
        discountRate: discountRate,
        finalPrice: BigInt(finalPrice),
        isActive: dto.isActive ?? true,
      },
      include: {
        package: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    return this.mapToResponseDto(pricing);
  }

  /**
   * Get all pricing options with filtering and pagination
   */
  async listPricing(
    query: AdminPricingListQueryDto,
  ): Promise<AdminPricingListResponseDto> {
    const { packageId, pricingModel, isActive, page = 1, limit = 20 } = query;

    // Build where clause
    const where: Prisma.AdPackagePricingWhereInput = {};

    if (packageId) {
      where.packageId = packageId;
    }

    if (pricingModel) {
      where.pricingModel = pricingModel;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    // Get total count
    const total = await this.prisma.adPackagePricing.count({ where });

    // Calculate pagination
    const totalPages = Math.ceil(total / limit);
    const skip = (page - 1) * limit;

    // Fetch pricing options with package info
    const pricingOptions = await this.prisma.adPackagePricing.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ package: { name: 'asc' } }, { finalPrice: 'asc' }],
      include: {
        package: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    return {
      pricing: pricingOptions.map((p) => this.mapToResponseDto(p)),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Get a single pricing option by ID
   */
  async getPricingById(pricingId: string): Promise<AdminPricingResponseDto> {
    const pricing = await this.prisma.adPackagePricing.findUnique({
      where: { id: pricingId },
    });

    if (!pricing) {
      throw new NotFoundException({
        code: 'PRICING_NOT_FOUND',
        message: 'Pricing option not found',
      });
    }

    return this.mapToResponseDto(pricing);
  }

  /**
   * Update a pricing option
   */
  async updatePricing(
    pricingId: string,
    dto: AdminUpdatePricingDto,
  ): Promise<AdminPricingResponseDto> {
    const existingPricing = await this.prisma.adPackagePricing.findUnique({
      where: { id: pricingId },
      select: { id: true, basePrice: true, discountRate: true },
    });

    if (!existingPricing) {
      throw new NotFoundException({
        code: 'PRICING_NOT_FOUND',
        message: 'Pricing option not found',
      });
    }

    // Validate duration fields for DURATION pricing model
    if (dto.pricingModel === PricingModel.DURATION) {
      if (!dto.durationValue || !dto.durationUnit) {
        throw new BadRequestException({
          code: 'INVALID_DURATION_PRICING',
          message:
            'Duration value and unit are required for DURATION pricing model',
        });
      }
    }

    // Calculate final price if base price or discount rate changed
    let finalPrice: bigint | undefined;
    if (dto.basePrice !== undefined || dto.discountRate !== undefined) {
      const basePrice = dto.basePrice ?? Number(existingPricing.basePrice);
      const discountRate =
        dto.discountRate ?? Number(existingPricing.discountRate);
      finalPrice = BigInt(Math.round(basePrice * (1 - discountRate / 100)));
    }

    const updateData: Prisma.AdPackagePricingUpdateInput = {};

    if (dto.pricingModel !== undefined)
      updateData.pricingModel = dto.pricingModel;
    if (dto.durationValue !== undefined)
      updateData.durationValue = dto.durationValue;
    if (dto.durationUnit !== undefined)
      updateData.durationUnit = dto.durationUnit;
    if (dto.basePrice !== undefined)
      updateData.basePrice = BigInt(dto.basePrice);
    if (dto.discountRate !== undefined)
      updateData.discountRate = dto.discountRate;
    if (finalPrice !== undefined) updateData.finalPrice = finalPrice;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    const pricing = await this.prisma.adPackagePricing.update({
      where: { id: pricingId },
      data: updateData,
      include: {
        package: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    return this.mapToResponseDto(pricing);
  }

  /**
   * Delete a pricing option
   */
  async deletePricing(pricingId: string): Promise<{ message: string }> {
    const pricing = await this.prisma.adPackagePricing.findUnique({
      where: { id: pricingId },
      select: { id: true },
    });

    if (!pricing) {
      throw new NotFoundException({
        code: 'PRICING_NOT_FOUND',
        message: 'Pricing option not found',
      });
    }

    // Check if pricing is used in any orders or active ads
    const [orderItemsCount, activeAdsCount] = await Promise.all([
      this.prisma.adOrderItem.count({
        where: { pricingId },
      }),
      this.prisma.activeAd.count({
        where: { pricingId },
      }),
    ]);

    if (orderItemsCount > 0 || activeAdsCount > 0) {
      throw new BadRequestException({
        code: 'PRICING_IN_USE',
        message:
          'Cannot delete pricing option that is used in orders or active ads. Consider deactivating it instead.',
      });
    }

    await this.prisma.adPackagePricing.delete({
      where: { id: pricingId },
    });

    return { message: 'Pricing option deleted successfully' };
  }

  /**
   * Map Prisma result to response DTO
   */
  private mapToResponseDto(pricing: AdPackagePricing): AdminPricingResponseDto {
    return {
      id: pricing.id,
      packageId: pricing.packageId,
      pricingModel: pricing.pricingModel,
      durationValue: pricing.durationValue,
      durationUnit: pricing.durationUnit,
      basePrice: Number(pricing.basePrice),
      discountRate: Number(pricing.discountRate),
      finalPrice: Number(pricing.finalPrice),
      isActive: pricing.isActive,
      createdAt: pricing.createdAt,
    };
  }
}
