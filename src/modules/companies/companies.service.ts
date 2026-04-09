import {
  BadRequestException,
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
import type { AddCompanyContactsDto } from './dto/add-company-contacts.dto';
import type { AddCompanyContactsResponseDto } from './dto/add-company-contacts-response.dto';
import type { CompanyContactTypesResponseDto } from './dto/company-contact-types-response.dto';
import type { CreateCompanyDto } from './dto/create-company.dto';

type CompanyAuditSnapshot = {
  id: string;
  logoUrl: string | null;
  companyNameVi: string | null;
  companyNameZh: string | null;
  industry: string[];
  description: string;
  country: string | null;
  region: string | null;
  companyContacts: Array<{
    type: string;
    value: string;
    contactName: string | null;
  }>;
};

const ADMIN_AUDIT_COMPANY_SELECT = {
  id: true,
  logoUrl: true,
  companyNameVi: true,
  companyNameZh: true,
  description: true,
  country: true,
  region: true,
  industry: true,
  companyContacts: {
    select: {
      type: true,
      value: true,
      contactName: true,
    },
  },
} as const;

const CONTACT_TYPE = {
  EMAIL: 'email',
  PHONE: 'phone',
  ADDRESS: 'address',
  TAX_ID: 'tax_id',
  WEBSITE: 'website',
  CONTACT_PHONE: 'contact_phone',
} as const;

type CompanyWithActiveAdsRecord = {
  id: string;
  companyNameVi: string | null;
  companyNameZh: string | null;
  logoUrl: string | null;
  industry: string[];
  region: string | null;
  country: string | null;
  description: string;
  companyContacts: Array<{
    type: string;
    value: string;
    contactName: string | null;
  }>;
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

  private static getPrimaryIndustry(industry: readonly string[]): string {
    return industry[0] ?? '';
  }

  private static getPrimaryContactValue(
    contacts: ReadonlyArray<{
      type: string;
      value: string;
      contactName?: string | null;
    }>,
    type: string,
  ): string | null {
    const entry = contacts.find((item) => item.type === type);
    return entry?.value ?? null;
  }

  private static getPrimaryContactName(
    contacts: ReadonlyArray<{
      type: string;
      value: string;
      contactName: string | null;
    }>,
  ): string | null {
    const priorityTypes = [
      CONTACT_TYPE.EMAIL,
      CONTACT_TYPE.PHONE,
      CONTACT_TYPE.CONTACT_PHONE,
    ];
    for (const contactType of priorityTypes) {
      const row = contacts.find(
        (item) =>
          item.type === contactType &&
          item.contactName &&
          item.contactName.trim().length > 0,
      );
      if (row?.contactName) {
        return row.contactName.trim();
      }
    }
    const anyNamed = contacts.find(
      (item) => item.contactName && item.contactName.trim().length > 0,
    );
    return anyNamed?.contactName?.trim() ?? null;
  }

  private static buildCompanyContactView(
    contacts: ReadonlyArray<{
      type: string;
      value: string;
      contactName: string | null;
    }>,
  ): {
    email: string;
    phone: string;
    address: string;
    taxId: string | null;
    website: string | null;
    contactName: string | null;
    contactPhone: string | null;
  } {
    const email =
      CompaniesService.getPrimaryContactValue(contacts, CONTACT_TYPE.EMAIL) ??
      '';
    const phone =
      CompaniesService.getPrimaryContactValue(contacts, CONTACT_TYPE.PHONE) ??
      '';
    const address =
      CompaniesService.getPrimaryContactValue(contacts, CONTACT_TYPE.ADDRESS) ??
      '';
    const taxId = CompaniesService.getPrimaryContactValue(
      contacts,
      CONTACT_TYPE.TAX_ID,
    );
    const website = CompaniesService.getPrimaryContactValue(
      contacts,
      CONTACT_TYPE.WEBSITE,
    );
    const contactName = CompaniesService.getPrimaryContactName(contacts);
    const contactPhone = CompaniesService.getPrimaryContactValue(
      contacts,
      CONTACT_TYPE.CONTACT_PHONE,
    );
    return {
      email,
      phone,
      address,
      taxId,
      website,
      contactName,
      contactPhone,
    };
  }

  private static buildEmailsFromContacts(
    contacts: ReadonlyArray<{
      type: string;
      value: string;
      contactName: string | null;
    }>,
  ): string[] {
    return contacts
      .filter((item) => item.type === CONTACT_TYPE.EMAIL)
      .map((item) => item.value)
      .filter((value, index, all) => all.indexOf(value) === index);
  }

  private static buildContactPhonesByName(
    contacts: ReadonlyArray<{
      type: string;
      value: string;
      contactName: string | null;
    }>,
  ): Array<{ contactName: string; contactPhones: string[] }> {
    const grouped = new Map<string, string[]>();
    for (const item of contacts) {
      if (item.type !== CONTACT_TYPE.CONTACT_PHONE) {
        continue;
      }
      const name =
        item.contactName && item.contactName.trim().length > 0
          ? item.contactName.trim()
          : 'Unknown';
      const current = grouped.get(name) ?? [];
      if (!current.includes(item.value)) {
        current.push(item.value);
        grouped.set(name, current);
      }
    }
    return Array.from(grouped.entries()).map(
      ([contactName, contactPhones]) => ({
        contactName,
        contactPhones,
      }),
    );
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

  async getCompanyContactTypes(): Promise<CompanyContactTypesResponseDto> {
    const rows = await this.prisma.companyContact.findMany({
      distinct: ['type'],
      select: { type: true },
      orderBy: { type: 'asc' },
    });
    return {
      types: rows.map((row) => row.type),
    };
  }

  private static buildContainsOrGroup(
    field: 'industry' | 'region',
    values: readonly string[],
  ): Prisma.CompanyWhereInput | null {
    if (values.length === 0) {
      return null;
    }
    const orGroup: Prisma.CompanyWhereInput[] = values.map((value) =>
      field === 'industry'
        ? { industry: { has: value } }
        : { region: { contains: value, mode: 'insensitive' } },
    );
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
    'companyNameZh',
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
        industry: dto.industry,
        description: dto.description,
        companyContacts: {
          create: [
            {
              type: CONTACT_TYPE.EMAIL,
              value: CompaniesService.normalizeCompanyEmail(dto.email),
              contactName: dto.contactName,
            },
            {
              type: CONTACT_TYPE.PHONE,
              value: dto.phone,
              contactName: dto.contactName,
            },
            {
              type: CONTACT_TYPE.ADDRESS,
              value: dto.address,
              contactName: dto.contactName,
            },
          ],
        },
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
        companyNameZh: true,
        industry: true,
        description: true,
        country: true,
        region: true,
        companyContacts: {
          select: {
            type: true,
            value: true,
            contactName: true,
          },
        },
      },
    });
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    // Check if user has access to this company's industry
    if (
      maskingContext &&
      !this.maskingService.hasIndustryAccess(
        CompaniesService.getPrimaryIndustry(company.industry),
        maskingContext,
      )
    ) {
      throw new ForbiddenException(
        'You do not have access to companies in this industry',
      );
    }

    // Apply masking if context is provided
    if (maskingContext) {
      const contactView = CompaniesService.buildCompanyContactView(
        company.companyContacts,
      );
      const masked = this.maskingService.maskCompanyData(
        {
          ...company,
          industry: CompaniesService.getPrimaryIndustry(company.industry),
          ...contactView,
        },
        maskingContext,
      );
      return {
        id: masked.id,
        logoUrl: masked.logoUrl ?? null,
        companyNameVi: masked.companyNameVi,
        companyNameZh: masked.companyNameZh,
        industry: [...company.industry],
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
        emails: masked.email ? [masked.email] : [],
        contactPhonesByName:
          masked.contactPhone && masked.contactName
            ? [
                {
                  contactName: masked.contactName,
                  contactPhones: [masked.contactPhone],
                },
              ]
            : [],
      };
    }

    const contactView = CompaniesService.buildCompanyContactView(
      company.companyContacts,
    );
    return {
      id: company.id,
      logoUrl: company.logoUrl,
      companyNameVi: company.companyNameVi,
      companyNameZh: company.companyNameZh,
      industry: [...company.industry],
      email: contactView.email,
      phone: contactView.phone,
      address: contactView.address,
      description: company.description,
      taxId: contactView.taxId,
      country: company.country,
      region: company.region,
      website: contactView.website,
      contactName: contactView.contactName,
      contactPhone: contactView.contactPhone,
      emails: CompaniesService.buildEmailsFromContacts(company.companyContacts),
      contactPhonesByName: CompaniesService.buildContactPhonesByName(
        company.companyContacts,
      ),
    };
  }

  /**
   * Helper method to apply ad effects to a company and transform to response format
   */
  private applyEffectsToCompany(
    company: CompanyWithActiveAdsRecord,
  ): CompanyData {
    const contactView = CompaniesService.buildCompanyContactView(
      company.companyContacts,
    );
    const displayName =
      company.companyNameVi ?? company.companyNameZh ?? contactView.email;
    const companyData: CompanyData = {
      id: company.id,
      name: displayName,
      email: contactView.email,
      contactName: contactView.contactName ?? '',
      phone: contactView.phone,
      industry: CompaniesService.getPrimaryIndustry(company.industry),
      country: company.country ?? undefined,
      address: contactView.address,
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
      companyNameZh: string | null;
      logoUrl: string | null;
      companyContacts?: Array<{
        type: string;
        value: string;
        contactName: string | null;
      }>;
      email?: string;
      contactName?: string | null;
      phone?: string;
      industry: string[];
      country: string | null;
      address?: string;
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
    const contactView = company.companyContacts
      ? CompaniesService.buildCompanyContactView(company.companyContacts)
      : {
          email: company.email ?? '',
          phone: company.phone ?? '',
          address: company.address ?? '',
          taxId: null,
          website: null,
          contactName: company.contactName ?? null,
          contactPhone: null,
        };
    const name =
      company.companyNameVi ?? company.companyNameZh ?? contactView.email;
    const companyData: CompanyData = {
      id: company.id,
      name,
      email: contactView.email,
      contactName: contactView.contactName ?? '',
      phone: contactView.phone,
      industry: CompaniesService.getPrimaryIndustry(company.industry),
      country: company.country ?? undefined,
      address: contactView.address,
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
      email: contactView.email,
      contactName: contactView.contactName ?? '',
      phone: contactView.phone,
      industry: [...company.industry],
      country: company.country,
      address: contactView.address,
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
        companyContacts: {
          select: {
            type: true,
            value: true,
            contactName: true,
          },
        },
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
      const contactView = CompaniesService.buildCompanyContactView(
        company.companyContacts,
      );
      const name =
        company.companyNameVi ?? company.companyNameZh ?? contactView.email;
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
        email: contactView.email,
        contactName: contactView.contactName ?? '',
        phone: contactView.phone,
        industry: [...company.industry],
        country: company.country,
        address: contactView.address,
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
        companyContacts: {
          select: {
            type: true,
            value: true,
            contactName: true,
          },
        },
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
      const contactView = CompaniesService.buildCompanyContactView(
        company.companyContacts,
      );
      const name =
        company.companyNameVi ?? company.companyNameZh ?? contactView.email;

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
        email: contactView.email,
        contactName: contactView.contactName ?? '',
        phone: contactView.phone,
        industry: [...company.industry],
        address: contactView.address,
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
      orderBy.createdAt = sortOrder;
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
        companyContacts: {
          select: {
            type: true,
            value: true,
            contactName: true,
          },
        },
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
      const contactView = CompaniesService.buildCompanyContactView(
        company.companyContacts,
      );

      // Apply masking if context is provided
      const maskedCompany = maskingContext
        ? this.maskingService.maskCompanyData(
            {
              id: company.id,
              companyNameVi: company.companyNameVi,
              companyNameZh: company.companyNameZh,
              email: contactView.email,
              contactName: contactView.contactName,
              phone: contactView.phone,
              industry: CompaniesService.getPrimaryIndustry(company.industry),
              region: company.region,
              address: contactView.address,
              description: company.description,
              logoUrl: company.logoUrl,
            },
            maskingContext,
          )
        : {
            id: company.id,
            companyNameVi: company.companyNameVi,
            companyNameZh: company.companyNameZh,
            email: contactView.email,
            contactName: contactView.contactName,
            phone: contactView.phone,
            industry: CompaniesService.getPrimaryIndustry(company.industry),
            region: company.region,
            address: contactView.address,
            description: company.description,
            logoUrl: company.logoUrl,
          };

      const name =
        maskedCompany.companyNameVi ??
        maskedCompany.companyNameZh ??
        maskedCompany.email;

      return {
        id: maskedCompany.id,
        name,
        logoUrl: maskedCompany.logoUrl ?? null,
        email: maskedCompany.email,
        contactName: maskedCompany.contactName ?? '',
        phone: maskedCompany.phone,
        industry: [...company.industry],
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
    const grouped = await this.prisma.company.findMany({
      where: CompaniesService.buildActiveUserCompanyWhere(),
      select: { industry: true },
    });
    const categoryCountMap = new Map<string, number>();
    grouped.forEach((item) => {
      item.industry.forEach((industryValue) => {
        const previous = categoryCountMap.get(industryValue) ?? 0;
        categoryCountMap.set(industryValue, previous + 1);
      });
    });
    const allCategories: CompanyCategoriesResponseDto['categories'] =
      Array.from(categoryCountMap.entries()).map(([industry, count]) => ({
        industry,
        count,
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

    const { companyUpdateData, contactUpdates, contactName } =
      this.toAdminCompanyUpdatePayload(data);
    if (
      Object.keys(companyUpdateData).length === 0 &&
      Object.keys(contactUpdates).length === 0 &&
      contactName === undefined
    ) {
      throw new BadRequestException('No valid company fields provided');
    }

    const companyBefore = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: ADMIN_AUDIT_COMPANY_SELECT,
    });
    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(companyUpdateData).length > 0) {
        await tx.company.update({
          where: { id: companyId },
          data: companyUpdateData,
          select: { id: true },
        });
      }
      const entries = Object.entries(contactUpdates);
      const existingRows = await tx.companyContact.findMany({
        where: { companyId },
        select: { contactName: true },
      });
      const fallbackName =
        existingRows.find((row) => row.contactName)?.contactName ?? null;
      const resolvedPersonName =
        contactName !== undefined ? contactName : fallbackName;
      const resolvedOrNull =
        resolvedPersonName && resolvedPersonName.trim().length > 0
          ? resolvedPersonName.trim()
          : null;
      for (const [type, value] of entries) {
        await tx.companyContact.deleteMany({
          where: { companyId, type },
        });
        await tx.companyContact.create({
          data: {
            companyId,
            type,
            value,
            contactName: resolvedOrNull,
          },
        });
      }
      if (contactName !== undefined && entries.length === 0) {
        await tx.companyContact.updateMany({
          where: { companyId },
          data: {
            contactName:
              contactName.trim().length > 0 ? contactName.trim() : null,
          },
        });
      }
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

  /**
   * Appends additional `company_contacts` rows for email and contact phone.
   * Optional `contactName` is stored on each new row (DB column `contact_name`).
   * Duplicates for the same company + type + value are skipped.
   */
  async addCompanyContacts(
    adminUserId: string,
    companyId: string,
    dto: AddCompanyContactsDto,
  ): Promise<AddCompanyContactsResponseDto> {
    const companyExists = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });
    if (!companyExists) {
      throw new NotFoundException('Company not found');
    }
    const normalizedRows: Array<{ type: string; value: string }> = [];
    const seenInRequest = new Set<string>();
    const pushUnique = (type: string, value: string): void => {
      const key = `${type}\0${value}`;
      if (seenInRequest.has(key)) {
        return;
      }
      seenInRequest.add(key);
      normalizedRows.push({ type, value });
    };
    for (const raw of dto.emails ?? []) {
      const trimmed = raw.trim();
      if (trimmed.length === 0) {
        continue;
      }
      pushUnique(CONTACT_TYPE.EMAIL, trimmed.toLowerCase());
    }
    for (const raw of dto.contactPhones ?? []) {
      const trimmed = raw.trim();
      if (trimmed.length === 0) {
        continue;
      }
      pushUnique(CONTACT_TYPE.CONTACT_PHONE, trimmed);
    }
    if (normalizedRows.length === 0) {
      throw new BadRequestException(
        'At least one valid email or contact phone is required',
      );
    }
    const contactName = dto.contactName?.trim().length
      ? dto.contactName.trim()
      : null;
    const existing = await this.prisma.companyContact.findMany({
      where: {
        companyId,
        OR: normalizedRows.map((row) => ({
          AND: [{ type: row.type }, { value: row.value }],
        })),
      },
      select: { type: true, value: true },
    });
    const existingSet = new Set(
      existing.map((row) => `${row.type}\0${row.value}`),
    );
    const toCreate = normalizedRows.filter(
      (row) => !existingSet.has(`${row.type}\0${row.value}`),
    );
    const skippedDuplicates = normalizedRows.length - toCreate.length;
    const createResult = await this.prisma.companyContact.createMany({
      data: toCreate.map((row) => ({
        companyId,
        type: row.type,
        value: row.value,
        contactName,
      })),
    });
    await this.auditService.record({
      entityType: AUDIT_ENTITY.COMPANY,
      action: AUDIT_ACTION.COMPANY_CONTACTS_ADDED,
      entityId: companyId,
      actorId: adminUserId,
      metadata: {
        added: createResult.count,
        skippedDuplicates,
      },
    });
    return {
      added: createResult.count,
      skippedDuplicates,
    };
  }

  private static serializeCompanyAuditPayload(
    company: CompanyAuditSnapshot | null | undefined,
  ): string {
    const contactView = company
      ? CompaniesService.buildCompanyContactView(company.companyContacts)
      : null;
    const companyPayload = company
      ? {
          id: company.id,
          email: contactView?.email ?? '',
          logoUrl: company.logoUrl,
          companyNameVi: company.companyNameVi,
          companyNameZh: company.companyNameZh,
          phone: contactView?.phone ?? '',
          address: contactView?.address ?? '',
          description: company.description,
          taxId: contactView?.taxId ?? null,
          country: company.country,
          region: company.region,
          industry: CompaniesService.getPrimaryIndustry(company.industry),
          website: contactView?.website ?? null,
          contactName: contactView?.contactName ?? null,
          contactPhone: contactView?.contactPhone ?? null,
          contacts: company.companyContacts,
        }
      : null;
    return JSON.stringify({ company: companyPayload });
  }

  private toAdminCompanyUpdatePayload(data: UpdateProfileDto): {
    companyUpdateData: Prisma.CompanyUpdateInput;
    contactUpdates: Record<string, string>;
    contactName?: string;
  } {
    const companyUpdateData: Prisma.CompanyUpdateInput = {};
    const contactUpdates: Record<string, string> = {};
    type CompanyMapper = {
      from: keyof UpdateProfileDto;
      to: keyof Prisma.CompanyUpdateInput;
      transform?: (value: string) => string;
    };
    type ContactMapper = {
      from: keyof UpdateProfileDto;
      contactType: string;
      transform?: (value: string) => string;
    };
    const companyMappers: readonly CompanyMapper[] = [
      { from: 'upload_logo', to: 'logoUrl' },
      { from: 'company_name_vi', to: 'companyNameVi' },
      { from: 'company_name_zh', to: 'companyNameZh' },
      { from: 'country', to: 'country' },
      { from: 'region', to: 'region' },
      { from: 'industry', to: 'industry' },
      { from: 'introduction', to: 'description' },
    ];
    const contactMappers: readonly ContactMapper[] = [
      {
        from: 'email',
        contactType: CONTACT_TYPE.EMAIL,
        transform: (value) => value.toLowerCase(),
      },
      { from: 'phone', contactType: CONTACT_TYPE.PHONE },
      { from: 'company_address', contactType: CONTACT_TYPE.ADDRESS },
      { from: 'tax_id', contactType: CONTACT_TYPE.TAX_ID },
      { from: 'website', contactType: CONTACT_TYPE.WEBSITE },
      { from: 'contact_phone', contactType: CONTACT_TYPE.CONTACT_PHONE },
    ];

    for (const mapper of companyMappers) {
      const raw = data[mapper.from];
      if (raw === undefined) continue;
      if (mapper.from === 'industry') {
        const normalizedIndustries = Array.isArray(raw)
          ? raw
              .filter((value): value is string => typeof value === 'string')
              .map((value) => value.trim())
              .filter((value) => value.length > 0)
          : typeof raw === 'string'
            ? [raw.trim()].filter((value) => value.length > 0)
            : [];
        (companyUpdateData as Record<string, unknown>)[mapper.to] =
          normalizedIndustries;
        continue;
      }
      const normalized = (raw as string).trim();
      (companyUpdateData as Record<string, unknown>)[mapper.to] =
        mapper.transform ? mapper.transform(normalized) : normalized;
    }
    for (const mapper of contactMappers) {
      const raw = data[mapper.from];
      if (raw === undefined) continue;
      const normalized = (raw as string).trim();
      contactUpdates[mapper.contactType] = mapper.transform
        ? mapper.transform(normalized)
        : normalized;
    }
    const rawContactPerson = data.contact_person;
    let contactName: string | undefined;
    if (rawContactPerson !== undefined) {
      contactName = rawContactPerson.trim();
    }
    return { companyUpdateData, contactUpdates, contactName };
  }
}
