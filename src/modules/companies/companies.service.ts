import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AdPackageType, type Prisma } from '@prisma/client';
import { AUDIT_ACTION, AUDIT_ENTITY } from '../audit/audit.constants';
import { AuditService } from '../audit/audit.service';
import { UpdateProfileDto } from '../auth/dto/update-profile.dto';
import { PrismaService } from '../../database/prisma.service';
import { AdEffectsRegistryService } from '../ad-effects/ad-effects-registry.service';
import type {
  ActiveAdInfo,
  CompanyData,
} from '../ad-effects/interfaces/ad-effect.interface';
import type {
  CompanyCategoriesResponseDto,
  CompanyDirectoryItemDto,
  CompanyDirectoryQueryDto,
  CompanyDirectoryResponseDto,
} from './dto/company-directory.dto';
import type { CompanyDetailResponseDto } from './dto/company-detail.dto';
import type { CompanyWithAdsResponseDto } from './dto/company-with-ads-response.dto';
import type { CreateCompanyDto } from './dto/create-company.dto';

type CompanyAuditSnapshot = {
  id: string;
  email: string;
  logoUrl: string | null;
  companyNameVi: string | null;
  companyNameCn: string | null;
  phone: string;
  industry: string;
  address: string;
  description: string;
  taxId: string | null;
  country: string | null;
  region: string | null;
  website: string | null;
  contactName: string | null;
  contactPhone: string | null;
};

const ADMIN_AUDIT_COMPANY_SELECT = {
  id: true,
  email: true,
  logoUrl: true,
  companyNameVi: true,
  companyNameCn: true,
  phone: true,
  address: true,
  description: true,
  taxId: true,
  country: true,
  region: true,
  industry: true,
  website: true,
  contactName: true,
  contactPhone: true,
} as const;

type CompanyWithActiveAdsRecord = {
  id: string;
  companyNameVi: string | null;
  companyNameCn: string | null;
  logoUrl: string | null;
  email: string;
  contactName: string | null;
  phone: string;
  industry: string;
  address: string;
  description: string;
  activeAds: Array<{
    id: string;
    companyId: string;
    packageType: AdPackageType;
    orderItemId: string | null;
    adLinkUrl: string | null;
    pricing: { package: { metadata: unknown } };
    orderItem: { id: string; adLinkUrl: string } | null;
  }>;
};

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adEffectsRegistry: AdEffectsRegistryService,
    private readonly auditService: AuditService,
  ) {}

  async createCompany(dto: CreateCompanyDto, userId?: string) {
    const company = await this.prisma.company.create({
      data: {
        companyNameVi: dto.name,
        email: dto.email,
        contactName: dto.contactName,
        phone: dto.phone,
        industry: dto.industry,
        address: dto.address,
        description: dto.description,
      },
    });

    await this.auditService.record({
      action: AUDIT_ACTION.COMPANY_CREATED,
      entityType: AUDIT_ENTITY.COMPANY,
      entityId: company.id,
      actorId: userId ?? null,
      metadata: {
        name: dto.name,
        industry: dto.industry,
      },
    });

    return company;
  }

  async getCompanyDetail(companyId: string): Promise<CompanyDetailResponseDto> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        logoUrl: true,
        companyNameVi: true,
        companyNameCn: true,
        industry: true,
        email: true,
        phone: true,
        address: true,
        description: true,
        taxId: true,
        country: true,
        region: true,
        website: true,
        contactName: true,
        contactPhone: true,
      },
    });
    if (!company) {
      throw new NotFoundException('Company not found');
    }
    return company;
  }

  /**
   * Helper method to apply ad effects to a company and transform to response format
   */
  private applyEffectsToCompany(
    company: CompanyWithActiveAdsRecord,
  ): CompanyData {
    const displayName =
      company.companyNameVi ?? company.companyNameCn ?? company.email;
    const companyData: CompanyData = {
      id: company.id,
      name: displayName,
      email: company.email,
      contactName: company.contactName ?? '',
      phone: company.phone,
      industry: company.industry,
      address: company.address,
      description: company.description,
    };

    const activeAds: ActiveAdInfo[] = company.activeAds.map((ad) => ({
      id: ad.id,
      companyId: ad.companyId,
      packageType: ad.packageType,
      orderItemId: ad.orderItemId,
      adLinkUrl: ad.orderItem?.adLinkUrl ?? ad.adLinkUrl ?? null,
      metadata: (ad.pricing.package.metadata as Record<string, unknown>) || {},
    }));

    return this.adEffectsRegistry.applyEffects(companyData, activeAds);
  }

  /**
   * Get companies with POPUP_PRIORITY_SLOT or POPUP_ROTATION_SLOT ads.
   * Computes effects on the fly using active ads and the ad effects registry.
   */
  async getPopupCompanies(): Promise<CompanyWithAdsResponseDto[]> {
    return this.getPopupCompaniesBySlotTypes(
      [AdPackageType.POPUP_PRIORITY_SLOT, AdPackageType.POPUP_ROTATION_SLOT],
      [AdPackageType.POPUP_PRIORITY_SLOT, AdPackageType.POPUP_ROTATION_SLOT],
    );
  }

  /**
   * Get companies with POPUP_PRIORITY_SLOT ads.
   * Computes effects on the fly using active ads and the ad effects registry.
   */
  async getPopupPriorityCompanies(): Promise<CompanyWithAdsResponseDto[]> {
    return this.getPopupCompaniesBySlotTypes(
      [AdPackageType.POPUP_PRIORITY_SLOT],
      [
        AdPackageType.POPUP_PRIORITY_SLOT,
        AdPackageType.POPUP_RANKING_ADJUSTMENT,
      ],
    );
  }

  /**
   * Get companies with POPUP_ROTATION_SLOT ads.
   * Computes effects on the fly using active ads and the ad effects registry.
   */
  async getPopupRotationalCompanies(): Promise<CompanyWithAdsResponseDto[]> {
    return this.getPopupCompaniesBySlotTypes(
      [AdPackageType.POPUP_ROTATION_SLOT],
      [
        AdPackageType.POPUP_ROTATION_SLOT,
        AdPackageType.POPUP_RANKING_ADJUSTMENT,
      ],
    );
  }

  private async getPopupCompaniesBySlotTypes(
    requiredSlotTypes: readonly AdPackageType[],
    includedSlotTypes: readonly AdPackageType[],
  ): Promise<CompanyWithAdsResponseDto[]> {
    const now = new Date();

    const queryArgs: Prisma.CompanyFindManyArgs = {
      where: {
        activeAds: {
          some: {
            packageType: {
              in: [...requiredSlotTypes],
            },
            isActive: true,
            startDate: { lte: now },
            OR: [{ endDate: null }, { endDate: { gte: now } }],
          },
        },
      },
      include: {
        activeAds: {
          where: {
            isActive: true,
            startDate: { lte: now },
            OR: [{ endDate: null }, { endDate: { gte: now } }],
            packageType: {
              in: [...includedSlotTypes],
            },
          },
          include: {
            orderItem: {
              select: {
                id: true,
                adLinkUrl: true,
              },
            },
            pricing: {
              include: {
                package: {
                  select: {
                    metadata: true,
                  },
                },
              },
            },
          },
        },
      },
    } as const;

    const companies = (await this.prisma.company.findMany(
      queryArgs as unknown as Prisma.CompanyFindManyArgs,
    )) as unknown as CompanyWithActiveAdsRecord[];

    const responses: CompanyWithAdsResponseDto[] = companies.map((company) => {
      const modified = this.applyEffectsToCompany(company);
      const name =
        company.companyNameVi ?? company.companyNameCn ?? company.email;

      return {
        id: company.id,
        name,
        logoUrl: company.logoUrl,
        email: company.email,
        contactName: company.contactName ?? '',
        phone: company.phone,
        industry: company.industry,
        address: company.address,
        description: company.description,
        featuredHighlight: modified.featuredHighlight ?? false,
        companyInfoHighlight: modified.companyInfoHighlight ?? false,
        adLinkUrl: modified.adLinkUrl,
        sortPriority: modified.sortPriority ?? 0,
      };
    });

    responses.sort((a, b) => (b.sortPriority ?? 0) - (a.sortPriority ?? 0));

    return responses;
  }

  /**
   * Get companies with PRINT_PLACEMENT ads and their metadata.
   * Computes effects on the fly.
   */
  async getPrintPlacementCompanies(): Promise<CompanyWithAdsResponseDto[]> {
    const now = new Date();

    const queryArgs = {
      where: {
        activeAds: {
          some: {
            packageType: AdPackageType.PRINT_PLACEMENT,
            isActive: true,
            startDate: { lte: now },
            OR: [{ endDate: null }, { endDate: { gte: now } }],
          },
        },
      },
      include: {
        activeAds: {
          where: {
            isActive: true,
            startDate: { lte: now },
            OR: [{ endDate: null }, { endDate: { gte: now } }],
          },
          include: {
            orderItem: {
              select: {
                id: true,
                adLinkUrl: true,
              },
            },
            pricing: {
              include: {
                package: {
                  select: {
                    metadata: true,
                  },
                },
              },
            },
          },
        },
      },
    } as const;

    const companies = (await this.prisma.company.findMany(
      queryArgs as unknown as Prisma.CompanyFindManyArgs,
    )) as unknown as CompanyWithActiveAdsRecord[];

    const responses: CompanyWithAdsResponseDto[] = companies.map((company) => {
      const modified = this.applyEffectsToCompany(company);
      const name =
        company.companyNameVi ?? company.companyNameCn ?? company.email;

      const printPlacementAds = company.activeAds.filter(
        (ad) => ad.packageType === AdPackageType.PRINT_PLACEMENT,
      );

      const metadata: Record<string, unknown> = {
        printPlacements: printPlacementAds.map((ad) => ({
          adId: ad.id,
          orderItemId: ad.orderItemId,
          metadata:
            (ad.pricing.package.metadata as Record<string, unknown>) || {},
        })),
      };

      return {
        id: company.id,
        name,
        logoUrl: company.logoUrl,
        email: company.email,
        contactName: company.contactName ?? '',
        phone: company.phone,
        industry: company.industry,
        address: company.address,
        description: company.description,
        featuredHighlight: modified.featuredHighlight ?? false,
        companyInfoHighlight: modified.companyInfoHighlight ?? false,
        metadata,
        sortPriority: modified.sortPriority ?? 0,
      };
    });

    return responses;
  }

  /**
   * Get all companies with featured effects applied.
   * Computes effects on the fly using active ads.
   */
  async getFeaturedCompanies(): Promise<CompanyWithAdsResponseDto[]> {
    const now = new Date();

    const queryArgs = {
      where: {
        activeAds: {
          some: {
            packageType: AdPackageType.FEATURED_HOMEPAGE_DISPLAY,
            isActive: true,
            startDate: { lte: now },
            OR: [{ endDate: null }, { endDate: { gte: now } }],
          },
        },
      },
      include: {
        activeAds: {
          where: {
            packageType: {
              in: [
                AdPackageType.FEATURED_HOMEPAGE_DISPLAY,
                AdPackageType.FEATURED_HIGHLIGHT_BOOST,
              ],
            },
          },
          include: {
            orderItem: {
              select: {
                id: true,
                adLinkUrl: true,
              },
            },
            pricing: {
              include: {
                package: {
                  select: {
                    metadata: true,
                  },
                },
              },
            },
          },
        },
      },
    } as const;

    const companies = (await this.prisma.company.findMany(
      queryArgs as unknown as Prisma.CompanyFindManyArgs,
    )) as unknown as CompanyWithActiveAdsRecord[];

    const responses: CompanyWithAdsResponseDto[] = companies.map((company) => {
      const modified = this.applyEffectsToCompany(company);
      const name =
        company.companyNameVi ?? company.companyNameCn ?? company.email;

      return {
        id: company.id,
        name,
        logoUrl: company.logoUrl,
        email: company.email,
        contactName: company.contactName ?? '',
        phone: company.phone,
        industry: company.industry,
        address: company.address,
        description: company.description,
        featuredHighlight: modified.featuredHighlight ?? false,
        companyInfoHighlight: modified.companyInfoHighlight ?? false,
        sortPriority: modified.sortPriority ?? 0,
      };
    });

    responses.sort((a, b) => (b.sortPriority ?? 0) - (a.sortPriority ?? 0));

    return responses;
  }

  /**
   * Get all companies with search/filter capabilities.
   * Only applies COMPANY_CATEGORY_TOP and COMPANY_INFO_HIGHLIGHT ad effects.
   */
  async getCompanyDirectory(
    query: CompanyDirectoryQueryDto,
  ): Promise<CompanyDirectoryResponseDto> {
    const {
      search,
      industry,
      page = 1,
      limit = 20,
      sortBy = 'name',
      sortOrder = 'asc',
    } = query;

    const now = new Date();

    // Build where clause
    const where: Prisma.CompanyWhereInput = {};

    if (search) {
      where.OR = [
        { companyNameVi: { contains: search, mode: 'insensitive' } },
        { companyNameCn: { contains: search, mode: 'insensitive' } },
        { industry: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { region: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (industry && industry.length > 0) {
      const existingOr: Prisma.CompanyWhereInput[] = [];
      if (where.OR) {
        if (Array.isArray(where.OR)) existingOr.push(...where.OR);
        else existingOr.push(where.OR);
      }
      const industryOr: Prisma.CompanyWhereInput[] = industry.map((i) => ({
        industry: { contains: i, mode: 'insensitive' },
      }));
      where.OR = [...existingOr, ...industryOr];
    }

    // Get total count
    const total = await this.prisma.company.count({ where });

    // Calculate pagination
    const totalPages = Math.ceil(total / limit);
    const skip = (page - 1) * limit;

    // Build sort clause
    const orderBy: Prisma.CompanyOrderByWithRelationInput = {};
    if (sortBy === 'name') {
      orderBy.companyNameVi = sortOrder;
    } else if (sortBy === 'industry') {
      orderBy.industry = sortOrder;
    } else if (sortBy === 'region') {
      orderBy.region = sortOrder;
    } else {
      orderBy.createdAt = sortOrder;
    }

    // Fetch companies with their relevant active ads
    const queryArgs = {
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        activeAds: {
          where: {
            packageType: {
              in: [
                AdPackageType.COMPANY_CATEGORY_TOP,
                AdPackageType.COMPANY_INFO_HIGHLIGHT,
              ],
            },
            isActive: true,
            startDate: { lte: now },
            OR: [{ endDate: null }, { endDate: { gte: now } }],
          },
          include: {
            orderItem: {
              select: {
                id: true,
                adLinkUrl: true,
              },
            },
            pricing: {
              include: {
                package: {
                  select: {
                    metadata: true,
                  },
                },
              },
            },
          },
        },
      },
    } as const;

    const companies = (await this.prisma.company.findMany(
      queryArgs as unknown as Prisma.CompanyFindManyArgs,
    )) as unknown as CompanyWithActiveAdsRecord[];

    // Apply ad effects and transform to DTOs
    const companyItems: CompanyDirectoryItemDto[] = companies.map((company) => {
      const modified = this.applyEffectsToCompany(company);
      const name =
        company.companyNameVi ?? company.companyNameCn ?? company.email;

      return {
        id: company.id,
        name,
        logoUrl: company.logoUrl ?? null,
        email: company.email,
        contactName: company.contactName ?? '',
        phone: company.phone,
        industry: company.industry,
        address: company.address,
        description: company.description,
        companyInfoHighlight: modified.companyInfoHighlight ?? false,
        sortPriority: modified.sortPriority ?? 0,
      };
    });

    // Sort by priority if using default name sorting (to show promoted companies first)
    if (sortBy === 'name') {
      companyItems.sort((a, b) => {
        const priorityDiff = (b.sortPriority ?? 0) - (a.sortPriority ?? 0);
        if (priorityDiff !== 0) return priorityDiff;
        // Then by name
        return sortOrder === 'asc'
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      });
    }

    return {
      companies: companyItems,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  async getCompanyCategories(): Promise<CompanyCategoriesResponseDto> {
    const grouped = await this.prisma.company.groupBy({
      by: ['industry'],
      _count: {
        _all: true,
      },
    });
    const categories: CompanyCategoriesResponseDto['categories'] = grouped
      .filter((item) => item.industry !== null)
      .map((item) => ({
        industry: item.industry ?? '',
        count: item._count._all,
      }));
    return { categories };
  }

  async adminUpdateCompany(
    adminUserId: string,
    companyId: string,
    data: UpdateProfileDto,
  ): Promise<CompanyDetailResponseDto> {
    const companyExists = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });
    if (!companyExists) {
      throw new NotFoundException('Company not found');
    }

    const updateData = this.toAdminCompanyUpdateData(data);
    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('No valid company fields provided');
    }

    const companyBefore = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: ADMIN_AUDIT_COMPANY_SELECT,
    });
    await this.prisma.company.update({
      where: { id: companyId },
      data: updateData,
      select: { id: true },
    });

    const companyAfter = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: ADMIN_AUDIT_COMPANY_SELECT,
    });

    await this.auditService.record({
      entityType: AUDIT_ENTITY.COMPANY,
      action: AUDIT_ACTION.COMPANY_UPDATED_BY_ADMIN,
      entityId: companyId,
      actorId: adminUserId,
      oldValue: CompaniesService.serializeCompanyAuditPayload(companyBefore),
      newValue: CompaniesService.serializeCompanyAuditPayload(companyAfter),
    });

    const company = await this.getCompanyDetail(companyId);
    return company;
  }

  private static serializeCompanyAuditPayload(
    company: CompanyAuditSnapshot | null | undefined,
  ): string {
    const companyPayload = company
      ? {
          id: company.id,
          email: company.email,
          logoUrl: company.logoUrl,
          companyNameVi: company.companyNameVi,
          companyNameCn: company.companyNameCn,
          phone: company.phone,
          address: company.address,
          description: company.description,
          taxId: company.taxId,
          country: company.country,
          region: company.region,
          industry: company.industry,
          website: company.website,
          contactName: company.contactName,
          contactPhone: company.contactPhone,
        }
      : null;
    return JSON.stringify({ company: companyPayload });
  }

  private toAdminCompanyUpdateData(
    data: UpdateProfileDto,
  ): Prisma.CompanyUpdateInput {
    const updateData: Prisma.CompanyUpdateInput = {};
    type Mapper = {
      from: keyof UpdateProfileDto;
      to: keyof Prisma.CompanyUpdateInput;
      transform?: (value: string) => string;
    };
    const mappers: readonly Mapper[] = [
      { from: 'upload_logo', to: 'logoUrl' },
      { from: 'company_name_vi', to: 'companyNameVi' },
      { from: 'company_name_cn', to: 'companyNameCn' },
      { from: 'phone', to: 'phone' },
      { from: 'tax_id', to: 'taxId' },
      { from: 'contact_person', to: 'contactName' },
      { from: 'contact_phone', to: 'contactPhone' },
      { from: 'company_address', to: 'address' },
      { from: 'email', to: 'email', transform: (value) => value.toLowerCase() },
      { from: 'country', to: 'country' },
      { from: 'region', to: 'region' },
      { from: 'industry', to: 'industry' },
      { from: 'website', to: 'website' },
      { from: 'introduction', to: 'description' },
    ];

    for (const mapper of mappers) {
      const raw = data[mapper.from];
      if (raw === undefined) continue;
      const normalized = raw.trim();
      (updateData as Record<string, unknown>)[mapper.to] = mapper.transform
        ? mapper.transform(normalized)
        : normalized;
    }

    return updateData;
  }
}
