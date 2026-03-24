import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AdPackagePricing, PricingModel, type Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AUDIT_ACTION, AUDIT_ENTITY } from '../audit/audit.constants';
import type { AdminCreatePricingDto } from './dto/admin-create-pricing.dto';
import type {
  AdminPricingListQueryDto,
  AdminPricingListResponseDto,
  AdminPricingResponseDto,
} from './dto/admin-pricing-response.dto';
import type { AdminUpdatePricingDto } from './dto/admin-update-pricing.dto';

@Injectable()
export class AdPackagePricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Create a new pricing option for an ad package
   */
  async createPricing(
    packageId: string,
    dto: AdminCreatePricingDto,
    adminUserId?: string,
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

    await this.auditService.record({
      action: AUDIT_ACTION.AD_PRICING_CREATED,
      entityType: AUDIT_ENTITY.AD_PRICING,
      entityId: pricing.id,
      actorId: adminUserId ?? null,
      metadata: {
        packageId,
        packageName: adPackage.name,
        pricingModel: dto.pricingModel,
        finalPrice: finalPrice.toString(),
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
    const {
      packageId,
      pricingModel,
      isActive,
      includeDeleted = false,
      page = 1,
      limit = 20,
    } = query;

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

    if (!includeDeleted) {
      where.deletedAt = null;
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
    adminUserId?: string,
  ): Promise<AdminPricingResponseDto> {
    const existingPricing = await this.prisma.adPackagePricing.findUnique({
      where: { id: pricingId },
      select: {
        id: true,
        basePrice: true,
        discountRate: true,
        deletedAt: true,
      },
    });

    if (!existingPricing) {
      throw new NotFoundException({
        code: 'PRICING_NOT_FOUND',
        message: 'Pricing option not found',
      });
    }

    if (existingPricing.deletedAt) {
      throw new BadRequestException({
        code: 'PRICING_DELETED',
        message:
          'Cannot update a deleted pricing option. Restore it first if needed.',
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

    await this.auditService.record({
      action: AUDIT_ACTION.AD_PRICING_UPDATED,
      entityType: AUDIT_ENTITY.AD_PRICING,
      entityId: pricingId,
      actorId: adminUserId ?? null,
      metadata: {
        updatedFields: Object.keys(dto).filter(k => dto[k] !== undefined),
        packageName: pricing.package.name,
      },
    });

    return this.mapToResponseDto(pricing);
  }

  /**
   * Delete a pricing option (soft delete).
   * Sets deletedAt so the row is kept for referential integrity with orders/active ads.
   */
  async deletePricing(pricingId: string, adminUserId?: string): Promise<{ message: string }> {
    const pricing = await this.prisma.adPackagePricing.findUnique({
      where: { id: pricingId },
      select: { id: true, deletedAt: true, package: { select: { name: true } } },
    });

    if (!pricing) {
      throw new NotFoundException({
        code: 'PRICING_NOT_FOUND',
        message: 'Pricing option not found',
      });
    }

    if (pricing.deletedAt) {
      return { message: 'Pricing option was already deleted' };
    }

    await this.prisma.adPackagePricing.update({
      where: { id: pricingId },
      data: { deletedAt: new Date() },
    });

    await this.auditService.record({
      action: AUDIT_ACTION.AD_PRICING_DELETED,
      entityType: AUDIT_ENTITY.AD_PRICING,
      entityId: pricingId,
      actorId: adminUserId ?? null,
      metadata: {
        packageName: pricing.package.name,
      },
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
      deletedAt: pricing.deletedAt ?? undefined,
    };
  }
}
