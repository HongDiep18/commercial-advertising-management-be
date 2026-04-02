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
import type { Company } from '@prisma/client';
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
import { CaptchaVerificationService } from './captcha-verification.service';

import type { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import type {
  AdminListUsersQueryDto,
  AdminListUsersResponseDto,
  AdminUserStatus,
} from './dto/admin-list-users.dto';

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

const PROFILE_SELECT_KEYS = [
  'logoUrl',
  'companyNameVi',
  'companyNameCn',
  'phone',
  'address',
  'description',
  'taxId',
  'country',
  'region',
  'industry',
  'website',
  'contactName',
  'contactPhone',
] as const;

type ProfileField = (typeof PROFILE_SELECT_KEYS)[number];

export type ProfileResponse = {
  id: string;
  email: string;
  membershipTier: string;
  role: string;
} & Partial<Record<ProfileField, string | null>>;

function profileSelect(): Record<ProfileField, true> {
  return Object.fromEntries(
    PROFILE_SELECT_KEYS.map((k) => [k, true]),
  ) as Record<ProfileField, true>;
}

type CompanyProfileSelectResult = {
  readonly id: string;
  readonly logoUrl: string | null;
  readonly companyNameVi: string | null;
  readonly companyNameCn: string | null;
  readonly phone: string;
  readonly industry: string;
  readonly address: string;
  readonly description: string;
  readonly taxId: string | null;
  readonly country: string | null;
  readonly region: string | null;
  readonly website: string | null;
  readonly contactName: string | null;
  readonly contactPhone: string | null;
};

function companyProfileSelect(): { readonly id: true } & Record<
  ProfileField,
  true
> {
  return { id: true, ...profileSelect() };
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
    const email = data.email.trim().toLowerCase();
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const existingCompany = await this.prisma.company.findUnique({
      where: { email },
    });
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
        data: AuthService.companyCreateDataFromRegisterDto(data, email),
      });
      await this.auditService.record({
        action: AUDIT_ACTION.PROFILE_REQUEST_CREATED,
        entityType: AUDIT_ENTITY.COMPANY,
        entityId: company.id,
        metadata: {
          email,
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
      data: AuthService.companyCreateDataFromRegisterDto(data, email),
    });

    await this.auditService.record({
      action: AUDIT_ACTION.PROFILE_REQUEST_CREATED,
      entityType: AUDIT_ENTITY.COMPANY,
      entityId: company.id,
      metadata: {
        email,
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
    email: string,
  ): Prisma.CompanyCreateInput {
    return {
      email,
      companyNameVi: data.company_name_vi.trim(),
      companyNameCn: data.company_name_cn.trim(),
      phone: data.phone.trim(),
      taxId: data.tax_id.trim(),
      contactName: data.contact_person.trim(),
      contactPhone: data.contact_phone?.trim() || data.phone.trim(),
      address: data.company_address.trim(),
      country: data.country.trim(),
      ...(data.region && data.region.trim()
        ? { region: data.region.trim() }
        : { region: null }),
      industry: data.industry.trim(),
      website: data.website.trim(),
      description: data.introduction.trim(),
      status: CompanyProfileRequestStatus.PENDING,
    };
  }

  private static dtoToProfileData(
    data: UpdateProfileDto,
  ): Record<string, string | null> {
    const out: Record<string, string | null> = {};
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
      const val = typeof raw === 'string' ? raw.trim() || null : null;

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

  async getAllProfileRequests(status?: string) {
    const validStatuses = Object.values(
      CompanyProfileRequestStatus,
    ) as readonly string[];
    const where =
      status && validStatuses.includes(status)
        ? {
            status: status as CompanyProfileRequestStatus,
          }
        : undefined;
    const companies = await this.prisma.company.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

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

    return companies.map((c) => {
      const user = userByCompanyId.get(c.id);
      const { status: companyStatus, ...companyData } = c;
      return {
        ...companyData,
        status: companyStatus,
        userId: user?.id ?? null,
        companyId: user?.companyId ?? null,
        isActive: user?.isActive ?? null,
      };
    });
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
              { contactName: { contains: search, mode: 'insensitive' } },
              { companyNameVi: { contains: search, mode: 'insensitive' } },
              { companyNameCn: { contains: search, mode: 'insensitive' } },
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
              contactName: true,
              companyNameVi: true,
              companyNameCn: true,
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
        contactName: string | null;
        companyNameVi: string | null;
        companyNameCn: string | null;
      } | null;
    };

    const rows = (users as unknown as AdminListUserRow[]).map((u) => {
      const statusVal: AdminUserStatus =
        u.deletedAt != null ? 'deleted' : u.isActive ? 'active' : 'suspended';
      const company = u.company;
      return {
        userId: u.id,
        companyId: u.companyId,
        contactName: company?.contactName ?? null,
        email: u.email,
        companyNameVi: company?.companyNameVi ?? null,
        companyNameCn: company?.companyNameCn ?? null,
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
    readonly profileData: Record<string, string | null>;
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
    const updateData = AuthService.toCompanyUpdateData(profileData);
    if (input.companyId) {
      const company = await this.prisma.company.update({
        where: { id: input.companyId },
        data: updateData,
        select: companyProfileSelect(),
      });
      return AuthService.mapCompanyToProfileResponse(
        company as unknown as CompanyProfileSelectResult,
      );
    }
    const createData = AuthService.toCompanyCreateData({
      userEmail: input.userEmail,
      updateData,
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
    profileData: Record<string, string | null>,
  ): Prisma.CompanyUpdateInput {
    const allowedKeys: ReadonlySet<string> = new Set(PROFILE_SELECT_KEYS);
    const out: Record<string, string | null> = {};
    Object.entries(profileData).forEach(([key, value]) => {
      if (!allowedKeys.has(key)) return;
      if (value === null) return;
      out[key] = value;
    });
    return out as Prisma.CompanyUpdateInput;
  }

  private static toCompanyCreateData(input: {
    readonly userEmail: string;
    readonly updateData: Prisma.CompanyUpdateInput;
  }): Prisma.CompanyCreateInput {
    const requiredKeys = [
      'contactName',
      'phone',
      'industry',
      'address',
      'description',
    ] as const;
    const updateData = input.updateData as Record<string, unknown>;
    const missing = requiredKeys.filter((k) => {
      const v = updateData[k];
      return typeof v !== 'string' || v.trim() === '';
    });
    if (missing.length > 0) {
      throw new BadRequestException(
        `Cannot create company profile; missing required fields: ${missing.join(', ')}`,
      );
    }
    return {
      email: input.userEmail.trim().toLowerCase(),
      phone: updateData.phone as string,
      industry: updateData.industry as string,
      address: updateData.address as string,
      description: updateData.description as string,
      contactName: (updateData.contactName as string | undefined) ?? null,
      contactPhone: (updateData.contactPhone as string | undefined) ?? null,
      logoUrl: (updateData.logoUrl as string | undefined) ?? null,
      companyNameVi: (updateData.companyNameVi as string | undefined) ?? null,
      companyNameCn: (updateData.companyNameCn as string | undefined) ?? null,
      taxId: (updateData.taxId as string | undefined) ?? null,
      country: (updateData.country as string | undefined) ?? null,
      region: (updateData.region as string | undefined) ?? null,
      website: (updateData.website as string | undefined) ?? null,
    } as Prisma.CompanyCreateInput;
  }

  private static mapCompanyToProfileResponse(
    company: CompanyProfileSelectResult | null,
  ): Partial<Record<ProfileField, string | null>> {
    if (!company) return {};
    return {
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
    };
  }

  async updateProfileRequestStatus(
    id: string,
    status: CompanyProfileRequestStatus,
    actorId?: string | null,
  ) {
    const company = await this.prisma.company.findUnique({
      where: { id },
    });
    if (!company) {
      throw new NotFoundException('Company registration not found');
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
          email: company.email,
          companyNameVi: company.companyNameVi ?? '',
        },
      });
      await this.onCompanyRegistrationApproved(updated);
    }
    if (status === CompanyProfileRequestStatus.REJECTED) {
      await this.auditService.record({
        action: AUDIT_ACTION.PROFILE_REQUEST_REJECTED,
        entityType: AUDIT_ENTITY.COMPANY,
        entityId: id,
        actorId: actorId ?? null,
        metadata: {
          email: company.email,
          companyNameVi: company.companyNameVi ?? '',
        },
      });
      await this.mailService.sendAccountRejectedEmail(
        company.email.trim().toLowerCase(),
      );
    }

    return updated;
  }

  private async onCompanyRegistrationApproved(company: Company): Promise<void> {
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

    const token = randomBytes(SET_PASSWORD_TOKEN_BYTES).toString('hex');
    const expiryDays =
      this.config.get<number>('mail.setPasswordTokenExpiryDays') ?? 7;
    const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);
    const placeholderPassword = await bcrypt.hash(
      randomBytes(32).toString('hex'),
      10,
    );
    const createdUser = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          password: placeholderPassword,
          role: Role.MEMBER,
          membershipTier: MembershipTier.BRONZE,
          primaryIndustry: company.industry ?? null,
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
