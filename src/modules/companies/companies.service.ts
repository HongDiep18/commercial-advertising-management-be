import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AdPackageType,
  CompanyProfileRequestStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AdEffectsRegistryService } from '../ad-effects/ad-effects-registry.service';
import type {
  ActiveAdInfo,
  CompanyData,
} from '../ad-effects/interfaces/ad-effect.interface';
import { AUDIT_ACTION, AUDIT_ENTITY } from '../audit/audit.constants';
import { AuditService } from '../audit/audit.service';
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
import type {
  AdminCompanyListItemDto,
  AdminListCompaniesQueryDto,
  AdminListCompaniesResponseDto,
} from './dto/admin-list-companies.dto';
import {
  CONTACT_TYPE,
  getPrimaryContactNameFromContactRows,
  getPrimaryPhoneValueFromContactRows,
} from './company-contact.constants';
import {
  applyCompanyNotePatch,
  getNoteFromContactRows,
  parseAdminUpdateNote,
  type AdminNotePatch,
} from './company-note.utils';
import type {
  AdminCompanyContactDto,
  AdminUpdateCompanyDto,
} from './dto/admin-update-company.dto';
import type { AdminCompanyDetailResponseDto } from './dto/admin-company-detail.dto';
import type { AdminArchiveCompanyResponseDto } from './dto/admin-archive-company-response.dto';

type CompanyAuditSnapshot = {
  id: string;
  importKey: string | null;
  isActive: boolean;
  logoUrl: string | null;
  companyNameVi: string | null;
  companyNameEn: string | null;
  companyNameZh: string | null;
  industry: string[];
  description: string;
  taxId: string | null;
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
  importKey: true,
  isActive: true,
  logoUrl: true,
  companyNameVi: true,
  companyNameEn: true,
  companyNameZh: true,
  description: true,
  taxId: true,
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

type CompanyWithActiveAdsRecord = {
  id: string;
  companyNameVi: string | null;
  companyNameEn: string | null;
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

  private static extractUserNameFromEmail(email: string): string {
    const normalizedEmail = email.trim().toLowerCase();
    const atIndex = normalizedEmail.indexOf('@');
    if (atIndex <= 0) {
      return normalizedEmail;
    }
    return normalizedEmail.slice(0, atIndex);
  }

  private static getPrimaryIndustry(industry: readonly string[]): string {
    return industry[0] ?? '';
  }

  static resolveCompanyDisplayName(
    companyNameVi: string | null | undefined,
    companyNameEn: string | null | undefined,
    companyNameZh: string | null | undefined,
  ): string | null {
    const vi = companyNameVi?.trim();
    if (vi) {
      return vi;
    }
    const en = companyNameEn?.trim();
    if (en) {
      return en;
    }
    const zh = companyNameZh?.trim();
    if (zh) {
      return zh;
    }
    return null;
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

  private static getPrimaryPhoneValue(
    contacts: ReadonlyArray<{
      type: string;
      value: string;
      contactName?: string | null;
    }>,
  ): string {
    return getPrimaryPhoneValueFromContactRows(contacts);
  }

  private static getPrimaryContactName(
    contacts: ReadonlyArray<{
      type: string;
      value: string;
      contactName: string | null;
    }>,
  ): string | null {
    return getPrimaryContactNameFromContactRows(contacts);
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
    contactPhone: string;
    address: string;
    website: string | null;
    contactName: string | null;
  } {
    const email =
      CompaniesService.getPrimaryContactValue(contacts, CONTACT_TYPE.EMAIL) ??
      '';
    const phone = CompaniesService.getPrimaryPhoneValue(contacts);
    const contactPhone = phone;
    const address =
      CompaniesService.getPrimaryContactValue(contacts, CONTACT_TYPE.ADDRESS) ??
      '';
    const website = CompaniesService.getPrimaryContactValue(
      contacts,
      CONTACT_TYPE.WEBSITE,
    );
    const contactName = CompaniesService.getPrimaryContactName(contacts);
    return { email, phone, contactPhone, address, website, contactName };
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
    const phoneRowTypes = new Set<string>([
      CONTACT_TYPE.PHONE,
      CONTACT_TYPE.CONTACT_PERSON,
    ]);
    const grouped = new Map<string, string[]>();
    for (const item of contacts) {
      if (!phoneRowTypes.has(item.type)) {
        continue;
      }
      const name =
        item.contactName && item.contactName.trim().length > 0
          ? item.contactName.trim()
          : 'Unknown';
      const current = grouped.get(name) ?? [];
      const value = item.value?.trim() ?? '';
      if (value && !current.includes(value)) {
        current.push(value);
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

  private static normalizeAdminContactRows(
    contacts: ReadonlyArray<AdminCompanyContactDto>,
  ): Array<{ type: string; value: string; contactName: string | null }> {
    const deduped = new Map<
      string,
      { type: string; value: string; contactName: string | null }
    >();
    for (const contact of contacts) {
      const type = contact.type.trim();
      const value =
        type === CONTACT_TYPE.EMAIL
          ? contact.value.trim().toLowerCase()
          : contact.value.trim();
      if (value.length === 0) {
        continue;
      }
      const key = `${type}\0${value}`;
      const existing = deduped.get(key);
      const contactName =
        contact.contactName && contact.contactName.trim().length > 0
          ? contact.contactName.trim()
          : null;
      if (!existing) {
        deduped.set(key, { type, value, contactName });
        continue;
      }
      if (!existing.contactName && contactName) {
        existing.contactName = contactName;
      }
    }
    return Array.from(deduped.values());
  }

  private static mapContactRows(
    contacts: ReadonlyArray<{
      type: string;
      value: string;
      contactName: string | null;
    }>,
  ): Array<{ type: string; value: string; contactName: string | null }> {
    return contacts.map((contact) => ({
      type: contact.type,
      value: contact.value,
      contactName: contact.contactName,
    }));
  }

  private buildMaskedContactRows(
    contacts: ReadonlyArray<{
      type: string;
      value: string;
      contactName: string | null;
    }>,
    baseCompany: {
      id: string;
      companyNameVi: string | null;
      companyNameZh: string | null;
      taxId: string | null;
      industry: string;
      website: string | null;
      address: string;
      region: string | null;
      country: string | null;
      description: string;
      logoUrl: string | null;
    },
    maskingContext: MaskingContext,
  ): Array<{ type: string; value: string; contactName: string | null }> {
    return contacts.map((contact) => {
      const masked = this.maskingService.maskCompanyData(
        {
          ...baseCompany,
          email: contact.type === CONTACT_TYPE.EMAIL ? contact.value : '',
          phone:
            contact.type === CONTACT_TYPE.TEL ||
            contact.type === CONTACT_TYPE.PHONE ||
            contact.type === CONTACT_TYPE.CONTACT_PERSON
              ? contact.value
              : '',
          contactPhone:
            contact.type === CONTACT_TYPE.TEL ||
            contact.type === CONTACT_TYPE.PHONE ||
            contact.type === CONTACT_TYPE.CONTACT_PERSON
              ? contact.value
              : '',
          website:
            contact.type === CONTACT_TYPE.WEBSITE
              ? contact.value
              : baseCompany.website,
          address:
            contact.type === CONTACT_TYPE.ADDRESS
              ? contact.value
              : baseCompany.address,
          contactName: contact.contactName,
        },
        maskingContext,
      );
      const maskedValueByType: Record<string, string | null> = {
        [CONTACT_TYPE.EMAIL]: masked.email,
        [CONTACT_TYPE.TEL]: masked.contactPhone ?? masked.phone ?? '',
        [CONTACT_TYPE.PHONE]: masked.contactPhone ?? masked.phone ?? '',
        [CONTACT_TYPE.CONTACT_PERSON]:
          masked.contactPhone ?? masked.phone ?? '',
        [CONTACT_TYPE.ADDRESS]: masked.address ?? '',
        [CONTACT_TYPE.WEBSITE]: masked.website ?? '',
      };
      return {
        type: contact.type,
        value: maskedValueByType[contact.type] ?? contact.value,
        contactName: masked.contactName ?? null,
      };
    });
  }

  private static mapCompanyMemberFromUser(
    user:
      | {
          email: string;
          createdAt: Date;
          membershipTier: string;
        }
      | undefined,
  ): CompanyDetailResponseDto['member'] {
    if (!user) {
      return null;
    }
    return {
      userName: CompaniesService.extractUserNameFromEmail(user.email),
      registeredEmail: user.email,
      memberSince: user.createdAt.toISOString(),
      membershipTier: user.membershipTier,
    };
  }

  private static mapAdminCompanyDetail(company: {
    id: string;
    importKey: string | null;
    isActive: boolean;
    logoUrl: string | null;
    companyNameVi: string | null;
    companyNameEn: string | null;
    companyNameZh: string | null;
    industry: string[];
    description: string;
    taxId: string | null;
    country: string | null;
    region: string | null;
    companyContacts: Array<{
      type: string;
      value: string;
      contactName: string | null;
    }>;
    users: Array<{
      email: string;
      createdAt: Date;
      membershipTier: string;
    }>;
  }): AdminCompanyDetailResponseDto {
    return {
      id: company.id,
      importKey: company.importKey,
      isActive: company.isActive,
      logoUrl: company.logoUrl,
      companyNameVi: company.companyNameVi,
      companyNameEn: company.companyNameEn,
      companyNameZh: company.companyNameZh,
      industry: [...company.industry],
      description: company.description,
      taxId: company.taxId ?? null,
      country: company.country,
      region: company.region,
      emails: CompaniesService.buildEmailsFromContacts(company.companyContacts),
      note: getNoteFromContactRows(company.companyContacts),
      contacts: CompaniesService.mapContactRows(company.companyContacts),
      member: CompaniesService.mapCompanyMemberFromUser(company.users[0]),
    };
  }

  async getAdminCompanyDetail(
    companyId: string,
  ): Promise<AdminCompanyDetailResponseDto> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        importKey: true,
        isActive: true,
        logoUrl: true,
        companyNameVi: true,
        companyNameEn: true,
        companyNameZh: true,
        industry: true,
        description: true,
        taxId: true,
        country: true,
        region: true,
        companyContacts: {
          select: {
            type: true,
            value: true,
            contactName: true,
          },
        },
        users: {
          where: {
            deletedAt: null,
          },
          orderBy: {
            createdAt: 'asc',
          },
          take: 1,
          select: {
            email: true,
            createdAt: true,
            membershipTier: true,
          },
        },
      },
    });
    if (!company) {
      throw new NotFoundException('Company not found');
    }
    return CompaniesService.mapAdminCompanyDetail(company);
  }

  private static buildActiveUserCompanyWhere(): Prisma.CompanyWhereInput {
    return {
      isActive: true,
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

  private static splitDirectorySearchWords(search: string): string[] {
    return search
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .map((word) => word.trim())
      .filter((word) => word.length > 0);
  }

  private static escapePostgresRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private static buildWordStartSequenceRegex(words: readonly string[]): string {
    const buildTokenRegex = (word: string): string => {
      const escapedWord = CompaniesService.escapePostgresRegex(word);
      const isAsciiWord = /^[a-z0-9]+$/i.test(word);
      if (isAsciiWord) {
        return `\\m${escapedWord}[[:alnum:]]*\\M`;
      }
      return escapedWord;
    };
    return words
      .map((word) => buildTokenRegex(word))
      .join('(?:[^[:alnum:]]+)?');
  }

  private static normalizeInitialSearch(search: string): string {
    return search.toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  private static shouldApplyInitialSearch(search: string): boolean {
    const isAsciiOnly = /^[a-z0-9\s]+$/i.test(search.trim());
    if (!isAsciiOnly) {
      return false;
    }
    const normalized = CompaniesService.normalizeInitialSearch(search);
    return normalized.length >= 2;
  }

  private async findCompanyIdsByDirectorySearch(
    search: string,
  ): Promise<string[]> {
    const words = CompaniesService.splitDirectorySearchWords(search);
    if (words.length === 0) {
      return [];
    }
    const sequenceRegex = CompaniesService.buildWordStartSequenceRegex(words);
    const normalizedInitials = CompaniesService.normalizeInitialSearch(search);
    const isInitialSearchEnabled =
      CompaniesService.shouldApplyInitialSearch(search);
    const initialsPattern = `${normalizedInitials}%`;
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`
        SELECT c.id
        FROM companies c
        WHERE
          (
            COALESCE(c.company_name_vi, '') ~* ${sequenceRegex}
            OR COALESCE(c.company_name_en, '') ~* ${sequenceRegex}
            OR COALESCE(c.company_name_zh, '') ~* ${sequenceRegex}
            OR COALESCE(c.description, '') ~* ${sequenceRegex}
            OR COALESCE(c.region, '') ~* ${sequenceRegex}
          )
          OR (
            ${isInitialSearchEnabled}
            AND (
              COALESCE((
                SELECT string_agg(left(token, 1), '')
                FROM unnest(
                  regexp_split_to_array(
                    lower(regexp_replace(COALESCE(c.company_name_vi, ''), '[^[:alnum:]]+', ' ', 'g')),
                    '\\s+'
                  )
                ) AS token
                WHERE token <> ''
              ), '') LIKE ${initialsPattern}
              OR COALESCE((
                SELECT string_agg(left(token, 1), '')
                FROM unnest(
                  regexp_split_to_array(
                    lower(regexp_replace(COALESCE(c.company_name_en, ''), '[^[:alnum:]]+', ' ', 'g')),
                    '\\s+'
                  )
                ) AS token
                WHERE token <> ''
              ), '') LIKE ${initialsPattern}
              OR COALESCE((
                SELECT string_agg(left(token, 1), '')
                FROM unnest(
                  regexp_split_to_array(
                    lower(regexp_replace(COALESCE(c.company_name_zh, ''), '[^[:alnum:]]+', ' ', 'g')),
                    '\\s+'
                  )
                ) AS token
                WHERE token <> ''
              ), '') LIKE ${initialsPattern}
            )
          )
      `,
    );
    return rows.map((row) => row.id);
  }

  async getAdminCompanyStats(): Promise<{ activeCount: number }> {
    const activeCount = await this.prisma.company.count({
      where: { isActive: true },
    });
    return { activeCount };
  }

  private async findCompanyIdsByAdminSearch(search: string): Promise<string[]> {
    const words = CompaniesService.splitDirectorySearchWords(search);
    if (words.length === 0) {
      return [];
    }
    const sequenceRegex = CompaniesService.buildWordStartSequenceRegex(words);
    const normalizedInitials = CompaniesService.normalizeInitialSearch(search);
    const isInitialSearchEnabled =
      CompaniesService.shouldApplyInitialSearch(search);
    const initialsPattern = `${normalizedInitials}%`;
    const contactSearchTypes = [
      CONTACT_TYPE.EMAIL,
      CONTACT_TYPE.TEL,
      CONTACT_TYPE.PHONE,
      CONTACT_TYPE.CONTACT_PERSON,
    ];
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`
        SELECT c.id
        FROM companies c
        WHERE
          (
            COALESCE(c.company_name_vi, '') ~* ${sequenceRegex}
            OR COALESCE(c.company_name_en, '') ~* ${sequenceRegex}
            OR COALESCE(c.company_name_zh, '') ~* ${sequenceRegex}
            OR COALESCE(c.tax_id, '') ~* ${sequenceRegex}
            OR EXISTS (
              SELECT 1
              FROM unnest(c.industry) AS t(val)
              WHERE COALESCE(t.val, '') ~* ${sequenceRegex}
            )
            OR EXISTS (
              SELECT 1
              FROM company_contacts cc
              WHERE cc.company_id = c.id
                AND cc.type IN (${Prisma.join(contactSearchTypes)})
                AND (
                  COALESCE(cc.value, '') ~* ${sequenceRegex}
                  OR COALESCE(cc.contact_name, '') ~* ${sequenceRegex}
                )
            )
          )
          OR (
            ${isInitialSearchEnabled}
            AND (
              COALESCE((
                SELECT string_agg(left(token, 1), '')
                FROM unnest(
                  regexp_split_to_array(
                    lower(regexp_replace(COALESCE(c.company_name_vi, ''), '[^[:alnum:]]+', ' ', 'g')),
                    '\\s+'
                  )
                ) AS token
                WHERE token <> ''
              ), '') LIKE ${initialsPattern}
              OR COALESCE((
                SELECT string_agg(left(token, 1), '')
                FROM unnest(
                  regexp_split_to_array(
                    lower(regexp_replace(COALESCE(c.company_name_en, ''), '[^[:alnum:]]+', ' ', 'g')),
                    '\\s+'
                  )
                ) AS token
                WHERE token <> ''
              ), '') LIKE ${initialsPattern}
              OR COALESCE((
                SELECT string_agg(left(token, 1), '')
                FROM unnest(
                  regexp_split_to_array(
                    lower(regexp_replace(COALESCE(c.company_name_zh, ''), '[^[:alnum:]]+', ' ', 'g')),
                    '\\s+'
                  )
                ) AS token
                WHERE token <> ''
              ), '') LIKE ${initialsPattern}
            )
          )
      `,
    );
    return rows.map((row) => row.id);
  }

  private static buildAdminCompanyVisibilityWhere(): Prisma.CompanyWhereInput {
    return {
      OR: [{ users: { none: {} } }, { users: { some: { deletedAt: null } } }],
    };
  }

  async adminListCompanies(
    query: AdminListCompaniesQueryDto,
  ): Promise<AdminListCompaniesResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';
    const search = query.search?.trim() ?? '';
    const visibilityWhere = CompaniesService.buildAdminCompanyVisibilityWhere();
    let where: Prisma.CompanyWhereInput = { AND: [visibilityWhere] };
    if (search.length > 0) {
      const companyIdsBySearch = await this.findCompanyIdsByAdminSearch(search);
      if (companyIdsBySearch.length === 0) {
        return {
          companies: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
          },
        };
      }
      where = {
        AND: [visibilityWhere, { id: { in: companyIdsBySearch } }],
      };
    }
    const orderBy: Prisma.CompanyOrderByWithRelationInput =
      sortBy === 'companyNameVi'
        ? { companyNameVi: sortOrder }
        : sortBy === 'updatedAt'
          ? { updatedAt: sortOrder }
          : { createdAt: sortOrder };
    const skip = (page - 1) * limit;
    const [total, rows] = await Promise.all([
      this.prisma.company.count({ where }),
      this.prisma.company.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: {
          id: true,
          companyNameVi: true,
          companyNameEn: true,
          companyNameZh: true,
          industry: true,
          status: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          users: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'asc' },
            select: { id: true },
            take: 1,
          },
          companyContacts: {
            select: {
              type: true,
              value: true,
              contactName: true,
            },
          },
        },
      }),
    ]);
    const companies: AdminCompanyListItemDto[] = rows.map((row) => ({
      id: row.id,
      userId: row.users[0]?.id ?? null,
      companyNameVi: row.companyNameVi,
      companyNameEn: row.companyNameEn,
      companyNameZh: row.companyNameZh,
      industry: [...row.industry],
      status: row.status,
      isActive: row.isActive,
      primaryEmail:
        CompaniesService.getPrimaryContactValue(
          row.companyContacts,
          CONTACT_TYPE.EMAIL,
        ) ?? '',
      primaryPhone: getPrimaryPhoneValueFromContactRows(row.companyContacts),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
    return {
      companies,
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
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
              type: CONTACT_TYPE.CONTACT_PERSON,
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
        companyNameEn: true,
        industry: true,
        description: true,
        taxId: true,
        country: true,
        region: true,
        companyContacts: {
          select: {
            type: true,
            value: true,
            contactName: true,
          },
        },
        users: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: {
            email: true,
            createdAt: true,
            membershipTier: true,
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

      const rawEmails = CompaniesService.buildEmailsFromContacts(
        company.companyContacts,
      );
      const primaryIndustry = CompaniesService.getPrimaryIndustry(
        company.industry,
      );
      const baseForMasking = {
        id: company.id,
        companyNameVi: company.companyNameVi,
        companyNameZh: company.companyNameZh,
        companyNameEn: company.companyNameEn,
        taxId: company.taxId,
        phone: contactView.phone,
        email: contactView.email,
        industry: primaryIndustry,
        contactName: contactView.contactName,
        contactPhone: contactView.contactPhone,
        website: contactView.website,
        address: contactView.address,
        region: company.region,
        country: company.country,
        description: company.description,
        logoUrl: company.logoUrl,
      };

      const masked = this.maskingService.maskCompanyData(
        baseForMasking,
        maskingContext,
      );
      const maskedEmailsBuffer: string[] = [];
      for (const emailValue of rawEmails) {
        const maskedEmail = this.maskingService.maskCompanyData(
          {
            ...baseForMasking,
            email: emailValue,
          },
          maskingContext,
        ).email;
        if (!maskedEmailsBuffer.includes(maskedEmail)) {
          maskedEmailsBuffer.push(maskedEmail);
        }
      }

      return {
        id: masked.id,
        logoUrl: masked.logoUrl ?? null,
        companyNameVi: masked.companyNameVi,
        companyNameZh: masked.companyNameZh,
        companyNameEn: masked.companyNameEn ?? null,
        industry: [...company.industry],
        description: masked.description ?? '',
        taxId: company.taxId ?? null,
        country: masked.country ?? null,
        region: masked.region ?? null,
        emails: maskedEmailsBuffer,
        contacts: this.buildMaskedContactRows(
          company.companyContacts,
          {
            ...baseForMasking,
            industry: primaryIndustry,
            website: contactView.website,
            address: contactView.address,
          },
          maskingContext,
        ),
        member: company.users[0]
          ? this.maskingService.maskPublicCompanyMember(
              company.users[0],
              company.id,
              primaryIndustry,
              maskingContext,
            )
          : null,
      };
    }

    return {
      id: company.id,
      logoUrl: company.logoUrl,
      companyNameVi: company.companyNameVi,
      companyNameZh: company.companyNameZh,
      companyNameEn: company.companyNameEn,
      industry: [...company.industry],
      description: company.description,
      taxId: company.taxId ?? null,
      country: company.country,
      region: company.region,
      emails: CompaniesService.buildEmailsFromContacts(company.companyContacts),
      contacts: CompaniesService.mapContactRows(company.companyContacts),
      member: CompaniesService.mapCompanyMemberFromUser(company.users[0]),
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
    const displayName = CompaniesService.resolveCompanyDisplayName(
      company.companyNameVi,
      company.companyNameEn,
      company.companyNameZh,
    );
    const companyData: CompanyData = {
      id: company.id,
      name: displayName ?? '',
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
      companyNameEn: string | null;
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
      CompaniesService.resolveCompanyDisplayName(
        company.companyNameVi,
        company.companyNameEn,
        company.companyNameZh,
      ) ?? '';
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
        CompaniesService.resolveCompanyDisplayName(
          company.companyNameVi,
          company.companyNameEn,
          company.companyNameZh,
        ) ?? '';
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
        CompaniesService.resolveCompanyDisplayName(
          company.companyNameVi,
          company.companyNameEn,
          company.companyNameZh,
        ) ?? '';

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

    const normalizedSearch = search?.trim() ?? '';
    if (normalizedSearch.length > 0) {
      const companyIdsBySearch =
        await this.findCompanyIdsByDirectorySearch(normalizedSearch);
      if (companyIdsBySearch.length === 0) {
        return {
          companies: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
          },
        };
      }
      andConditions.push({ id: { in: companyIdsBySearch } });
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
              companyNameEn: company.companyNameEn,
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
            companyNameEn: company.companyNameEn,
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

      const name = CompaniesService.resolveCompanyDisplayName(
        maskedCompany.companyNameVi,
        maskedCompany.companyNameEn,
        maskedCompany.companyNameZh,
      );

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
          ? (a.name ?? '').localeCompare(b.name ?? '')
          : (b.name ?? '').localeCompare(a.name ?? '');
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
    data: AdminUpdateCompanyDto,
  ): Promise<AdminCompanyDetailResponseDto> {
    const { companyUpdateData, contactRows, replaceContacts, notePatch } =
      this.toAdminCompanyUpdatePayload(data);
    if (replaceContacts && (data.contacts?.length ?? 0) === 0) {
      throw new BadRequestException(
        'contacts must not be an empty array; omit the field to leave contacts unchanged',
      );
    }
    if (replaceContacts && contactRows.length === 0) {
      throw new BadRequestException(
        'Contacts payload contains no valid contact rows',
      );
    }
    if (
      Object.keys(companyUpdateData).length === 0 &&
      !replaceContacts &&
      notePatch === undefined
    ) {
      throw new BadRequestException('No valid company fields provided');
    }

    const companyBefore = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: ADMIN_AUDIT_COMPANY_SELECT,
    });
    if (!companyBefore) {
      throw new NotFoundException('Company not found');
    }
    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(companyUpdateData).length > 0) {
        await tx.company.update({
          where: { id: companyId },
          data: companyUpdateData,
          select: { id: true },
        });
      }
      if (replaceContacts) {
        await tx.companyContact.deleteMany({
          where: { companyId },
        });
        if (contactRows.length > 0) {
          await tx.companyContact.createMany({
            data: contactRows.map((row) => ({
              companyId,
              type: row.type,
              value: row.value,
              contactName: row.contactName,
            })),
          });
        }
      }
      await applyCompanyNotePatch(tx, companyId, notePatch);
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

    return this.getAdminCompanyDetail(companyId);
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
    const seenInRequest = new Set<string>();
    const normalizedRows: Array<{
      type: string;
      value: string;
      contactName: string | null;
    }> = [];
    for (const row of dto.contacts) {
      const value =
        row.type === CONTACT_TYPE.EMAIL
          ? row.value.trim().toLowerCase()
          : row.value.trim();
      const key = `${row.type}\0${value}`;
      if (seenInRequest.has(key)) {
        continue;
      }
      seenInRequest.add(key);
      normalizedRows.push({
        type: row.type,
        value,
        contactName: row.contactName?.trim() || null,
      });
    }
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
        contactName: row.contactName,
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

  async archiveCompanyWithoutLinkedUser(
    adminUserId: string,
    companyId: string,
  ): Promise<AdminArchiveCompanyResponseDto> {
    const { company, updated } = await this.prisma.$transaction(async (tx) => {
      const company = await tx.company.findUnique({
        where: { id: companyId },
        select: {
          id: true,
          status: true,
          users: {
            where: { deletedAt: null },
            select: { id: true },
            take: 1,
          },
        },
      });
      if (!company) {
        throw new NotFoundException('Company not found');
      }
      if (company.users.length > 0) {
        throw new BadRequestException(
          'Company still has a linked user account; use the user deletion/disable flow instead',
        );
      }
      if (company.status === CompanyProfileRequestStatus.REJECTED) {
        return { company, updated: null };
      }
      const updated = await tx.company.update({
        where: { id: companyId },
        data: {
          status: CompanyProfileRequestStatus.REJECTED,
          isActive: false,
        },
        select: { id: true, status: true },
      });
      return { company, updated };
    });

    if (!updated) {
      return { id: company.id, status: company.status };
    }

    await this.auditService.record({
      action: AUDIT_ACTION.PROFILE_REQUEST_STATUS_CHANGED,
      entityType: AUDIT_ENTITY.COMPANY,
      entityId: companyId,
      actorId: adminUserId,
      oldValue: company.status,
      newValue: updated.status,
      metadata: {
        source: 'admin.company_archive',
      },
    });

    return updated;
  }

  async setCompanyActive(
    adminUserId: string,
    companyId: string,
    isActive: boolean,
  ): Promise<{ id: string; isActive: boolean }> {
    const { company, updated } = await this.prisma.$transaction(async (tx) => {
      const company = await tx.company.findUnique({
        where: { id: companyId },
        select: {
          id: true,
          isActive: true,
          users: {
            where: { deletedAt: null },
            select: { id: true },
            take: 1,
          },
        },
      });
      if (!company) {
        throw new NotFoundException('Company not found');
      }
      if (company.users.length > 0) {
        throw new BadRequestException(
          'Company still has a linked user account; use the user active toggle flow instead',
        );
      }
      const updated = await tx.company.update({
        where: { id: companyId },
        data: { isActive },
        select: { id: true, isActive: true },
      });
      return { company, updated };
    });

    await this.auditService.record({
      entityType: AUDIT_ENTITY.COMPANY,
      action: AUDIT_ACTION.COMPANY_UPDATED_BY_ADMIN,
      entityId: companyId,
      actorId: adminUserId,
      oldValue: JSON.stringify({ isActive: company.isActive }),
      newValue: JSON.stringify({ isActive: updated.isActive }),
      metadata: {
        source: 'admin.company_active_changed',
      },
    });

    return updated;
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
          importKey: company.importKey,
          email: contactView?.email ?? '',
          isActive: company.isActive,
          logoUrl: company.logoUrl,
          companyNameVi: company.companyNameVi,
          companyNameEn: company.companyNameEn,
          companyNameZh: company.companyNameZh,
          phone: contactView?.phone ?? '',
          address: contactView?.address ?? '',
          description: company.description,
          taxId: company.taxId,
          country: company.country,
          region: company.region,
          industry: CompaniesService.getPrimaryIndustry(company.industry),
          website: contactView?.website ?? null,
          contactName: contactView?.contactName ?? null,
          contactPhone: null,
          contacts: company.companyContacts,
        }
      : null;
    return JSON.stringify({ company: companyPayload });
  }

  private toAdminCompanyUpdatePayload(data: AdminUpdateCompanyDto): {
    companyUpdateData: Prisma.CompanyUpdateInput;
    contactRows: Array<{
      type: string;
      value: string;
      contactName: string | null;
    }>;
    replaceContacts: boolean;
    notePatch: AdminNotePatch;
  } {
    const companyUpdateData: Prisma.CompanyUpdateInput = {};
    const assignNullable = (
      key: keyof Prisma.CompanyUpdateInput,
      value: string | null | undefined,
    ): void => {
      if (value === undefined) {
        return;
      }
      if (value === null) {
        (companyUpdateData as Record<string, unknown>)[key] = null;
        return;
      }
      const normalized = value.trim();
      (companyUpdateData as Record<string, unknown>)[key] =
        normalized.length > 0 ? normalized : null;
    };

    assignNullable('logoUrl', data.logoUrl);
    assignNullable('companyNameVi', data.companyNameVi);
    assignNullable('companyNameEn', data.companyNameEn);
    assignNullable('companyNameZh', data.companyNameZh);
    assignNullable('taxId', data.taxId);
    assignNullable('country', data.country);
    assignNullable('region', data.region);

    if (data.industry !== undefined) {
      companyUpdateData.industry = data.industry
        .map((value) => value.trim())
        .filter((value) => value.length > 0);
    }
    if (data.description !== undefined) {
      companyUpdateData.description = data.description.trim();
    }

    const replaceContacts = data.contacts !== undefined;
    const contactRows = replaceContacts
      ? CompaniesService.normalizeAdminContactRows(data.contacts ?? [])
      : [];
    const notePatch = parseAdminUpdateNote(data.note);
    return { companyUpdateData, contactRows, replaceContacts, notePatch };
  }
}
