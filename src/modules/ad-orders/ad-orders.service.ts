import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AdOrderStatus,
  AdPackageType,
  DurationUnit,
  PricingModel,
  Prisma,
  AdPackageType as AdPackageTypeEnum,
} from '@prisma/client';
import { Readable } from 'stream';
import { PointsSource } from '../../common/enums/points-source.enum';
import { PrismaService } from '../../database/prisma.service';
import { FileGeneratingService } from '../file-generating/file-generating.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { MailService } from '../mail/mail.service';
import { AuditService } from '../audit/audit.service';
import { AUDIT_ACTION, AUDIT_ENTITY } from '../audit/audit.constants';
import { AdOrdersErrors } from './ad-orders.errors';

const SENTINEL_DATE = new Date('2999-12-31T00:00:00.000Z');

const SLOT_CAPACITY: Partial<Record<AdPackageType, number>> = {
  [AdPackageTypeEnum.POPUP_PRIORITY_SLOT]: 1,
  [AdPackageTypeEnum.POPUP_ROTATION_SLOT]: 4,
};
import type {
  AdminListOrdersQueryDto,
  AdminOrderDto,
} from './dto/admin-list-orders.dto';
import type {
  AdminApproveOrderDto,
  AdminRejectOrderDto,
} from './dto/admin-order-actions.dto';
import type { CreateAdOrderDto } from './dto/create-ad-order.dto';
import type { UploadAdOrderAssetsDto } from './dto/upload-ad-order-assets.dto';
import type {
  UserOrderDto,
  UserOrderHistoryQueryDto,
} from './dto/user-order-history.dto';

export type AdOrderAssetItem = {
  id: string;
  orderItemId: string;
  assetType: string;
  fileUrl: string | null;
  fileSizeKb: number | null;
  notes: string | null;
  createdAt: Date;
};

export type AdOrderItemSummary = {
  id: string;
  orderId: string;
  packageId: string;
  pricingId: string;
  durationValue: number | null;
  durationUnit: string | null;
  startDate: Date;
  designServiceRequired: boolean;
  adLinkUrl: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  createdAt: Date;
  assets: AdOrderAssetItem[];
};

export type AdOrderSummary = {
  id: string;
  userId: string;
  companyId: string | null;
  status: AdOrderStatus;
  subtotal: number;
  notes: string | null;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  items: AdOrderItemSummary[];
};

type UpdatedOrderType = Prisma.AdOrderGetPayload<{
  include: {
    items: {
      include: {
        assets: true;
      };
    };
  };
}>;

@Injectable()
export class AdOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileGeneratingService: FileGeneratingService,
    private readonly mailService: MailService,
    private readonly loyaltyService: LoyaltyService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Create a draft ad order with its items in a single transaction.
   * The order status remains DRAFT until assets are attached in step two.
   */
  async createDraftOrder(
    userId: string,
    dto: CreateAdOrderDto,
  ): Promise<AdOrderSummary> {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException(AdOrdersErrors.INVALID_ITEMS_EMPTY);
    }

    const pricingIdSet = new Set<string>();
    for (const item of dto.items) {
      if (pricingIdSet.has(item.pricingId)) {
        throw new BadRequestException(AdOrdersErrors.INVALID_ITEMS_DUPLICATE);
      }
      pricingIdSet.add(item.pricingId);
    }

    const pricingIds = dto.items.map((item) => item.pricingId);
    const pricingList = await this.prisma.adPackagePricing.findMany({
      where: {
        id: { in: pricingIds },
        isActive: true,
        deletedAt: null,
      },
      include: {
        package: { select: { type: true } },
      },
    });
    if (pricingList.length !== dto.items.length) {
      throw new BadRequestException(AdOrdersErrors.INVALID_PRICING_SET);
    }

    const pricingById = new Map(
      pricingList.map((pricing) => [pricing.id, pricing]),
    );

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, companyId: true },
    });
    if (!user) {
      throw new NotFoundException(AdOrdersErrors.USER_NOT_FOUND);
    }

    // Check slot availability for slot-limited package types
    for (const item of dto.items) {
      const pricing = pricingById.get(item.pricingId);
      if (!pricing) continue;
      const packageType = pricing.package.type;
      if (!SLOT_CAPACITY[packageType]) continue;

      const startDate = new Date(item.startDate);
      const projectedEndDate =
        pricing.pricingModel === PricingModel.DURATION && pricing.durationUnit
          ? this.calculateEndDate(
              startDate,
              pricing.durationValue ?? 0,
              pricing.durationUnit,
            )
          : null;

      await this.checkSlotAvailability(
        this.prisma,
        packageType,
        startDate,
        projectedEndDate,
      );
    }

    let subtotal = BigInt(0);
    const itemsData = dto.items.map((item) => {
      const pricing = pricingById.get(item.pricingId);
      if (!pricing) {
        throw new BadRequestException(AdOrdersErrors.INVALID_PRICING_NOT_FOUND);
      }
      const unitPrice = pricing.finalPrice;
      const quantity = 1;
      const lineTotal = unitPrice;
      subtotal += lineTotal;
      const startDate = new Date(item.startDate);
      if (Number.isNaN(startDate.getTime())) {
        throw new BadRequestException(AdOrdersErrors.INVALID_START_DATE_VALUE);
      }
      return {
        packageId: pricing.packageId,
        pricingId: item.pricingId,
        durationValue: pricing.durationValue ?? null,
        durationUnit: pricing.durationUnit ?? null,
        startDate,
        designServiceRequired: item.designServiceRequired,
        adLinkUrl: item.adLinkUrl,
        unitPrice,
        quantity,
        lineTotal,
      };
    });

    const createdOrder = await this.prisma.$transaction((tx) =>
      tx.adOrder.create({
        data: {
          userId,
          companyId: user.companyId ?? null,
          status: AdOrderStatus.DRAFT,
          subtotal,
          notes: dto.notes ?? null,
          items: {
            create: itemsData,
          },
        },
        include: {
          items: {
            include: {
              assets: true,
            },
          },
        },
      }),
    );

    return this.mapOrderToSummary(createdOrder);
  }

  /**
   * Attach assets to order items and submit the order.
   * This is step two of the two-step order creation flow.
   * The operation is transactional: either all assets are attached and the
   * order is submitted, or nothing is changed.
   */
  async attachAssetsAndSubmitOrder(
    userId: string,
    orderId: string,
    dto: UploadAdOrderAssetsDto,
  ): Promise<AdOrderSummary> {
    try {
      const updatedOrder: UpdatedOrderType = await this.prisma.$transaction(
        async (tx) => {
          const existingOrder = await tx.adOrder.findUnique({
            where: { id: orderId },
            include: {
              items: {
                include: {
                  assets: true,
                },
              },
            },
          });

          if (!existingOrder) {
            throw new NotFoundException(AdOrdersErrors.ORDER_NOT_FOUND);
          }
          if (existingOrder.userId !== userId) {
            throw new ForbiddenException(AdOrdersErrors.ORDER_NOT_OWNER);
          }
          if (existingOrder.status !== AdOrderStatus.DRAFT) {
            throw new BadRequestException(AdOrdersErrors.ORDER_NOT_DRAFT);
          }

          if (dto.assets && dto.assets.length > 0) {
            const itemByPricingId = new Map(
              existingOrder.items.map((item) => [item.pricingId, item.id]),
            );

            for (const asset of dto.assets) {
              const orderItemId = itemByPricingId.get(asset.pricingId);
              if (!orderItemId) {
                throw new BadRequestException(
                  AdOrdersErrors.INVALID_ASSET_PRICING_REF,
                );
              }
            }

            await tx.adOrderAsset.createMany({
              data: dto.assets.map((asset) => {
                const orderItemId = itemByPricingId.get(asset.pricingId);
                if (!orderItemId) {
                  throw new BadRequestException(
                    AdOrdersErrors.INVALID_ASSET_PRICING_REF,
                  );
                }
                return {
                  orderItemId,
                  assetType: asset.assetType,
                  fileUrl: asset.fileUrl,
                  fileSizeKb: asset.fileSizeKb ?? null,
                  notes: asset.notes ?? null,
                };
              }),
            });
          }

          const finalOrder = await tx.adOrder.update({
            where: { id: orderId },
            data: {
              status: AdOrderStatus.PENDING,
              submittedAt: new Date(),
            },
            include: {
              items: {
                include: {
                  assets: true,
                },
              },
            },
          });

          return finalOrder;
        },
      );

      await this.auditService.record({
        action: AUDIT_ACTION.AD_ORDER_CREATED,
        entityType: AUDIT_ENTITY.AD_ORDER,
        entityId: updatedOrder.id,
        actorId: userId,
        metadata: {
          subtotal: updatedOrder.subtotal.toString(),
          itemCount: updatedOrder.items.length,
        },
      });

      return this.mapOrderToSummary(updatedOrder);
    } catch (err) {
      await this.tryDeleteDraftOrder(userId, orderId);
      throw err;
    }
  }

  private async tryDeleteDraftOrder(
    userId: string,
    orderId: string,
  ): Promise<void> {
    try {
      const existingOrder = await this.prisma.adOrder.findUnique({
        where: { id: orderId },
        select: { id: true, userId: true, status: true },
      });
      if (!existingOrder) return;
      if (existingOrder.userId !== userId) return;
      if (existingOrder.status !== AdOrderStatus.DRAFT) return;
      await this.prisma.adOrder.delete({ where: { id: orderId } });
    } catch {
      return;
    }
  }

  private mapOrderToSummary(order: UpdatedOrderType): AdOrderSummary {
    const items: AdOrderItemSummary[] = order.items.map((item) => ({
      id: item.id,
      orderId: item.orderId,
      packageId: item.packageId,
      pricingId: item.pricingId,
      durationValue: item.durationValue ?? null,
      durationUnit: item.durationUnit ?? null,
      startDate: item.startDate,
      designServiceRequired: item.designServiceRequired,
      adLinkUrl: item.adLinkUrl,
      unitPrice: Number(item.unitPrice),
      quantity: item.quantity,
      lineTotal: Number(item.lineTotal),
      createdAt: item.createdAt,
      assets: item.assets.map((asset) => ({
        id: asset.id,
        orderItemId: asset.orderItemId,
        assetType: asset.assetType,
        fileUrl: asset.fileUrl ?? null,
        fileSizeKb: asset.fileSizeKb ?? null,
        notes: asset.notes ?? null,
        createdAt: asset.createdAt,
      })),
    }));

    return {
      id: order.id,
      userId: order.userId,
      companyId: order.companyId ?? null,
      status: order.status,
      subtotal: Number(order.subtotal),
      notes: order.notes ?? null,
      submittedAt: order.submittedAt ?? null,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      items,
    };
  }

  /**
   * Admin method to list orders with filtering, search, and pagination
   */
  async adminListOrders(query: AdminListOrdersQueryDto): Promise<{
    orders: AdminOrderDto[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const {
      status,
      search,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    // Build where clause
    const where: Prisma.AdOrderWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        {
          user: {
            email: {
              contains: search,
              mode: 'insensitive',
            },
          },
        },
        {
          company: {
            OR: [
              {
                companyNameVi: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                companyNameCn: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
            ],
          },
        },
      ];
    }

    // Get total count
    const total = await this.prisma.adOrder.count({ where });

    // Calculate pagination
    const totalPages = Math.ceil(total / limit);
    const skip = (page - 1) * limit;

    // Build sort clause
    const orderBy: Record<string, 'asc' | 'desc'> = {};
    if (sortBy === 'totalAmount') {
      orderBy.subtotal = sortOrder;
    } else {
      orderBy[sortBy] = sortOrder;
    }

    // Fetch orders with relations
    const orders = await this.prisma.adOrder.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
        company: {
          select: {
            id: true,
            companyNameVi: true,
            companyNameCn: true,
            email: true,
            contactName: true,
            phone: true,
          },
        },
        items: {
          include: {
            pricing: {
              include: {
                package: {
                  include: {
                    category: {
                      select: {
                        type: true,
                      },
                    },
                  },
                },
              },
            },
            assets: {
              select: {
                id: true,
                fileUrl: true,
                fileSizeKb: true,
                assetType: true,
              },
            },
          },
        },
      },
    });

    // Transform to DTO format
    const orderDtos: AdminOrderDto[] = orders.map((order) => ({
      id: order.id,
      status: order.status,
      totalAmount: Number(order.subtotal),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      user: {
        id: order.user.id,
        email: order.user.email,
      },
      company: order.company
        ? {
            id: order.company.id,
            nameVi: order.company.companyNameVi,
            nameCn: order.company.companyNameCn,
            email: order.company.email,
            contactName: order.company.contactName ?? '',
            phone: order.company.phone,
          }
        : {
            id: '',
            nameVi: '',
            nameCn: '',
            email: '',
            contactName: '',
            phone: '',
          },
      items: order.items.map((item) => ({
        id: item.id,
        pricingId: item.pricingId,
        packageId: item.pricing.packageId,
        packageName: item.pricing.package.name,
        packageType: item.pricing.package.type,
        pricingName: `${item.durationValue || 'N/A'} ${
          item.durationUnit || ''
        }`.trim(),
        pricingModel: item.pricing.pricingModel,
        categoryType: item.pricing.package.category?.type ?? null,
        durationValue: item.durationValue ?? item.pricing.durationValue ?? null,
        durationUnit: item.durationUnit ?? item.pricing.durationUnit ?? null,
        price: Number(item.unitPrice),
        designServiceRequired: item.designServiceRequired,
        startDate: item.startDate,
        adLinkUrl: item.adLinkUrl ?? undefined,
        assets: item.assets.map((asset) => ({
          id: asset.id,
          fileUrl: asset.fileUrl ?? '',
          fileSizeKb: asset.fileSizeKb ?? 0,
          assetType: asset.assetType,
        })),
        packageMetadata:
          (item.pricing.package.metadata as Record<string, unknown>) ?? null,
      })),
    }));

    return {
      orders: orderDtos,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  async getAdminOrdersMetrics(): Promise<{
    currentMonthRevenue: number;
    currentMonthOrders: {
      pending: number;
      approved: number;
      rejected: number;
      total: number;
    };
    monthlyGrowthPercentage: number;
  }> {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const currentMonthRange = {
      gte: currentMonthStart,
      lt: nextMonthStart,
    } as const;
    const lastMonthRange = {
      gte: lastMonthStart,
      lt: currentMonthStart,
    } as const;

    const [
      currentMonthRevenueAgg,
      lastMonthRevenueAgg,
      pendingCount,
      approvedCount,
      rejectedCount,
    ] = await Promise.all([
      this.prisma.adOrder.aggregate({
        where: {
          status: AdOrderStatus.APPROVED,
          createdAt: currentMonthRange,
        },
        _sum: { subtotal: true },
      }),
      this.prisma.adOrder.aggregate({
        where: {
          status: AdOrderStatus.APPROVED,
          createdAt: lastMonthRange,
        },
        _sum: { subtotal: true },
      }),
      this.prisma.adOrder.count({
        where: {
          status: AdOrderStatus.PENDING,
          createdAt: currentMonthRange,
        },
      }),
      this.prisma.adOrder.count({
        where: {
          status: AdOrderStatus.APPROVED,
          createdAt: currentMonthRange,
        },
      }),
      this.prisma.adOrder.count({
        where: {
          status: AdOrderStatus.REJECTED,
          createdAt: currentMonthRange,
        },
      }),
    ]);

    const currentMonthRevenueBigInt =
      currentMonthRevenueAgg._sum.subtotal ?? 0n;
    const lastMonthRevenueBigInt = lastMonthRevenueAgg._sum.subtotal ?? 0n;

    const currentMonthRevenue = Number(currentMonthRevenueBigInt);
    const lastMonthRevenue = Number(lastMonthRevenueBigInt);

    let monthlyGrowthPercentage = 0;
    if (lastMonthRevenue > 0) {
      monthlyGrowthPercentage =
        ((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100;
    }

    const total = pendingCount + approvedCount + rejectedCount;

    return {
      currentMonthRevenue,
      currentMonthOrders: {
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
        total,
      },
      monthlyGrowthPercentage,
    };
  }

  /**
   * User method to get their own order history
   */
  async getUserOrderHistory(
    userId: string,
    query: UserOrderHistoryQueryDto,
  ): Promise<{
    orders: UserOrderDto[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const {
      status,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    // Build where clause - only user's orders
    const where: {
      userId: string;
      status?: AdOrderStatus;
    } = {
      userId,
    };

    if (status) {
      where.status = status;
    }

    // Get total count
    const total = await this.prisma.adOrder.count({ where });

    // Calculate pagination
    const totalPages = Math.ceil(total / limit);
    const skip = (page - 1) * limit;

    // Build sort clause
    const orderBy: Record<string, 'asc' | 'desc'> = {};
    if (sortBy === 'totalAmount') {
      orderBy.subtotal = sortOrder;
    } else {
      orderBy[sortBy] = sortOrder;
    }

    // Fetch orders with relations
    const orders = await this.prisma.adOrder.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        items: {
          include: {
            pricing: {
              include: {
                package: {
                  select: {
                    name: true,
                  },
                },
              },
            },
            assets: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    // Transform to DTO format
    const orderDtos: UserOrderDto[] = orders.map((order) => ({
      id: order.id,
      status: order.status,
      totalAmount: Number(order.subtotal),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      submittedAt: order.submittedAt ?? undefined,
      items: order.items.map((item) => ({
        id: item.id,
        packageName: item.pricing.package.name,
        pricingName: `${item.pricing.durationValue || 'N/A'} ${
          item.pricing.durationUnit || ''
        }`.trim(),
        price: Number(item.unitPrice),
        designServiceRequired: item.designServiceRequired,
        startDate: item.startDate,
        adLinkUrl: item.adLinkUrl ?? undefined,
        assetsCount: item.assets.length,
      })),
    }));

    return {
      orders: orderDtos,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Get order invoice as PDF stream for the authenticated user.
   * User must own the order.
   */
  async getOrderInvoice(
    userId: string,
    orderId: string,
  ): Promise<{ stream: Readable; filename: string }> {
    const order = await this.prisma.adOrder.findUnique({
      where: { id: orderId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
        company: {
          select: {
            companyNameVi: true,
            companyNameCn: true,
            email: true,
            contactName: true,
            phone: true,
            address: true,
            taxId: true,
          },
        },
        items: {
          include: {
            pricing: {
              include: {
                package: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(AdOrdersErrors.ORDER_NOT_FOUND);
    }
    if (order.userId !== userId) {
      throw new ForbiddenException(AdOrdersErrors.ORDER_NOT_OWNER);
    }
    if (!order.company) {
      throw new NotFoundException(AdOrdersErrors.COMPANY_NOT_FOUND);
    }

    const invoiceData = {
      id: order.id,
      status: order.status,
      subtotal: order.subtotal,
      notes: order.notes,
      submittedAt: order.submittedAt,
      createdAt: order.createdAt,
      user: { email: order.user.email },
      company: {
        companyNameVi: order.company.companyNameVi,
        companyNameCn: order.company.companyNameCn,
        email: order.company.email,
        contactName: order.company.contactName ?? '',
        phone: order.company.phone,
        address: order.company.address ?? '',
        taxId: order.company.taxId,
      },
      items: order.items.map((item) => ({
        id: item.id,
        startDate: item.startDate,
        designServiceRequired: item.designServiceRequired,
        adLinkUrl: item.adLinkUrl,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        lineTotal: item.lineTotal,
        pricing: {
          durationValue: item.pricing.durationValue,
          durationUnit: item.pricing.durationUnit,
          package: { name: item.pricing.package.name },
        },
      })),
    };
    const stream =
      this.fileGeneratingService.generateOrderInvoicePdf(invoiceData);
    const filename = `invoice-${order.id}.pdf`;
    return { stream, filename };
  }

  /**
   * Admin method to approve an order
   */
  async approveOrder(
    orderId: string,
    adminUserId: string,
    dto: AdminApproveOrderDto,
  ): Promise<{ id: string; status: AdOrderStatus; message: string }> {
    const { result, orderData } = await this.prisma.$transaction(async (tx) => {
      // Check if order exists and is in PENDING status
      const order = await tx.adOrder.findUnique({
        where: { id: orderId },
        include: {
          items: {
            include: {
              pricing: {
                include: {
                  package: true,
                },
              },
              assets: {
                select: {
                  assetType: true,
                  fileUrl: true,
                  fileSizeKb: true,
                  notes: true,
                },
              },
            },
          },
          company: true,
        },
      });
      if (!order) {
        throw new NotFoundException(AdOrdersErrors.ORDER_NOT_FOUND);
      }
      if (order.status !== AdOrderStatus.PENDING) {
        throw new BadRequestException(AdOrdersErrors.ORDER_NOT_PENDING);
      }
      if (!order.companyId) {
        throw new BadRequestException(AdOrdersErrors.ORDER_COMPANY_REQUIRED);
      }
      const companyId: string = order.companyId;

      // Check slot availability for each slot-limited item before activating
      for (const item of order.items) {
        const packageType = item.pricing.package.type;
        if (!SLOT_CAPACITY[packageType]) continue;

        const projectedEndDate =
          item.pricing.pricingModel === PricingModel.DURATION &&
          item.pricing.durationUnit
            ? this.calculateEndDate(
                item.startDate,
                item.pricing.durationValue ?? 0,
                item.pricing.durationUnit,
              )
            : null;

        await this.checkSlotAvailability(
          tx,
          packageType,
          item.startDate,
          projectedEndDate,
        );
      }

      // Update order status
      const updatedOrder = await tx.adOrder.update({
        where: { id: orderId },
        data: {
          status: AdOrderStatus.APPROVED,
          lastUpdatedBy: adminUserId,
          lastUpdatedAt: new Date(),
          reason: dto.reason,
        },
      });
      // Create active ads for each order item
      await this.createActiveAdsFromOrder(
        tx,
        { id: order.id, companyId, items: order.items },
        adminUserId,
      );
      return {
        result: {
          id: updatedOrder.id,
          status: updatedOrder.status,
          message: 'Order approved successfully and ads activated',
        },
        orderData: {
          userId: order.userId,
          subtotal: order.subtotal,
        },
      };
    });

    // Award loyalty points and update totalSpending
    try {
      // AD_PURCHASE uses DYNAMIC points: 1 VND = 1 point
      const pointsAmount = Number(orderData.subtotal);

      await this.loyaltyService.awardPoints({
        userId: orderData.userId,
        points: pointsAmount,
        source: PointsSource.AD_PURCHASE,
        description: `Ad order #${result.id.slice(0, 8)} approved`,
        metadata: {
          orderId: result.id,
          subtotal: orderData.subtotal.toString(),
          approvedBy: adminUserId,
        },
      });

      // Update totalSpending for tier calculation
      await this.prisma.user.update({
        where: { id: orderData.userId },
        data: {
          totalSpending: { increment: orderData.subtotal },
        },
      });

      // Recalculate tier again after totalSpending is updated
      await this.loyaltyService.recalculateTier(orderData.userId);
    } catch (error) {
      // Log error but don't fail the approval (order is already approved)
      console.error('Failed to award ad purchase points:', error);
    }

    await this.auditService.record({
      action: AUDIT_ACTION.AD_ORDER_APPROVED,
      entityType: AUDIT_ENTITY.AD_ORDER,
      entityId: orderId,
      actorId: adminUserId,
      oldValue: AdOrderStatus.PENDING,
      newValue: AdOrderStatus.APPROVED,
      metadata: {
        subtotal: orderData.subtotal.toString(),
        reason: dto.reason,
      },
    });

    await this.mailService.sendAdOrderDecisionEmail(orderId, true, dto.reason);
    return result;
  }

  /**
   * Admin method to reject an order
   */
  async rejectOrder(
    orderId: string,
    adminUserId: string,
    dto: AdminRejectOrderDto,
  ): Promise<{ id: string; status: AdOrderStatus; message: string }> {
    // Check if order exists and is in PENDING status
    const order = await this.prisma.adOrder.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(AdOrdersErrors.ORDER_NOT_FOUND);
    }

    if (order.status !== AdOrderStatus.PENDING) {
      throw new BadRequestException({
        code: 'AD_ORDER_INVALID_STATUS',
        message: 'Only pending orders can be rejected',
      });
    }

    // Update order status
    const updatedOrder = await this.prisma.adOrder.update({
      where: { id: orderId },
      data: {
        status: AdOrderStatus.REJECTED,
        lastUpdatedBy: adminUserId,
        lastUpdatedAt: new Date(),
        reason: dto.reason,
      },
    });

    await this.auditService.record({
      action: AUDIT_ACTION.AD_ORDER_REJECTED,
      entityType: AUDIT_ENTITY.AD_ORDER,
      entityId: orderId,
      actorId: adminUserId,
      oldValue: AdOrderStatus.PENDING,
      newValue: AdOrderStatus.REJECTED,
      metadata: {
        reason: dto.reason,
      },
    });

    await this.mailService.sendAdOrderDecisionEmail(orderId, false, dto.reason);

    return {
      id: updatedOrder.id,
      status: updatedOrder.status,
      message: 'Order rejected successfully',
    };
  }

  /**
   * Create active ads from approved order
   */
  private async createActiveAdsFromOrder(
    tx: Prisma.TransactionClient,
    order: {
      id: string;
      companyId: string;
      items: {
        id: string;
        pricingId: string;
        startDate: Date;
        adLinkUrl: string;
        assets: Array<{
          assetType: string;
          fileUrl: string | null;
          fileSizeKb: number | null;
          notes: string | null;
        }>;
        pricing: {
          id: string;
          pricingModel: PricingModel;
          durationValue: number | null;
          durationUnit: DurationUnit | null;
          package: { type: AdPackageType };
        };
      }[];
    },
    approvedBy: string,
  ): Promise<void> {
    for (const item of order.items) {
      const pricing = item.pricing;

      let endDate: Date | null = null;
      let totalQuantity: number | null = null;

      switch (pricing.pricingModel) {
        case PricingModel.DURATION:
          if (!pricing.durationUnit) {
            throw new Error('Duration unit is required');
          }
          endDate = this.calculateEndDate(
            item.startDate,
            pricing.durationValue ?? 0,
            pricing.durationUnit,
          );
          break;

        case PricingModel.PER_ACTION:
          // Each approved purchase of this package adds one allowed action.
          totalQuantity = 1;
          break;

        case PricingModel.ONE_TIME:
          // endDate stays null, totalQuantity stays null
          break;
      }

      const activeAd = await tx.activeAd.create({
        data: {
          companyId: order.companyId,
          orderId: order.id,
          orderItemId: item.id,
          pricingId: item.pricingId,
          packageType: pricing.package.type,
          pricingModel: pricing.pricingModel,
          startDate: item.startDate,
          endDate: endDate ?? null,
          totalQuantity: totalQuantity ?? null,
          usedQuantity: 0,
          adLinkUrl: item.adLinkUrl,
          approvedBy,
          approvedAt: new Date(),
          createdAt: new Date(),
        },
      });

      if (item.assets.length > 0) {
        await tx.activeAdAsset.createMany({
          data: item.assets.map((asset) => ({
            activeAdId: activeAd.id,
            assetType: asset.assetType,
            fileUrl: asset.fileUrl ?? null,
            fileSizeKb: asset.fileSizeKb ?? null,
            notes: asset.notes ?? null,
          })),
        });
      }

      // Audit log for each active ad created from order
      await this.auditService.record({
        action: AUDIT_ACTION.ACTIVE_AD_CREATED,
        entityType: AUDIT_ENTITY.ACTIVE_AD,
        entityId: activeAd.id,
        actorId: approvedBy,
        metadata: {
          orderId: order.id,
          orderItemId: item.id,
          companyId: order.companyId,
          packageType: pricing.package.type,
          pricingModel: pricing.pricingModel,
        },
      });
    }
  }

  /**
   * Throws SLOT_NOT_AVAILABLE if the slot-limited package type is at capacity
   * for the requested [startDate, endDate] range.
   * Accepts either PrismaService or a transaction client.
   */
  private async checkSlotAvailability(
    db: { activeAd: PrismaService['activeAd'] },
    packageType: AdPackageType,
    startDate: Date,
    endDate: Date | null,
  ): Promise<void> {
    const capacity = SLOT_CAPACITY[packageType];
    if (!capacity) return;

    const effectiveEndDate = endDate ?? SENTINEL_DATE;

    const occupiedCount = await db.activeAd.count({
      where: {
        packageType,
        isActive: true,
        startDate: { lt: effectiveEndDate },
        OR: [{ endDate: null }, { endDate: { gt: startDate } }],
      },
    });

    if (occupiedCount >= capacity) {
      throw new BadRequestException(AdOrdersErrors.SLOT_NOT_AVAILABLE);
    }
  }

  /**
   * Calculate end date based on duration
   */
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
