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
} from '@prisma/client';
import { Readable } from 'stream';
import { PointsSource } from '../../common/enums/points-source.enum';
import { Role, ROLE_HIERARCHY } from '../../common/enums/role.enum';
import type { UserPayload } from '../../common/interfaces/user-payload.interface';
import { PrismaService } from '../../database/prisma.service';
import { ActiveAdsService } from '../active-ads/active-ads.service';
import { getPackageFormConfig, SLOT_CAPACITY } from '../ads/ads.constants';
import { AUDIT_ACTION, AUDIT_ENTITY } from '../audit/audit.constants';
import { AuditService } from '../audit/audit.service';
import { CompaniesService } from '../companies/companies.service';
import {
  CONTACT_TYPE,
  getPrimaryContactNameFromContactRows,
  getPrimaryPhoneValueFromContactRows,
} from '../companies/company-contact.constants';
import { FileGeneratingService } from '../file-generating/file-generating.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { MailService } from '../mail/mail.service';
import { AdOrdersErrors } from './ad-orders.errors';
import type { AdOrderPreviewResponseDto } from './dto/ad-order-preview-response.dto';
import type {
  AdminListOrdersQueryDto,
  AdminOrderDto,
} from './dto/admin-list-orders.dto';
import type {
  AdminApproveOrderDto,
  AdminEditPendingOrderDto,
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
    private readonly activeAdsService: ActiveAdsService,
    private readonly companiesService: CompaniesService,
  ) {}

  private getCompanyContactValue(
    contacts: ReadonlyArray<{
      type: string;
      value: string;
      contactName?: string | null;
    }>,
    type: string,
  ): string | null {
    const found = contacts.find((contact) => contact.type === type);
    return found?.value ?? null;
  }

  private mapCompanyContactView(
    company:
      | {
          taxId?: string | null;
          companyContacts?: Array<{
            type: string;
            value: string;
            contactName: string | null;
          }>;
        }
      | null
      | undefined,
  ): {
    email: string;
    contactName: string;
    phone: string;
    address: string;
    taxId: string | null;
  } {
    const contacts = company?.companyContacts ?? [];
    return {
      email:
        (this.getCompanyContactValue(contacts, CONTACT_TYPE.REGISTER_EMAIL) ??
          this.getCompanyContactValue(contacts, CONTACT_TYPE.EMAIL)) ??
        '',
      contactName: getPrimaryContactNameFromContactRows(contacts) ?? '',
      phone: getPrimaryPhoneValueFromContactRows(contacts),
      address:
        this.getCompanyContactValue(contacts, CONTACT_TYPE.ADDRESS) ?? '',
      taxId: company?.taxId ?? null,
    };
  }

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

      await this.activeAdsService.checkSlotAvailability({
        db: this.prisma,
        packageType,
        startDate,
        endDate: projectedEndDate,
      });
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
    const where: Prisma.AdOrderWhereInput = {
      status: { not: AdOrderStatus.DRAFT },
    };

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
                companyNameZh: {
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
            companyNameZh: true,
            taxId: true,
            companyContacts: {
              select: {
                type: true,
                value: true,
                contactName: true,
              },
            },
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
            nameCn: order.company.companyNameZh,
            email: this.mapCompanyContactView(order.company).email,
            contactName: this.mapCompanyContactView(order.company).contactName,
            phone: this.mapCompanyContactView(order.company).phone,
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
        formConfig: getPackageFormConfig(item.pricing.package.type),
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
                    type: true,
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
        pricingId: item.pricingId,
        packageName: item.pricing.package.name,
        packageType: item.pricing.package.type,
        pricingName: `${item.pricing.durationValue || 'N/A'} ${
          item.pricing.durationUnit || ''
        }`.trim(),
        price: Number(item.unitPrice),
        designServiceRequired: item.designServiceRequired,
        startDate: item.startDate,
        durationValue: item.pricing.durationValue,
        durationUnit: item.pricing.durationUnit,
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
            companyNameZh: true,
            taxId: true,
            companyContacts: {
              select: {
                type: true,
                value: true,
                contactName: true,
              },
            },
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

    const companyContactView = this.mapCompanyContactView(order.company);
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
        companyNameZh: order.company.companyNameZh,
        email: companyContactView.email,
        contactName: companyContactView.contactName,
        phone: companyContactView.phone,
        address: companyContactView.address,
        taxId: companyContactView.taxId,
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

        await this.activeAdsService.checkSlotAvailability({
          db: tx,
          packageType,
          startDate: item.startDate,
          endDate: projectedEndDate,
        });
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
   * Admin method to get a single order by ID with full details
   */
  async adminGetOrderById(orderId: string): Promise<AdminOrderDto> {
    const order = await this.prisma.adOrder.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { id: true, email: true } },
        company: {
          select: {
            id: true,
            companyNameVi: true,
            companyNameZh: true,
            taxId: true,
            companyContacts: {
              select: {
                type: true,
                value: true,
                contactName: true,
              },
            },
          },
        },
        items: {
          include: {
            pricing: {
              include: {
                package: {
                  include: { category: { select: { type: true } } },
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

    if (!order) {
      throw new NotFoundException(AdOrdersErrors.ORDER_NOT_FOUND);
    }

    return {
      id: order.id,
      status: order.status,
      totalAmount: Number(order.subtotal),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      user: { id: order.user.id, email: order.user.email },
      company: order.company
        ? {
            id: order.company.id,
            nameVi: order.company.companyNameVi,
            nameCn: order.company.companyNameZh,
            email: this.mapCompanyContactView(order.company).email,
            contactName: this.mapCompanyContactView(order.company).contactName,
            phone: this.mapCompanyContactView(order.company).phone,
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
        pricingName:
          `${item.durationValue || 'N/A'} ${item.durationUnit || ''}`.trim(),
        pricingModel: item.pricing.pricingModel,
        categoryType: item.pricing.package.category?.type ?? null,
        durationValue: item.durationValue ?? item.pricing.durationValue ?? null,
        durationUnit: item.durationUnit ?? item.pricing.durationUnit ?? null,
        price: Number(item.unitPrice),
        designServiceRequired: item.designServiceRequired,
        startDate: item.startDate,
        adLinkUrl: item.adLinkUrl ?? undefined,
        assets: item.assets.map((a) => ({
          id: a.id,
          fileUrl: a.fileUrl ?? '',
          fileSizeKb: a.fileSizeKb ?? 0,
          assetType: a.assetType,
        })),
        packageMetadata:
          (item.pricing.package.metadata as Record<string, unknown>) ?? null,
        formConfig: getPackageFormConfig(item.pricing.package.type),
      })),
    };
  }

  /**
   * Admin method to edit a DRAFT or PENDING order:
   * - Update notes / per-item fields / replace assets on existing items
   * - Append Homepage Popup add-on items (POPUP_PRIORITY_DETAILS_LINK, POPUP_ROTATION_DETAILS_LINK, POPUP_RANKING_ADJUSTMENT)
   * - Recalculates subtotal based on all changes
   */
  async adminEditPendingOrder(
    orderId: string,
    adminUserId: string,
    dto: AdminEditPendingOrderDto,
  ): Promise<AdOrderSummary> {
    const ADDON_ALLOWED_TYPES: AdPackageType[] = [
      AdPackageType.POPUP_PRIORITY_DETAILS_LINK,
      AdPackageType.POPUP_ROTATION_DETAILS_LINK,
      AdPackageType.POPUP_RANKING_ADJUSTMENT,
    ];

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      // 1. Fetch order with items + assets + package type (needed for add-on validation)
      const order = await tx.adOrder.findUnique({
        where: { id: orderId },
        include: {
          items: {
            include: {
              assets: true,
              pricing: { include: { package: true } },
            },
          },
        },
      });

      if (!order) {
        throw new NotFoundException(AdOrdersErrors.ORDER_NOT_FOUND);
      }
      if (
        order.status !== AdOrderStatus.DRAFT &&
        order.status !== AdOrderStatus.PENDING
      ) {
        throw new BadRequestException(AdOrdersErrors.ORDER_NOT_EDITABLE);
      }

      const itemById = new Map(order.items.map((i) => [i.id, i]));

      // 0. Pre-validate: block if all items would be removed
      const deleteCount = dto.deleteItemIds?.length ?? 0;
      const addCount = dto.newItems?.length ?? 0;
      const remainingCount = order.items.length - deleteCount + addCount;
      if (remainingCount <= 0) {
        throw new BadRequestException(AdOrdersErrors.ORDER_CANNOT_BE_EMPTY);
      }

      // 2a. Edit existing items
      if (dto.items && dto.items.length > 0) {
        for (const edit of dto.items) {
          if (!itemById.has(edit.itemId)) {
            throw new BadRequestException(
              AdOrdersErrors.EDIT_ITEM_NOT_IN_ORDER,
            );
          }

          const updateData: Prisma.AdOrderItemUpdateInput = {};
          if (edit.adLinkUrl !== undefined)
            updateData.adLinkUrl = edit.adLinkUrl;
          if (edit.startDate !== undefined)
            updateData.startDate = new Date(edit.startDate);
          if (edit.designServiceRequired !== undefined)
            updateData.designServiceRequired = edit.designServiceRequired;

          if (Object.keys(updateData).length > 0) {
            await tx.adOrderItem.update({
              where: { id: edit.itemId },
              data: updateData,
            });
          }

          if (edit.assets !== undefined) {
            await tx.adOrderAsset.deleteMany({
              where: { orderItemId: edit.itemId },
            });
            if (edit.assets.length > 0) {
              await tx.adOrderAsset.createMany({
                data: edit.assets.map((a) => ({
                  orderItemId: edit.itemId,
                  assetType: a.assetType,
                  fileUrl: a.fileUrl,
                  fileSizeKb: a.fileSizeKb ?? null,
                  notes: a.notes ?? null,
                })),
              });
            }
          }
        }
      }

      // 2b. Delete items
      let deleteSubtotalDelta = BigInt(0);
      if (dto.deleteItemIds && dto.deleteItemIds.length > 0) {
        for (const itemId of dto.deleteItemIds) {
          if (!itemById.has(itemId)) {
            throw new BadRequestException(
              AdOrdersErrors.EDIT_ITEM_NOT_IN_ORDER,
            );
          }
          deleteSubtotalDelta += BigInt(
            itemById.get(itemId)!.lineTotal.toString(),
          );
        }
        await tx.adOrderItem.deleteMany({
          where: { id: { in: dto.deleteItemIds } },
        });
      }

      // 2c. Add add-on items (POPUP_PRIORITY_DETAILS_LINK, POPUP_ROTATION_DETAILS_LINK, or POPUP_RANKING_ADJUSTMENT only)
      let addSubtotalDelta = BigInt(0);
      if (dto.newItems && dto.newItems.length > 0) {
        const pricingIds = dto.newItems.map((i) => i.pricingId);
        const pricingRecords = await tx.adPackagePricing.findMany({
          where: { id: { in: pricingIds }, isActive: true, deletedAt: null },
          include: { package: true },
        });

        if (pricingRecords.length !== pricingIds.length) {
          throw new BadRequestException(AdOrdersErrors.INVALID_PRICING_SET);
        }

        for (const pricing of pricingRecords) {
          if (!ADDON_ALLOWED_TYPES.includes(pricing.package.type)) {
            throw new BadRequestException(AdOrdersErrors.ADDON_INVALID_TYPE);
          }
        }

        const pricingMap = new Map(pricingRecords.map((p) => [p.id, p]));

        for (const newItem of dto.newItems) {
          const pricing = pricingMap.get(newItem.pricingId)!;
          const lineTotal = pricing.finalPrice;

          await tx.adOrderItem.create({
            data: {
              orderId,
              packageId: pricing.packageId,
              pricingId: pricing.id,
              durationValue: pricing.durationValue ?? null,
              durationUnit: pricing.durationUnit ?? null,
              startDate: new Date(newItem.startDate),
              designServiceRequired: newItem.designServiceRequired,
              adLinkUrl: newItem.adLinkUrl ?? '',
              unitPrice: pricing.finalPrice,
              quantity: 1,
              lineTotal,
            },
          });

          addSubtotalDelta += BigInt(lineTotal.toString());
        }
      }

      // 2d. Update order-level fields + recalculate subtotal
      const subtotalDelta = addSubtotalDelta - deleteSubtotalDelta;
      const orderUpdate: Prisma.AdOrderUpdateInput = {
        lastUpdatedBy: adminUserId,
        lastUpdatedAt: new Date(),
      };
      if (dto.notes !== undefined) orderUpdate.notes = dto.notes;
      if (subtotalDelta !== BigInt(0)) {
        orderUpdate.subtotal =
          subtotalDelta > BigInt(0)
            ? { increment: subtotalDelta }
            : { decrement: -subtotalDelta };
      }

      await tx.adOrder.update({ where: { id: orderId }, data: orderUpdate });

      // 3. Reload full order for response
      return tx.adOrder.findUniqueOrThrow({
        where: { id: orderId },
        include: { items: { include: { assets: true } } },
      });
    });

    await this.auditService.record({
      action: AUDIT_ACTION.AD_ORDER_UPDATED,
      entityType: AUDIT_ENTITY.AD_ORDER,
      entityId: orderId,
      actorId: adminUserId,
      metadata: {
        updatedItemCount: dto.items?.length ?? 0,
        deletedItemCount: dto.deleteItemIds?.length ?? 0,
        addedItemCount: dto.newItems?.length ?? 0,
      },
    });

    return this.mapOrderToSummary(updatedOrder);
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
      case DurationUnit.MONTH: {
        const targetMonth = end.getMonth() + value;
        end.setMonth(targetMonth);
        if (end.getMonth() !== ((targetMonth % 12) + 12) % 12) {
          end.setDate(0); // clamp to last day of target month
        }
        break;
      }
      case DurationUnit.YEAR: {
        const targetYear = end.getFullYear() + value;
        const origDay = end.getDate();
        end.setFullYear(targetYear);
        // Feb 29 on a non-leap year overflows to Mar 1 — clamp back
        if (end.getDate() !== origDay) {
          end.setDate(0);
        }
        break;
      }
    }

    return end;
  }

  async getAdOrderPreview(
    user: UserPayload,
    orderId: string,
  ): Promise<AdOrderPreviewResponseDto> {
    const order = await this.prisma.adOrder.findUnique({
      where: { id: orderId },
      include: {
        company: {
          select: {
            id: true,
            companyNameVi: true,
            companyNameEn: true,
            companyNameZh: true,
            taxId: true,
            logoUrl: true,
            industry: true,
            country: true,
            description: true,
            companyContacts: {
              select: {
                type: true,
                value: true,
                contactName: true,
              },
            },
          },
        },
        items: {
          include: {
            package: { select: { type: true, metadata: true } },
            assets: { select: { fileUrl: true, assetType: true } },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(AdOrdersErrors.ORDER_NOT_FOUND);
    }

    const isAdmin = ROLE_HIERARCHY[user.role] >= ROLE_HIERARCHY[Role.ADMIN];
    if (order.userId !== user.userId && !isAdmin) {
      throw new ForbiddenException(AdOrdersErrors.ORDER_ACCESS_DENIED);
    }

    if (!order.company) {
      throw new NotFoundException(AdOrdersErrors.COMPANY_NOT_FOUND);
    }

    const { company, items } = order;

    const POPUP_PRIORITY_TYPES = [
      AdPackageType.POPUP_PRIORITY_SLOT,
      AdPackageType.POPUP_RANKING_ADJUSTMENT,
      AdPackageType.POPUP_PRIORITY_DETAILS_LINK,
    ] as const;
    const POPUP_ROTATIONAL_TYPES = [
      AdPackageType.POPUP_ROTATION_SLOT,
      AdPackageType.POPUP_RANKING_ADJUSTMENT,
      AdPackageType.POPUP_ROTATION_DETAILS_LINK,
    ] as const;
    const FEATURED_TYPES = [
      AdPackageType.FEATURED_HOMEPAGE_DISPLAY,
      AdPackageType.FEATURED_HIGHLIGHT_BOOST,
    ] as const;

    const hasPrioritySlot = items.some(
      (i) => i.package.type === AdPackageType.POPUP_PRIORITY_SLOT,
    );
    const hasRotationalSlot = items.some(
      (i) => i.package.type === AdPackageType.POPUP_ROTATION_SLOT,
    );
    const hasFeaturedSlot = items.some(
      (i) => i.package.type === AdPackageType.FEATURED_HOMEPAGE_DISPLAY,
    );

    const buildVirtualAds = (types: readonly AdPackageType[]) => {
      const typeSet = new Set(types);
      return items
        .filter((i) => typeSet.has(i.package.type))
        .map((i) => ({
          id: i.id,
          companyId: company.id,
          packageType: i.package.type,
          orderItemId: i.id,
          adLinkUrl: i.adLinkUrl ?? null,
          metadata: (i.package.metadata as Record<string, unknown>) ?? {},
        }));
    };

    const popupPriority = hasPrioritySlot
      ? [
          this.companiesService.buildPreviewCompanyItem(
            company,
            buildVirtualAds(POPUP_PRIORITY_TYPES),
            [AdPackageType.POPUP_PRIORITY_SLOT],
            items,
          ),
        ]
      : [];

    const popupRotational = hasRotationalSlot
      ? [
          this.companiesService.buildPreviewCompanyItem(
            company,
            buildVirtualAds(POPUP_ROTATIONAL_TYPES),
            [AdPackageType.POPUP_ROTATION_SLOT],
            items,
          ),
        ]
      : [];

    const featuredCompanies = hasFeaturedSlot
      ? [
          this.companiesService.buildPreviewCompanyItem(
            company,
            buildVirtualAds(FEATURED_TYPES),
            [AdPackageType.FEATURED_HOMEPAGE_DISPLAY],
            items,
          ),
        ]
      : [];

    return {
      orderId: order.id,
      popupPriority,
      popupRotational,
      featuredCompanies,
    };
  }
}
