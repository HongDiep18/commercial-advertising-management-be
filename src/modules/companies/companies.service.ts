import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AdPackageType, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AdEffectsRegistryService } from '../ad-effects/ad-effects-registry.service';
import type {
  ActiveAdInfo,
  CompanyData,
} from '../ad-effects/interfaces/ad-effect.interface';
import { AUDIT_ACTION, AUDIT_ENTITY } from '../audit/audit.constants';
import { AuditService } from '../audit/audit.service';
import { UpdateProfileDto } from '../auth/dto/update-profile.dto';
import {
  CompanyMaskingService,
  type MaskingContext,
} from './company-masking.service';
import type { CompanyDetailResponseDto } from './dto/company-detail.dto';
import type {
  CompanyCategoriesResponseDto,
  CompanyDirectoryItemDto,
  CompanyDirectoryQueryDto,
  CompanyDirectoryResponseDto,
} from './dto/company-directory.dto';
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
  region: string | null;
  country: string | null;
  address: string;
  description: string;
  activeAds: Array<{
    id: string;
    companyId: string;
    packageType: AdPackageType;
    orderItemId: string | null;
    adLinkUrl: string | null;
    assets: Array<{ fileUrl: string | null; assetType: string }>;
    pricing: { package: { metadata: unknown } };
    orderItem: {
      id: string;
      adLinkUrl: string;
    } | null;
  }>;
};

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adEffectsRegistry: AdEffectsRegistryService,
    private readonly auditService: AuditService,
    private readonly maskingService: CompanyMaskingService,
  ) {}

  private static normalizeCompanyEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private static buildActiveUserCompanyWhere(): Prisma.CompanyWhereInput {
    return {
      users: {
        some: {
          isActive: true,
          deletedAt: null,
        },
      },
    };
  }

  private static buildContainsOrGroup(
    field: 'industry' | 'region',
    values: readonly string[],
  ): Prisma.CompanyWhereInput | null {
    if (values.length === 0) {
      return null;
    }
    const orGroup: Prisma.CompanyWhereInput[] = values.map((value) => ({
      [field]: { contains: value, mode: 'insensitive' },
    }));
    return { OR: orGroup };
  }

  private static splitSearchTokens(search: string): string[] {
    return search
      .trim()
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
  }

  private static readonly DIRECTORY_SEARCH_FIELDS = [
    'companyNameVi',
    'companyNameCn',
    'industry',
    'description',
    'region',
  ] as const;

  private static buildDirectorySearchWhere(
    tokens: readonly string[],
  ): Prisma.CompanyWhereInput {
    const mode = 'insensitive' as const;
    return {
      OR: CompaniesService.DIRECTORY_SEARCH_FIELDS.map((field) => ({
        AND: tokens.map((token) => ({
          OR: [
            { [field]: { startsWith: token, mode } },
            { [field]: { contains: ` ${token}`, mode } },
          ],
        })),
      })),
    };
  }

  async getAdminApprovedCompanyStats(): Promise<{ approvedCount: number }> {
    const approvedCount = await this.prisma.company.count({
      where: {
        ...CompaniesService.buildActiveUserCompanyWhere(),
      },
    });
    return { approvedCount };
  }

  async createCompany(dto: CreateCompanyDto, userId?: string) {
    const company = await this.prisma.company.create({
      data: {
        companyNameVi: dto.name,
        email: CompaniesService.normalizeCompanyEmail(dto.email),
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

  async getCompanyDetail(
    companyId: string,
    maskingContext?: MaskingContext,
  ): Promise<CompanyDetailResponseDto> {
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

    // Check if user has access to this company's industry
    if (
      maskingContext &&
      !this.maskingService.hasIndustryAccess(company.industry, maskingContext)
    ) {
      throw new ForbiddenException(
        'You do not have access to companies in this industry',
      );
    }

    // Apply masking if context is provided
    if (maskingContext) {
      const masked = this.maskingService.maskCompanyData(
        company,
        maskingContext,
      );
      return {
        id: masked.id,
        logoUrl: masked.logoUrl ?? null,
        companyNameVi: masked.companyNameVi,
        companyNameCn: masked.companyNameCn,
        industry: masked.industry,
        email: masked.email,
        phone: masked.phone,
        address: masked.address ?? '',
        description: masked.description ?? '',
        taxId: masked.taxId ?? null,
        country: masked.country ?? null,
        region: masked.region ?? null,
        website: masked.website ?? null,
        contactName: masked.contactName ?? null,
        contactPhone: masked.contactPhone ?? null,
      };
    }

    return {
      id: company.id,
      logoUrl: company.logoUrl,
      companyNameVi: company.companyNameVi,
      companyNameCn: company.companyNameCn,
      industry: company.industry,
      email: company.email,
      phone: company.phone,
      address: company.address,
      description: company.description,
      taxId: company.taxId,
      country: company.country,
      region: company.region,
      website: company.website,
      contactName: company.contactName,
      contactPhone: company.contactPhone,
    };
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
      country: company.country ?? undefined,
      address: company.address,
      description: company.description,
      showDetailsButton: false,
    };

    const activeAds: ActiveAdInfo[] = company.activeAds.map((ad) => ({
      id: ad.id,
      companyId: ad.companyId,
      packageType: ad.packageType,
      adLinkUrl: ad.adLinkUrl,
    }));

    return this.adEffectsRegistry.applyEffects(companyData, activeAds);
  }

  /**
   * Build a CompanyWithAdsResponseDto from a raw company record and virtual ActiveAdInfo[].
   * Used by the ad order preview to simulate effects without real ActiveAd records.
   */
  buildPreviewCompanyItem(
    company: {
      id: string;
      companyNameVi: string | null;
      companyNameCn: string | null;
      logoUrl: string | null;
      email: string;
      contactName: string | null;
      phone: string;
      industry: string;
      country: string | null;
      address: string;
      description: string;
    },
    virtualAds: ActiveAdInfo[],
    requiredSlotTypes: AdPackageType[],
    orderItems: Array<{
      id: string;
      adLinkUrl: string;
      package: { type: AdPackageType; metadata: unknown };
      assets: Array<{ fileUrl: string | null; assetType: string }>;
    }>,
  ): CompanyWithAdsResponseDto {
    const name =
      company.companyNameVi ?? company.companyNameCn ?? company.email;
    const companyData: CompanyData = {
      id: company.id,
      name,
      email: company.email,
      contactName: company.contactName ?? '',
      phone: company.phone,
      industry: company.industry,
      country: company.country ?? undefined,
      address: company.address,
      description: company.description,
      showDetailsButton: false,
    };

    const modified = this.adEffectsRegistry.applyEffects(
      companyData,
      virtualAds,
    );

    const requiredSlotTypeSet = new Set(requiredSlotTypes);
    const activeAdAssets = orderItems
      .filter((i) => requiredSlotTypeSet.has(i.package.type))
      .map((i) => ({
        adId: i.id,
        packageType: i.package.type,
        assets: i.assets
          .filter((a) => Boolean(a.fileUrl))
          .map((a) => ({ fileUrl: a.fileUrl!, assetType: a.assetType })),
      }));

    return {
      id: company.id,
      name,
      logoUrl: company.logoUrl,
      email: company.email,
      contactName: company.contactName ?? '',
      phone: company.phone,
      industry: company.industry,
      country: company.country,
      address: company.address,
      description: company.description,
      featuredHighlight: modified.featuredHighlight ?? false,
      companyInfoHighlight: modified.companyInfoHighlight ?? false,
      showDetailsButton: modified.showDetailsButton ?? false,
      adLinkUrl: modified.adLinkUrl,
      metadata: { activeAdAssets },
      sortPriority: modified.sortPriority ?? 0,
    };
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
        AdPackageType.POPUP_PRIORITY_DETAILS_LINK,
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
        AdPackageType.POPUP_ROTATION_DETAILS_LINK,
      ],
    );
  }

  private async getPopupCompaniesBySlotTypes(
    requiredSlotTypes: readonly AdPackageType[],
    includedSlotTypes: readonly AdPackageType[],
  ): Promise<CompanyWithAdsResponseDto[]> {
    const now = new Date();

    const companies = (await this.prisma.company.findMany({
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
            assets: {
              select: {
                fileUrl: true,
                assetType: true,
              },
            },
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
    })) as CompanyWithActiveAdsRecord[];

    const responses: CompanyWithAdsResponseDto[] = companies.map((company) => {
      const modified = this.applyEffectsToCompany(company);
      const name =
        company.companyNameVi ?? company.companyNameCn ?? company.email;
      const requiredSlotTypeSet = new Set<AdPackageType>(requiredSlotTypes);
      const activeAdAssets = company.activeAds
        .filter((ad) => requiredSlotTypeSet.has(ad.packageType))
        .map((ad) => {
          return {
            adId: ad.id,
            packageType: ad.packageType,
            assets: ad.assets
              .filter((asset) => Boolean(asset.fileUrl))
              .map((asset) => ({
                fileUrl: asset.fileUrl ?? '',
                assetType: asset.assetType,
              })),
          };
        });

      return {
        id: company.id,
        name,
        logoUrl: company.logoUrl,
        email: company.email,
        contactName: company.contactName ?? '',
        phone: company.phone,
        industry: company.industry,
        country: company.country,
        address: company.address,
        description: company.description,
        featuredHighlight: modified.featuredHighlight ?? false,
        companyInfoHighlight: modified.companyInfoHighlight ?? false,
        showDetailsButton: modified.showDetailsButton ?? false,
        adLinkUrl: modified.adLinkUrl,
        metadata: { activeAdAssets },
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
          adLinkUrl: ad.adLinkUrl,
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
        showDetailsButton: modified.showDetailsButton ?? false,
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
    return this.getPopupCompaniesBySlotTypes(
      [AdPackageType.FEATURED_HOMEPAGE_DISPLAY],
      [
        AdPackageType.FEATURED_HOMEPAGE_DISPLAY,
        AdPackageType.FEATURED_HIGHLIGHT_BOOST,
      ],
    );
  }

  /**
   * Get all companies with search/filter capabilities.
   * Only applies COMPANY_CATEGORY_TOP and COMPANY_INFO_HIGHLIGHT ad effects.
   * Applies tier-based filtering and data masking.
   */
  async getCompanyDirectory(
    query: CompanyDirectoryQueryDto,
    maskingContext?: MaskingContext,
  ): Promise<CompanyDirectoryResponseDto> {
    const {
      search,
      industry,
      region,
      page = 1,
      limit = 20,
      sortBy = 'name',
      sortOrder = 'asc',
    } = query;

    const now = new Date();

    const andConditions: Prisma.CompanyWhereInput[] = [];
    andConditions.push(CompaniesService.buildActiveUserCompanyWhere());
    const industryFilters = Array.isArray(industry)
      ? industry.filter((value): value is string => typeof value === 'string')
      : [];
    const regionFilters = Array.isArray(region)
      ? region.filter((value): value is string => typeof value === 'string')
      : [];

    if (search) {
      const tokens = CompaniesService.splitSearchTokens(search);
      if (tokens.length > 0) {
        andConditions.push(CompaniesService.buildDirectorySearchWhere(tokens));
      }
    }

    // Industry group OR-values, AND-ed with region group.
    const industryGroup = CompaniesService.buildContainsOrGroup(
      'industry',
      industryFilters,
    );
    if (industryGroup) {
      andConditions.push(industryGroup);
    }
    const regionGroup = CompaniesService.buildContainsOrGroup(
      'region',
      regionFilters,
    );
    if (regionGroup) {
      andConditions.push(regionGroup);
    }
    const where: Prisma.CompanyWhereInput =
      andConditions.length > 0 ? { AND: andConditions } : {};

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

      // Apply masking if context is provided
      const maskedCompany = maskingContext
        ? this.maskingService.maskCompanyData(
            {
              id: company.id,
              companyNameVi: company.companyNameVi,
              companyNameCn: company.companyNameCn,
              email: company.email,
              contactName: company.contactName,
              phone: company.phone,
              industry: company.industry,
              region: company.region,
              address: company.address,
              description: company.description,
              logoUrl: company.logoUrl,
            },
            maskingContext,
          )
        : {
            id: company.id,
            companyNameVi: company.companyNameVi,
            companyNameCn: company.companyNameCn,
            email: company.email,
            contactName: company.contactName,
            phone: company.phone,
            industry: company.industry,
            region: company.region,
            address: company.address,
            description: company.description,
            logoUrl: company.logoUrl,
          };

      const name =
        maskedCompany.companyNameVi ??
        maskedCompany.companyNameCn ??
        maskedCompany.email;

      return {
        id: maskedCompany.id,
        name,
        logoUrl: maskedCompany.logoUrl ?? null,
        email: maskedCompany.email,
        contactName: maskedCompany.contactName ?? '',
        phone: maskedCompany.phone,
        industry: maskedCompany.industry,
        region: maskedCompany.region ?? null,
        address: maskedCompany.address ?? '',
        description: maskedCompany.description ?? '',
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

  async getCompanyCategories(
    maskingContext?: MaskingContext,
  ): Promise<CompanyCategoriesResponseDto> {
    const grouped = await this.prisma.company.groupBy({
      by: ['industry'],
      where: CompaniesService.buildActiveUserCompanyWhere(),
      _count: {
        _all: true,
      },
    });

    const allCategories: CompanyCategoriesResponseDto['categories'] = grouped
      .filter((item) => item.industry !== null)
      .map((item) => ({
        industry: item.industry ?? '',
        count: item._count._all,
      }));

    // If no masking context (guest), return all with hasAllAccess: true
    if (!maskingContext) {
      return {
        categories: allCategories,
        hasAllAccess: true,
      };
    }

    // Check if user has access to all industries
    const hasAllAccess =
      this.maskingService.hasAllIndustryAccess(maskingContext);

    // If has all access (Diamond/Admin), return all categories
    if (hasAllAccess) {
      return {
        categories: allCategories,
        hasAllAccess: true,
      };
    }

    // Filter categories based on user's accessible industries
    const accessibleIndustries = maskingContext.userIndustries;
    const filteredCategories = allCategories.filter((cat) =>
      accessibleIndustries.some((ind) =>
        cat.industry.toLowerCase().includes(ind.toLowerCase()),
      ),
    );

    return {
      categories: filteredCategories,
      hasAllAccess: false,
    };
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
    try {
      await this.prisma.company.update({
        where: { id: companyId },
        data: updateData,
        select: { id: true },
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Cannot update duplicate email');
      }
      throw error;
    }

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
