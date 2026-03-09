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
import { Role } from '../common/enums/role.enum';
import { PrismaService } from '../database/prisma.service';
import { MailService } from '../mail/mail.service';
import * as bcrypt from 'bcrypt';
import { DEFAULT_REGISTRATION_MEMBERSHIP_LEVEL } from '../common/enums/membership-tier.enum';
import type { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

export type AuthUser = {
  id: string;
  email: string;
  password: string;
  role: string;
  isActive: boolean;
};

export type LoginResult = {
  accessToken: string;
  user: { id: string; email: string; role: Role };
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

type ProfileRequestForCompany = Pick<
  Prisma.CompanyProfileRequestGetPayload<object>,
  | 'email'
  | 'companyNameVi'
  | 'companyNameCn'
  | 'phone'
  | 'taxId'
  | 'contactName'
  | 'contactPhone'
  | 'companyAddress'
  | 'country'
  | 'region'
  | 'industry'
  | 'website'
  | 'introduction'
>;

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaClient,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly mailService: MailService,
  ) {}

  async validateUser(
    email: string,
    password: string,
  ): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (!user) return null;
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return null;
    if (!user.isActive) return null;
    return user;
  }

  async login(email: string, password: string): Promise<LoginResult> {
    const user = await this.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role as Role,
    };
    const accessToken = this.jwtService.sign(payload);
    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role as Role,
      },
    };
  }

  async register(data: RegisterDto): Promise<{
    message: string;
    status: string;
  }> {
    const email = data.email.trim().toLowerCase();
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const existingPending = await this.prisma.companyProfileRequest.findFirst({
      where: { email, status: CompanyProfileRequestStatus.PENDING },
    });
    if (existingPending) {
      throw new ConflictException(
        'A request with this email is already pending approval.',
      );
    }

    const createData = AuthService.toCompanyProfileRequestCreateInput(data);
    await this.prisma.companyProfileRequest.create({
      data: {
        ...createData,
        email,
        status: CompanyProfileRequestStatus.PENDING,
      },
    });
    return {
      message: 'Request submitted. We will email you after approval.',
      status: CompanyProfileRequestStatus.PENDING,
    };
  }

  private static toCompanyProfileRequestCreateInput(
    data: RegisterDto,
  ): Omit<Prisma.CompanyProfileRequestCreateInput, 'email' | 'status'> {
    const membershipTier =
      (data.membership_tier?.trim() as MembershipTier | undefined) ??
      DEFAULT_REGISTRATION_MEMBERSHIP_LEVEL;
    return {
      companyNameVi: data.company_name_vi.trim(),
      companyNameCn: data.company_name_cn.trim(),
      phone: data.phone.trim(),
      taxId: data.tax_id.trim(),
      contactName: data.contact_person.trim(),
      contactPhone: data.contact_phone?.trim() || data.phone.trim(),
      companyAddress: data.company_address.trim(),
      country: data.country.trim(),
      region: data.region.trim(),
      industry: data.industry.trim(),
      website: data.website.trim(),
      introduction: data.introduction.trim(),
      captcha: data.captcha.trim(),
      membershipTier,
    };
  }

  private static dtoToProfileData(
    data: UpdateProfileDto,
  ): Record<string, string | null> {
    const out: Record<string, string | null> = {};
    const dataRecord = data as unknown as Record<string, unknown>;

    const skipKeys = new Set(['membership_tier', 'captcha']);

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

  async getProfile(userId: string): Promise<ProfileResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        membershipTier: true,
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
      ...profileRest,
    };
  }

  async updateProfile(
    userId: string,
    data: UpdateProfileDto,
  ): Promise<ProfileResponse> {
    let user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        membershipTier: true,
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
    return {
      id: user.id,
      email: user.email,
      membershipTier: user.membershipTier,
      ...companyProfile,
    };
  }

  async getAllProfileRequests(status?: string) {
    const validStatuses = Object.values(
      CompanyProfileRequestStatus,
    ) as readonly string[];
    const where =
      status && validStatuses.includes(status)
        ? { status: status as CompanyProfileRequestStatus }
        : undefined;
    return this.prisma.companyProfileRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
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

  private static companyCreateInputFromProfileRequest(
    request: ProfileRequestForCompany,
  ): Prisma.CompanyCreateInput {
    return {
      email: request.email.trim().toLowerCase(),
      phone: request.phone,
      industry: request.industry,
      address: request.companyAddress,
      description: request.introduction,
      logoUrl: null,
      companyNameVi: request.companyNameVi,
      companyNameCn: request.companyNameCn,
      taxId: request.taxId,
      country: request.country,
      region: request.region,
      website: request.website,
      contactName: request.contactName,
      contactPhone: request.contactPhone,
    } as Prisma.CompanyCreateInput;
  }

  async updateProfileRequestStatus(
    id: string,
    status: CompanyProfileRequestStatus,
  ) {
    const request = await this.prisma.companyProfileRequest.findUnique({
      where: { id },
    });
    if (!request) {
      throw new NotFoundException('Profile request not found');
    }

    const updated = await this.prisma.companyProfileRequest.update({
      where: { id },
      data: { status },
    });

    if (status === CompanyProfileRequestStatus.APPROVED) {
      await this.onProfileRequestApproved(
        request.email,
        request.membershipTier,
      );
    }
    if (status === CompanyProfileRequestStatus.REJECTED) {
      await this.mailService.sendAccountRejectedEmail(
        request.email.trim().toLowerCase(),
      );
    }

    return updated;
  }

  private async onProfileRequestApproved(
    email: string,
    membershipTier: MembershipTier,
  ): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
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

    await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        password: placeholderPassword,
        role: Role.MEMBER,
        membershipTier,
        setPasswordToken: token,
        setPasswordTokenExpiresAt: expiresAt,
      } as Prisma.UserUncheckedCreateInput,
    });

    await this.mailService.sendAccountApprovedEmail(normalizedEmail, token);
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, isActive: true },
    });
    if (!user || !user.isActive) {
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

    if (!user.companyId) {
      const approvedRequest = await this.prisma.companyProfileRequest.findFirst(
        {
          where: {
            email: user.email,
            status: CompanyProfileRequestStatus.APPROVED,
          },
        },
      );
      if (approvedRequest) {
        const companyData =
          AuthService.companyCreateInputFromProfileRequest(approvedRequest);
        const company = await this.prisma.company.create({
          data: companyData,
          select: { id: true },
        });
        await this.prisma.user.update({
          where: { id: user.id },
          data: { companyId: company.id },
        });
      }
    }

    return { message: 'Password set successfully. You can sign in now.' };
  }
}
