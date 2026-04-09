import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  CompanyProfileRequestStatus,
  MembershipTier,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { AUDIT_ACTION, AUDIT_ENTITY } from '../audit/audit.constants';
import { AuditService } from '../audit/audit.service';
import { Role } from '../../common/enums/role.enum';
import {
  PointsSource,
  POINTS_VALUES,
} from '../../common/enums/points-source.enum';
import { PrismaService } from '../../database/prisma.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { MailService } from '../mail/mail.service';
import * as bcrypt from 'bcrypt';

import { assertUserActive } from './auth.utils';
import { CONTACT_TYPE } from '../companies/company-contact.constants';
import { CaptchaVerificationService } from './captcha-verification.service';

import type { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import type {
  AdminListUsersQueryDto,
  AdminListUsersResponseDto,
  AdminUserStatus,
} from './dto/admin-list-users.dto';
import {
  PROFILE_REQUESTS_DEFAULT_LIMIT,
  PROFILE_REQUESTS_DEFAULT_PAGE,
  PROFILE_REQUESTS_DEFAULT_SORT_BY,
  PROFILE_REQUESTS_DEFAULT_SORT_ORDER,
} from './profile-requests-list.query';

export type AuthUser = {
  id: string;
  email: string;
  password: string;
  role: string;
  isActive: boolean;
};

export type LoginResult = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    role: Role;
    membershipTier: MembershipTier;
    primaryIndustry?: string | null;
    selectedIndustries: string[];
    companyId?: string | null;
  };
};

type ProfileField =
  | 'logoUrl'
  | 'companyNameVi'
  | 'companyNameEn'
  | 'companyNameZh'
  | 'phone'
  | 'address'
  | 'description'
  | 'taxId'
  | 'country'
  | 'region'
  | 'industry'
  | 'website'
  | 'fax'
  | 'skype'
  | 'contactName';

export type ProfileResponse = {
  id: string;
  email: string;
  membershipTier: string;
  role: string;
} & Partial<Record<ProfileField, string | null>>;

export type ProvisionCompanyUserResult =
  | {
      status: 'created';
      userId: string;
      email: string;
      companyId: string;
      setPasswordEmailSent: boolean;
    }
  | {
      status: 'linked_existing';
      userId: string;
      email: string;
      companyId: string;
      setPasswordEmailSent: boolean;
    }
  | {
      status: 'existing_same_company';
      userId: string;
      email: string;
      companyId: string;
      setPasswordEmailSent: false;
    }
  | {
      status: 'conflict_other_company';
      userId: string;
      email: string;
      companyId: string | null;
      conflictingCompanyId: string;
      setPasswordEmailSent: false;
    };

type CompanyProfileSelectResult = {
  readonly id: string;
  readonly logoUrl: string | null;
  readonly companyNameVi: string | null;
  readonly companyNameEn: string | null;
  readonly companyNameZh: string | null;
  readonly taxId: string | null;
  readonly industry: string[];
  readonly description: string;
  readonly country: string | null;
  readonly region: string | null;
  readonly companyContacts: ReadonlyArray<{
    readonly type: string;
    readonly value: string;
    readonly contactName: string | null;
  }>;
};

/** Sentinel key used in contactData to carry the contact-person name (not a DB contact type). */
const CONTACT_LABEL_KEY = 'contactName' as const;

function companyProfileSelect() {
  return {
    id: true,
    logoUrl: true,
    companyNameVi: true,
    companyNameEn: true,
    companyNameZh: true,
    taxId: true,
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
  } as const;
}

const SET_PASSWORD_TOKEN_BYTES = 32;

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaClient,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly mailService: MailService,
    private readonly auditService: AuditService,
    private readonly loyaltyService: LoyaltyService,
    private readonly captchaVerificationService: CaptchaVerificationService,
  ) {}

  private static getContactValue(
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

  private buildSetPasswordTokenData(): {
    token: string;
    expiresAt: Date;
  } {
    const token = randomBytes(SET_PASSWORD_TOKEN_BYTES).toString('hex');
    const expiryDays =
      this.config.get<number>('mail.setPasswordTokenExpiryDays') ?? 7;
    const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);
    return { token, expiresAt };
  }

  private async buildPlaceholderPassword(): Promise<string> {
    return bcrypt.hash(randomBytes(32).toString('hex'), 10);
  }

  private static getContactNameFromContacts(
    contacts: ReadonlyArray<{
      type: string;
      value: string;
      contactName: string | null;
    }>,
  ): string | null {
    const priorityTypes = [CONTACT_TYPE.EMAIL, CONTACT_TYPE.TEL];
    for (const contactType of priorityTypes) {
      const row = contacts.find(
        (contact) =>
          contact.type === contactType &&
          contact.contactName &&
          contact.contactName.trim().length > 0,
      );
      if (row?.contactName) {
        return row.contactName.trim();
      }
    }
    const anyNamed = contacts.find(
      (contact) => contact.contactName && contact.contactName.trim().length > 0,
    );
    return anyNamed?.contactName?.trim() ?? null;
  }

  private static mapCompanyContactsToProfileFields(
    contacts: ReadonlyArray<{
      type: string;
      value: string;
      contactName: string | null;
    }>,
  ): Partial<Record<ProfileField, string | null>> {
    return {
      phone: AuthService.getContactValue(contacts, CONTACT_TYPE.TEL),
      address: AuthService.getContactValue(contacts, CONTACT_TYPE.ADDRESS),
      website: AuthService.getContactValue(contacts, CONTACT_TYPE.WEBSITE),
      fax: AuthService.getContactValue(contacts, CONTACT_TYPE.FAX),
      skype: AuthService.getContactValue(contacts, CONTACT_TYPE.SKYPE),
      contactName: AuthService.getContactNameFromContacts(contacts),
    };
  }

  async login(email: string, password: string): Promise<LoginResult> {
    const normalizedEmail = email.trim().toLowerCase();

    // Fetch user
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        password: true,
        role: true,
        isActive: true,
        membershipTier: true,
        primaryIndustry: true,
        selectedIndustries: true,
        companyId: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Validate password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check if user is active
    assertUserActive({
      isActive: user.isActive,
      deletedAt: null,
    });

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() } as unknown as Prisma.UserUpdateInput,
      select: { id: true },
    });

    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role as Role,
      membershipTier: user.membershipTier,
      primaryIndustry: user.primaryIndustry,
      selectedIndustries: user.selectedIndustries,
      companyId: user.companyId,
    };

    // Generate access token (2h, sent in response body)
    const accessToken = this.jwtService.sign(payload, {
      secret: this.config.get('jwt.accessTokenSecret'),
      expiresIn: this.config.get('jwt.accessTokenExpiresIn') || '2h',
    });

    // Generate refresh token (7d, will be stored in httpOnly cookie)
    const refreshToken = this.jwtService.sign(
      { userId: user.id, type: 'refresh' },
      {
        secret: this.config.get('jwt.refreshTokenSecret'),
        expiresIn: this.config.get('jwt.refreshTokenExpiresIn') || '7d',
      },
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role as Role,
        membershipTier: user.membershipTier,
        primaryIndustry: user.primaryIndustry,
        selectedIndustries: user.selectedIndustries,
        companyId: user.companyId,
      },
    };
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string }> {
    try {
      // Verify refresh token with refresh secret
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.config.get('jwt.refreshTokenSecret'),
      });

      // Verify it's a refresh token (prevent access token substitution)
      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      // Verify user still exists and is active
      const user = await this.prisma.user.findUnique({
        where: { id: payload.userId },
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          deletedAt: true,
          membershipTier: true,
          primaryIndustry: true,
          selectedIndustries: true,
        },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      assertUserActive({
        isActive: user.isActive,
        deletedAt: user.deletedAt,
      });

      // Generate new access token
      const newAccessToken = this.jwtService.sign(
        {
          userId: user.id,
          email: user.email,
          role: user.role as Role,
          membershipTier: user.membershipTier,
          primaryIndustry: user.primaryIndustry,
          selectedIndustries: user.selectedIndustries,
        },
        {
          secret: this.config.get('jwt.accessTokenSecret'),
          expiresIn: this.config.get('jwt.accessTokenExpiresIn') || '2h',
        },
      );

      return { accessToken: newAccessToken };
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async register(data: RegisterDto): Promise<{
    message: string;
    status: string;
  }> {
    this.captchaVerificationService.verifyAndConsumeChallenge(
      data.captchaId,
      data.captcha,
    );
    const companyEmail = data.company_email.trim().toLowerCase();
    const existingUser = await this.prisma.user.findUnique({
      where: { email: companyEmail },
    });
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const existingCompanyEmailContact =
      await this.prisma.companyContact.findFirst({
        where: { type: CONTACT_TYPE.EMAIL, value: companyEmail },
        select: { company: true },
      });
    const existingCompany = existingCompanyEmailContact?.company ?? null;
    if (existingCompany) {
      if (existingCompany.status === CompanyProfileRequestStatus.PENDING) {
        throw new ConflictException(
          'A request with this email is already pending approval.',
        );
      }
      if (existingCompany.status === CompanyProfileRequestStatus.APPROVED) {
        throw new ConflictException('Email already registered');
      }
      const company = await this.prisma.company.update({
        where: { id: existingCompany.id },
        data: AuthService.companyCreateDataFromRegisterDto(data, companyEmail),
      });
      await this.auditService.record({
        action: AUDIT_ACTION.PROFILE_REQUEST_CREATED,
        entityType: AUDIT_ENTITY.COMPANY,
        entityId: company.id,
        metadata: {
          email: companyEmail,
          companyNameVi: data.company_name_vi,
          industry: data.industry,
        },
      });
      return {
        message: 'Request submitted. We will email you after approval.',
        status: CompanyProfileRequestStatus.PENDING,
      };
    }

    const company = await this.prisma.company.create({
      data: AuthService.companyCreateDataFromRegisterDto(data, companyEmail),
    });

    await this.auditService.record({
      action: AUDIT_ACTION.PROFILE_REQUEST_CREATED,
      entityType: AUDIT_ENTITY.COMPANY,
      entityId: company.id,
      metadata: {
        email: companyEmail,
        companyNameVi: data.company_name_vi,
        industry: data.industry,
      },
    });

    return {
      message: 'Request submitted. We will email you after approval.',
      status: CompanyProfileRequestStatus.PENDING,
    };
  }

  private static companyCreateDataFromRegisterDto(
    data: RegisterDto,
    companyEmail: string,
  ): Prisma.CompanyCreateInput {
    return {
      companyNameVi: data.company_name_vi.trim(),
      companyNameEn: data.company_name_en?.trim() || null,
      companyNameZh: data.company_name_zh.trim(),
      taxId: data.tax_id.trim(),
      country: data.country.trim(),
      ...(data.region && data.region.trim()
        ? { region: data.region.trim() }
        : { region: null }),
      industry: data.industry.map((value) => value.trim()).filter(Boolean),
      description: data.introduction.trim(),
      status: CompanyProfileRequestStatus.PENDING,
      companyContacts: {
        create: (() => {
          const contactName = data.contact_person.trim();
          return [
            {
              type: CONTACT_TYPE.EMAIL,
              value: companyEmail,
              contactName,
            },
            {
              type: CONTACT_TYPE.TEL,
              value: data.phone.trim(),
              contactName,
            },
            ...(data.contact_phone?.trim() &&
            data.contact_phone.trim() !== data.phone.trim()
              ? [
                  {
                    type: CONTACT_TYPE.TEL,
                    value: data.contact_phone.trim(),
                    contactName,
                  },
                ]
              : []),
            {
              type: CONTACT_TYPE.ADDRESS,
              value: data.company_address.trim(),
              contactName,
            },
            {
              type: CONTACT_TYPE.WEBSITE,
              value: data.website.trim(),
              contactName,
            },
            ...(data.fax?.trim()
              ? [
                  {
                    type: CONTACT_TYPE.FAX,
                    value: data.fax.trim(),
                    contactName,
                  },
                ]
              : []),
            ...(data.skype?.trim()
              ? [
                  {
                    type: CONTACT_TYPE.SKYPE,
                    value: data.skype.trim(),
                    contactName,
                  },
                ]
              : []),
          ];
        })(),
      },
    };
  }

  private static dtoToProfileData(
    data: UpdateProfileDto,
  ): Record<string, string | string[] | null> {
    const out: Record<string, string | string[] | null> = {};
    const dataRecord = data as unknown as Record<string, unknown>;

    const skipKeys = new Set(['membership_tier']);

    Object.keys(data).forEach((key) => {
      if (dataRecord[key] === undefined || skipKeys.has(key)) return;

      let camelKey: string = key.replace(/_([a-z])/g, (g) =>
        g[1].toUpperCase(),
      );
      if (key === 'upload_logo') camelKey = 'logoUrl';
      if (key === 'contact_person') camelKey = 'contactName';
      if (key === 'contact_phone') camelKey = 'contactPhone';
      if (key === 'company_address') camelKey = 'address';
      if (key === 'introduction') camelKey = 'description';
      const raw = dataRecord[key];
      const val =
        typeof raw === 'string'
          ? raw.trim() || null
          : Array.isArray(raw) && key === 'industry'
            ? raw
                .filter((item): item is string => typeof item === 'string')
                .map((item) => item.trim())
                .filter((item) => item.length > 0)
            : null;

      if (key === 'upload_logo' && val === null) return;
      if (
        (camelKey === 'phone' ||
          camelKey === 'industry' ||
          camelKey === 'address' ||
          camelKey === 'description') &&
        val === null
      ) {
        return;
      }

      out[camelKey] = val;
    });

    return out;
  }

  async getProfile(userId: string): Promise<
    ProfileResponse & {
      primaryIndustry?: string | null;
      selectedIndustries: string[];
      industriesSelected: boolean;
      loyaltyPoints: number;
      totalSpending: string;
      companyId?: string | null;
    }
  > {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        membershipTier: true,
        role: true,
        primaryIndustry: true,
        selectedIndustries: true,
        industriesSelected: true,
        loyaltyPoints: true,
        totalSpending: true,
        companyId: true,
        company: { select: companyProfileSelect() },
      },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const profileRest = AuthService.mapCompanyToProfileResponse(
      user.company as CompanyProfileSelectResult | null,
    );
    return {
      id: user.id,
      email: user.email,
      membershipTier: user.membershipTier,
      role: user.role,
      primaryIndustry: user.primaryIndustry,
      selectedIndustries: user.selectedIndustries,
      industriesSelected: user.industriesSelected,
      loyaltyPoints: user.loyaltyPoints,
      totalSpending: user.totalSpending.toString(),
      companyId: user.companyId,
      ...profileRest,
    };
  }

  async updateIndustries(userId: string, selectedIndustries: string[]) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        membershipTier: true,
        industriesSelected: true,
        primaryIndustry: true,
        selectedIndustries: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Only Gold tier can select industries
    if (user.membershipTier !== MembershipTier.GOLD) {
      throw new BadRequestException(
        'Only Gold tier members can select additional industries',
      );
    }

    // Check if user has already selected industries (one-time action)
    if (user.industriesSelected) {
      throw new BadRequestException(
        'You have already selected your industries. This is a one-time action.',
      );
    }

    // Validate that user has exactly 3 industries
    if (selectedIndustries.length !== 3) {
      throw new BadRequestException(
        'Gold tier members must select exactly 3 industries',
      );
    }

    // Update user with selected industries
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        selectedIndustries,
        industriesSelected: true,
      },
      select: {
        id: true,
        email: true,
        membershipTier: true,
        primaryIndustry: true,
        selectedIndustries: true,
        industriesSelected: true,
      },
    });

    return {
      message: 'Industries selected successfully',
      user: updatedUser,
    };
  }

  async updateProfile(
    userId: string,
    data: UpdateProfileDto,
  ): Promise<ProfileResponse> {
    return this.applyProfileDataToUser(userId, data);
  }

  async applyProfileDataToUser(
    userId: string,
    data: UpdateProfileDto,
  ): Promise<ProfileResponse> {
    let user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        membershipTier: true,
        role: true,
        companyId: true,
      },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (data.email !== undefined && data.email.trim()) {
      const newEmail = data.email.trim().toLowerCase();
      const existing = await this.prisma.user.findFirst({
        where: { email: newEmail, id: { not: userId } },
      });
      if (existing) {
        throw new ConflictException('Email already in use');
      }
      user = await this.prisma.user.update({
        where: { id: userId },
        data: { email: newEmail },
        select: {
          id: true,
          email: true,
          membershipTier: true,
          role: true,
          companyId: true,
        },
      });
    }

    if (data.membership_tier !== undefined && data.membership_tier.trim()) {
      const tier = data.membership_tier.trim() as MembershipTier;
      user = await this.prisma.user.update({
        where: { id: userId },
        data: { membershipTier: tier },
        select: {
          id: true,
          email: true,
          membershipTier: true,
          role: true,
          companyId: true,
        },
      });
    }

    const profileData = AuthService.dtoToProfileData(data);
    const companyProfile = await this.saveCompanyProfile({
      userId,
      userEmail: user.email,
      companyId: user.companyId,
      profileData,
    });

    await this.auditService.record({
      action: AUDIT_ACTION.USER_PROFILE_UPDATED,
      entityType: AUDIT_ENTITY.USER,
      entityId: userId,
      actorId: userId,
      metadata: {
        fields_updated: Object.keys(data).filter((k) => data[k] !== undefined),
      },
    });

    return {
      id: user.id,
      email: user.email,
      membershipTier: user.membershipTier,
      role: user.role,
      ...companyProfile,
    };
  }

  async getAllProfileRequests(input?: {
    readonly status?: string;
    readonly page?: number;
    readonly limit?: number;
    readonly sortBy?: string;
    readonly sortOrder?: 'asc' | 'desc';
  }): Promise<{
    requests: Array<
      {
        userId: string | null;
        companyId: string | null;
        isActive: boolean | null;
      } & Record<string, unknown>
    >;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      sortBy: string;
      sortOrder: 'asc' | 'desc';
    };
  }> {
    const page = input?.page ?? PROFILE_REQUESTS_DEFAULT_PAGE;
    const limit = input?.limit ?? PROFILE_REQUESTS_DEFAULT_LIMIT;
    const sortBy = input?.sortBy?.trim() || PROFILE_REQUESTS_DEFAULT_SORT_BY;
    const sortOrder = input?.sortOrder ?? PROFILE_REQUESTS_DEFAULT_SORT_ORDER;
    const orderBy = this.resolveCompanyProfileRequestsOrderBy(
      sortBy,
      sortOrder,
    );
    const skip = (page - 1) * limit;
    const status = input?.status;
    const validStatuses = Object.values(
      CompanyProfileRequestStatus,
    ) as readonly string[];
    const linkageWhere: Prisma.CompanyWhereInput = {
      OR: [{ users: { none: {} } }, { users: { some: { deletedAt: null } } }],
    };
    const where =
      status && validStatuses.includes(status)
        ? ({
            AND: [
              {
                status: status as CompanyProfileRequestStatus,
              },
              linkageWhere,
            ],
          } satisfies Prisma.CompanyWhereInput)
        : linkageWhere;
    const [total, companies] = await Promise.all([
      this.prisma.company.count({ where }),
      this.prisma.company.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          companyContacts: {
            where: { type: CONTACT_TYPE.EMAIL },
            select: { type: true, value: true, contactName: true },
          },
        },
      }),
    ]);

    const companyIds = companies.map((company) => company.id);
    const userByCompanyId = new Map<
      string,
      { id: string; companyId: string | null; isActive: boolean }
    >();
    if (companyIds.length > 0) {
      const users = await this.prisma.user.findMany({
        where: {
          companyId: { in: companyIds },
          deletedAt: null,
        },
        select: { id: true, email: true, companyId: true, isActive: true },
      });
      for (const u of users) {
        if (!u.companyId) {
          continue;
        }
        userByCompanyId.set(u.companyId, {
          id: u.id,
          companyId: u.companyId,
          isActive: u.isActive,
        });
      }
    }

    const totalPages = Math.ceil(total / limit);
    type CompanyContactRow = {
      readonly type: string;
      readonly value: string;
      readonly contactName: string | null;
    };
    type CompanyWithContacts = {
      readonly companyContacts?: ReadonlyArray<CompanyContactRow>;
    };
    const getCompanyContactValue = (
      company: CompanyWithContacts,
      type: string,
    ): string | null => {
      const value = company.companyContacts?.find(
        (cc) => cc.type === type,
      )?.value;
      return value ?? null;
    };
    const requests = companies.map((c) => {
      const user = userByCompanyId.get(c.id);
      const typedCompany = c as unknown as CompanyWithContacts;
      const companyEmail = getCompanyContactValue(
        typedCompany,
        CONTACT_TYPE.EMAIL,
      );
      const contactName = AuthService.getContactNameFromContacts(
        typedCompany.companyContacts ?? [],
      );
      const { status: companyStatus, ...companyData } = c;
      return {
        ...companyData,
        status: companyStatus,
        companyEmail,
        contactName,
        userId: user?.id ?? null,
        companyId: user?.companyId ?? null,
        isActive: user?.isActive ?? null,
      };
    });

    return {
      requests,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        sortBy,
        sortOrder,
      },
    };
  }

  private resolveCompanyProfileRequestsOrderBy(
    sortBy: string,
    sortOrder: 'asc' | 'desc',
  ): Prisma.CompanyOrderByWithRelationInput {
    if (sortBy === 'updatedAt') {
      return { updatedAt: sortOrder };
    }
    if (sortBy === 'email') {
      return { createdAt: sortOrder };
    }
    if (sortBy === 'companyNameVi') {
      return { companyNameVi: sortOrder };
    }
    if (sortBy === 'status') {
      return { status: sortOrder };
    }
    return { createdAt: sortOrder };
  }

  async setUserActive(
    adminUserId: string,
    id: string,
    isActive: boolean,
  ): Promise<{ id: string; email: string; isActive: boolean }> {
    let target = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, isActive: true },
    });
    if (!target) {
      target = await this.prisma.user.findFirst({
        where: { companyId: id },
        select: { id: true, email: true, isActive: true },
      });
    }
    if (!target) {
      throw new NotFoundException('User not found');
    }
    const updated = await this.prisma.user.update({
      where: { id: target.id },
      data: { isActive },
      select: { id: true, email: true, isActive: true },
    });
    await this.auditService.record({
      entityType: AUDIT_ENTITY.USER,
      action: AUDIT_ACTION.USER_ACTIVE_CHANGED,
      entityId: target.id,
      actorId: adminUserId,
      oldValue: String(target.isActive),
      newValue: String(isActive),
    });
    return updated;
  }

  async softDeleteUser(
    adminUserId: string,
    userId: string,
  ): Promise<{ id: string; email: string; isActive: boolean }> {
    const target = (await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, isActive: true, deletedAt: true } as {
        id: boolean;
        email: boolean;
        isActive: boolean;
        deletedAt: boolean;
      },
    })) as {
      id: string;
      email: string;
      isActive: boolean;
      deletedAt: Date | null;
    } | null;
    if (!target) {
      throw new NotFoundException('User not found');
    }
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        isActive: false,
        deletedAt: new Date(),
      } as Prisma.UserUpdateInput,
      select: { id: true, email: true, isActive: true },
    });
    await this.auditService.record({
      entityType: AUDIT_ENTITY.USER,
      action: AUDIT_ACTION.USER_SOFT_DELETED,
      entityId: userId,
      actorId: adminUserId,
      oldValue: target.deletedAt ? 'deleted' : String(target.isActive),
      newValue: 'deleted',
    });
    return updated;
  }

  async adminListUsers(
    query: AdminListUsersQueryDto,
  ): Promise<AdminListUsersResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const search = query.search?.trim();
    const status = query.status;

    const where: Prisma.UserWhereInput = {
      role: { in: [Role.ADMIN, Role.SUPER_ADMIN] },
    };

    if (status === 'active') {
      where.isActive = true;
      where.deletedAt = null;
    } else if (status === 'suspended') {
      where.isActive = false;
      where.deletedAt = null;
    } else if (status === 'deleted') {
      where.deletedAt = { not: null };
    }

    if (search) {
      const searchOr: Prisma.UserWhereInput[] = [
        { email: { contains: search, mode: 'insensitive' } },
        {
          company: {
            OR: [
              { companyNameVi: { contains: search, mode: 'insensitive' } },
              { companyNameZh: { contains: search, mode: 'insensitive' } },
              {
                companyContacts: {
                  some: {
                    contactName: {
                      contains: search,
                      mode: 'insensitive',
                    },
                  },
                },
              },
            ],
          },
        },
      ];
      const existingAnd: Prisma.UserWhereInput[] = [];
      if (where.AND) {
        if (Array.isArray(where.AND)) existingAnd.push(...where.AND);
        else existingAnd.push(where.AND);
      }
      where.AND = [...existingAnd, { OR: searchOr }];
    }

    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';

    let orderBy:
      | Prisma.UserOrderByWithRelationInput
      | Prisma.UserOrderByWithRelationInput[] = { createdAt: 'desc' };

    if (sortBy === 'lastLoginAt') {
      orderBy = {
        lastLoginAt: sortOrder,
      } as unknown as Prisma.UserOrderByWithRelationInput;
    } else if (sortBy === 'email') {
      orderBy = { email: sortOrder };
    } else if (sortBy === 'createdAt') {
      orderBy = { createdAt: sortOrder };
    } else if (sortBy === 'companyName') {
      orderBy = [{ company: { companyNameVi: sortOrder } }, { email: 'asc' }];
    } else if (sortBy === 'status') {
      orderBy =
        sortOrder === 'asc'
          ? [{ deletedAt: 'desc' }, { isActive: 'asc' }]
          : [{ deletedAt: 'asc' }, { isActive: 'desc' }];
    }

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          deletedAt: true,
          lastLoginAt: true,
          companyId: true,
          company: {
            select: {
              companyNameVi: true,
              companyNameZh: true,
              companyContacts: {
                select: { type: true, value: true, contactName: true },
              },
            },
          },
        } as unknown as Prisma.UserSelect,
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    type AdminListUserRow = {
      id: string;
      email: string;
      role: string;
      isActive: boolean;
      deletedAt: Date | null;
      lastLoginAt: Date | null;
      companyId: string | null;
      company: {
        companyNameVi: string | null;
        companyNameZh: string | null;
        companyContacts: Array<{
          type: string;
          value: string;
          contactName: string | null;
        }>;
      } | null;
    };

    const rows = (users as unknown as AdminListUserRow[]).map((u) => {
      const statusVal: AdminUserStatus =
        u.deletedAt != null ? 'deleted' : u.isActive ? 'active' : 'suspended';
      const company = u.company;
      const contactName = company
        ? AuthService.getContactNameFromContacts(company.companyContacts)
        : null;
      return {
        userId: u.id,
        companyId: u.companyId,
        contactName,
        email: u.email,
        companyNameVi: company?.companyNameVi ?? null,
        companyNameZh: company?.companyNameZh ?? null,
        role: u.role,
        lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
        status: statusVal,
        isActive: u.isActive,
        deletedAt: u.deletedAt ? u.deletedAt.toISOString() : null,
      };
    });

    return {
      users: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  private async saveCompanyProfile(input: {
    readonly userId: string;
    readonly userEmail: string;
    readonly companyId: string | null;
    readonly profileData: Record<string, string | string[] | null>;
  }): Promise<Partial<Record<ProfileField, string | null>>> {
    const { profileData } = input;
    if (Object.keys(profileData).length === 0) {
      if (!input.companyId) return {};
      const company = await this.prisma.company.findUnique({
        where: { id: input.companyId },
        select: companyProfileSelect(),
      });
      return AuthService.mapCompanyToProfileResponse(
        company as CompanyProfileSelectResult | null,
      );
    }
    const { companyData, contactData } =
      AuthService.toCompanyUpdateData(profileData);
    if (input.companyId) {
      const company = await this.prisma.$transaction(async (tx) => {
        if (Object.keys(companyData).length > 0) {
          await tx.company.update({
            where: { id: input.companyId! },
            data: companyData,
            select: { id: true },
          });
        }
        const contactNameFromPayload = contactData[CONTACT_LABEL_KEY];
        const typeValueEntries = Object.entries(contactData).filter(
          ([contactType]) => contactType !== CONTACT_LABEL_KEY,
        );
        const existingRows = await tx.companyContact.findMany({
          where: { companyId: input.companyId! },
          select: { contactName: true },
        });
        const fallbackName =
          existingRows.find((row) => row.contactName)?.contactName ?? null;
        const resolvedPersonName =
          contactNameFromPayload !== undefined
            ? contactNameFromPayload
            : fallbackName;
        const resolvedOrNull =
          resolvedPersonName && resolvedPersonName.trim().length > 0
            ? resolvedPersonName.trim()
            : null;
        for (const [type, value] of typeValueEntries) {
          await tx.companyContact.deleteMany({
            where: { companyId: input.companyId!, type },
          });
          await tx.companyContact.create({
            data: {
              companyId: input.companyId!,
              type,
              value,
              contactName: resolvedOrNull,
            },
          });
        }
        if (
          contactNameFromPayload !== undefined &&
          typeValueEntries.length === 0
        ) {
          await tx.companyContact.updateMany({
            where: { companyId: input.companyId! },
            data: {
              contactName:
                contactNameFromPayload.trim().length > 0
                  ? contactNameFromPayload.trim()
                  : null,
            },
          });
        }
        return tx.company.findUnique({
          where: { id: input.companyId! },
          select: companyProfileSelect(),
        });
      });
      return AuthService.mapCompanyToProfileResponse(
        company as CompanyProfileSelectResult | null,
      );
    }
    const createData = AuthService.toCompanyCreateData({
      userEmail: input.userEmail,
      updateData: companyData,
      contactData,
    });
    const company = await this.prisma.company.create({
      data: createData,
      select: companyProfileSelect(),
    });
    await this.prisma.user.update({
      where: { id: input.userId },
      data: { companyId: company.id },
      select: { id: true },
    });
    return AuthService.mapCompanyToProfileResponse(
      company as unknown as CompanyProfileSelectResult,
    );
  }

  private static toCompanyUpdateData(
    profileData: Record<string, string | string[] | null>,
  ): {
    companyData: Prisma.CompanyUpdateInput;
    contactData: Record<string, string>;
  } {
    const companyFieldKeys: ReadonlySet<string> = new Set([
      'logoUrl',
      'companyNameVi',
      'companyNameEn',
      'companyNameZh',
      'description',
      'country',
      'region',
      'industry',
      'taxId',
    ]);
    const contactFieldToType: Readonly<Record<string, string>> = {
      email: CONTACT_TYPE.EMAIL,
      phone: CONTACT_TYPE.TEL,
      address: CONTACT_TYPE.ADDRESS,
      website: CONTACT_TYPE.WEBSITE,
      fax: CONTACT_TYPE.FAX,
      skype: CONTACT_TYPE.SKYPE,
      contactName: CONTACT_LABEL_KEY,
    };
    const companyData: Record<string, string | string[]> = {};
    const contactData: Record<string, string> = {};
    Object.entries(profileData).forEach(([key, value]) => {
      if (value === null) return;
      if (companyFieldKeys.has(key)) {
        companyData[key] = value;
        return;
      }
      if (Array.isArray(value)) return;
      const type = contactFieldToType[key];
      if (type) {
        contactData[type] = value;
      }
    });
    return {
      companyData: companyData as unknown as Prisma.CompanyUpdateInput,
      contactData,
    };
  }

  private static toCompanyCreateData(input: {
    readonly userEmail: string;
    readonly updateData: Prisma.CompanyUpdateInput;
    readonly contactData: Record<string, string>;
  }): Prisma.CompanyCreateInput {
    const requiredKeys = [
      'phone',
      'industry',
      'address',
      'description',
    ] as const;
    const updateData = input.updateData as Record<string, unknown>;
    const contactData = input.contactData;
    const missing = requiredKeys.filter((k) => {
      const v =
        k === 'phone'
          ? contactData[CONTACT_TYPE.TEL]
          : k === 'address'
            ? contactData[CONTACT_TYPE.ADDRESS]
            : updateData[k];
      if (k === 'industry') {
        return !Array.isArray(v) || v.length === 0;
      }
      return typeof v !== 'string' || v.trim() === '';
    });
    if (missing.length > 0) {
      throw new BadRequestException(
        `Cannot create company profile; missing required fields: ${missing.join(', ')}`,
      );
    }
    const personRaw = contactData[CONTACT_LABEL_KEY];
    const contactName =
      typeof personRaw === 'string' && personRaw.trim().length > 0
        ? personRaw.trim()
        : null;
    return {
      industry: updateData.industry as string[],
      description: updateData.description as string,
      logoUrl: (updateData.logoUrl as string | undefined) ?? null,
      companyNameVi: (updateData.companyNameVi as string | undefined) ?? null,
      companyNameEn: (updateData.companyNameEn as string | undefined) ?? null,
      companyNameZh: (updateData.companyNameZh as string | undefined) ?? null,
      taxId: (updateData.taxId as string | undefined) ?? null,
      country: (updateData.country as string | undefined) ?? null,
      region: (updateData.region as string | undefined) ?? null,
      companyContacts: {
        create: [
          {
            type: CONTACT_TYPE.EMAIL,
            value: input.userEmail.trim().toLowerCase(),
            contactName,
          },
          ...(contactData[CONTACT_TYPE.TEL]
            ? [
                {
                  type: CONTACT_TYPE.TEL,
                  value: contactData[CONTACT_TYPE.TEL],
                  contactName,
                },
              ]
            : []),
          ...(contactData[CONTACT_TYPE.ADDRESS]
            ? [
                {
                  type: CONTACT_TYPE.ADDRESS,
                  value: contactData[CONTACT_TYPE.ADDRESS],
                  contactName,
                },
              ]
            : []),
          ...(contactData[CONTACT_TYPE.WEBSITE]
            ? [
                {
                  type: CONTACT_TYPE.WEBSITE,
                  value: contactData[CONTACT_TYPE.WEBSITE],
                  contactName,
                },
              ]
            : []),
          ...(contactData[CONTACT_TYPE.FAX]
            ? [
                {
                  type: CONTACT_TYPE.FAX,
                  value: contactData[CONTACT_TYPE.FAX],
                  contactName,
                },
              ]
            : []),
          ...(contactData[CONTACT_TYPE.SKYPE]
            ? [
                {
                  type: CONTACT_TYPE.SKYPE,
                  value: contactData[CONTACT_TYPE.SKYPE],
                  contactName,
                },
              ]
            : []),
        ],
      },
    } as Prisma.CompanyCreateInput;
  }

  private static mapCompanyToProfileResponse(
    company: CompanyProfileSelectResult | null,
  ): Partial<Record<ProfileField, string | null>> {
    if (!company) return {};
    const contactFields = AuthService.mapCompanyContactsToProfileFields(
      company.companyContacts,
    );
    return {
      logoUrl: company.logoUrl,
      companyNameVi: company.companyNameVi,
      companyNameEn: company.companyNameEn,
      companyNameZh: company.companyNameZh,
      phone: contactFields.phone ?? null,
      address: contactFields.address ?? null,
      description: company.description,
      taxId: company.taxId,
      country: company.country,
      region: company.region,
      industry: company.industry[0] ?? null,
      website: contactFields.website ?? null,
      fax: contactFields.fax ?? null,
      skype: contactFields.skype ?? null,
      contactName: contactFields.contactName ?? null,
    };
  }

  async updateProfileRequestStatus(
    id: string,
    status: CompanyProfileRequestStatus,
    actorId?: string | null,
  ) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        companyNameVi: true,
        industry: true,
        companyContacts: {
          select: { type: true, value: true, contactName: true },
        },
      },
    });
    if (!company) {
      throw new NotFoundException('Company registration not found');
    }
    const companyEmail = AuthService.getContactValue(
      company.companyContacts,
      CONTACT_TYPE.EMAIL,
    );
    if (!companyEmail) {
      throw new BadRequestException('Company email contact is missing');
    }

    const previousStatus = company.status;
    const updated = await this.prisma.company.update({
      where: { id },
      data: { status },
    });

    await this.auditService.record({
      action: AUDIT_ACTION.PROFILE_REQUEST_STATUS_CHANGED,
      entityType: AUDIT_ENTITY.COMPANY,
      entityId: id,
      actorId: actorId ?? null,
      oldValue: previousStatus,
      newValue: status,
    });

    if (status === CompanyProfileRequestStatus.APPROVED) {
      await this.auditService.record({
        action: AUDIT_ACTION.PROFILE_REQUEST_APPROVED,
        entityType: AUDIT_ENTITY.COMPANY,
        entityId: id,
        actorId: actorId ?? null,
        metadata: {
          email: companyEmail,
          companyNameVi: company.companyNameVi ?? '',
        },
      });
      await this.onCompanyRegistrationApproved({
        id: updated.id,
        industry: updated.industry,
        email: companyEmail,
      });
    }
    if (status === CompanyProfileRequestStatus.REJECTED) {
      await this.auditService.record({
        action: AUDIT_ACTION.PROFILE_REQUEST_REJECTED,
        entityType: AUDIT_ENTITY.COMPANY,
        entityId: id,
        actorId: actorId ?? null,
        metadata: {
          email: companyEmail,
          companyNameVi: company.companyNameVi ?? '',
        },
      });
      await this.mailService.sendAccountRejectedEmail(
        companyEmail.trim().toLowerCase(),
      );
    }

    return updated;
  }

  private async onCompanyRegistrationApproved(company: {
    id: string;
    industry: string[];
    email: string;
  }): Promise<void> {
    const normalizedEmail = company.email.trim().toLowerCase();
    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });
    if (existingUser) {
      throw new ConflictException(
        'A user already exists for this email; cannot approve again.',
      );
    }

    const { token, expiresAt } = this.buildSetPasswordTokenData();
    const placeholderPassword = await this.buildPlaceholderPassword();
    const createdUser = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          password: placeholderPassword,
          role: Role.MEMBER,
          membershipTier: MembershipTier.BRONZE,
          primaryIndustry: company.industry[0] ?? null,
          setPasswordToken: token,
          setPasswordTokenExpiresAt: expiresAt,
        } as Prisma.UserUncheckedCreateInput,
      });
      await tx.user.update({
        where: { id: user.id },
        data: { companyId: company.id },
        select: { id: true },
      });
      return user;
    });

    try {
      const registrationPoints = POINTS_VALUES[PointsSource.REGISTRATION];
      if (typeof registrationPoints === 'number') {
        await this.loyaltyService.awardPoints({
          userId: createdUser.id,
          points: registrationPoints,
          source: PointsSource.REGISTRATION,
          description: 'Registration bonus - Welcome to VN Buyer',
        });
      }
    } catch (error) {
      console.error('Failed to award registration bonus:', error);
    }

    await this.mailService.sendAccountApprovedEmail(normalizedEmail, token);
  }

  async provisionImportedCompanyUser(input: {
    companyId: string;
    industry: string[];
    email: string;
    sendSetPasswordEmail: boolean;
  }): Promise<ProvisionCompanyUserResult> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        companyId: true,
      },
    });

    if (existingUser?.companyId && existingUser.companyId !== input.companyId) {
      return {
        status: 'conflict_other_company',
        userId: existingUser.id,
        email: normalizedEmail,
        companyId: existingUser.companyId,
        conflictingCompanyId: input.companyId,
        setPasswordEmailSent: false,
      };
    }

    if (existingUser?.companyId === input.companyId) {
      return {
        status: 'existing_same_company',
        userId: existingUser.id,
        email: normalizedEmail,
        companyId: input.companyId,
        setPasswordEmailSent: false,
      };
    }

    const { token, expiresAt } = this.buildSetPasswordTokenData();
    let setPasswordEmailSent = false;

    if (existingUser) {
      await this.prisma.user.update({
        where: { id: existingUser.id },
        data: {
          companyId: input.companyId,
          role: Role.MEMBER,
          primaryIndustry: input.industry[0] ?? null,
          setPasswordToken: token,
          setPasswordTokenExpiresAt: expiresAt,
        } as Prisma.UserUncheckedUpdateInput,
      });

      if (input.sendSetPasswordEmail) {
        await this.mailService.sendAccountApprovedEmail(normalizedEmail, token);
        setPasswordEmailSent = true;
      }

      return {
        status: 'linked_existing',
        userId: existingUser.id,
        email: normalizedEmail,
        companyId: input.companyId,
        setPasswordEmailSent,
      };
    }

    const placeholderPassword = await this.buildPlaceholderPassword();
    const createdUser = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        password: placeholderPassword,
        role: Role.MEMBER,
        membershipTier: MembershipTier.BRONZE,
        primaryIndustry: input.industry[0] ?? null,
        companyId: input.companyId,
        setPasswordToken: token,
        setPasswordTokenExpiresAt: expiresAt,
      } as Prisma.UserUncheckedCreateInput,
      select: { id: true },
    });

    if (input.sendSetPasswordEmail) {
      await this.mailService.sendAccountApprovedEmail(normalizedEmail, token);
      setPasswordEmailSent = true;
    }

    return {
      status: 'created',
      userId: createdUser.id,
      email: normalizedEmail,
      companyId: input.companyId,
      setPasswordEmailSent,
    };
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = (await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, isActive: true, deletedAt: true } as {
        id: boolean;
        isActive: boolean;
        deletedAt: boolean;
      },
    })) as { id: string; isActive: boolean; deletedAt: Date | null } | null;
    if (!user || !user.isActive || user.deletedAt != null) {
      return {
        message:
          'If an account exists with this email, you will receive a password reset link.',
      };
    }
    const token = randomBytes(SET_PASSWORD_TOKEN_BYTES).toString('hex');
    const expiryHours =
      this.config.get<number>('mail.resetPasswordTokenExpiryHours') ?? 24;
    const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        setPasswordToken: token,
        setPasswordTokenExpiresAt: expiresAt,
      } as Prisma.UserUncheckedUpdateInput,
    });
    await this.mailService.sendForgotPasswordEmail(normalizedEmail, token);
    return {
      message:
        'If an account exists with this email, you will receive a password reset link.',
    };
  }

  async setPassword(
    token: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findFirst({
      where: {
        setPasswordToken: token,
        setPasswordTokenExpiresAt: { gt: new Date() },
      } as Prisma.UserWhereInput,
      select: { id: true, email: true, companyId: true },
    });
    if (!user) {
      throw new BadRequestException(
        'Invalid or expired set-password link. Request a new one or contact support.',
      );
    }
    const hashed = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashed,
        setPasswordToken: null,
        setPasswordTokenExpiresAt: null,
      } as Prisma.UserUncheckedUpdateInput,
    });

    await this.auditService.record({
      action: AUDIT_ACTION.SET_PASSWORD_USED,
      entityType: AUDIT_ENTITY.USER,
      entityId: user.id,
      metadata: { by: 'token' },
    });

    await this.auditService.record({
      action: AUDIT_ACTION.USER_PASSWORD_CHANGED,
      entityType: AUDIT_ENTITY.USER,
      entityId: user.id,
      actorId: user.id,
      newValue: 'password_set',
    });

    return { message: 'Password set successfully. You can sign in now.' };
  }
}
