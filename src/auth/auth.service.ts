import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MembershipTier, PrismaClient } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import * as bcrypt from 'bcrypt';
import { Role } from '../common/enums/role.enum';
import { DEFAULT_REGISTRATION_MEMBERSHIP_LEVEL } from '../common/enums/membership-tier.enum';
import type { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

type PrismaWithUserProfileRequest = PrismaClient & {
  userProfileRequest: {
    findFirst: (args: {
      where: { email: string; status: string };
    }) => Promise<{ id: string } | null>;
    create: (args: {
      data: Record<string, unknown>;
    }) => Promise<{ id: string }>;
  };
};

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
  'taxId',
  'contactPerson',
  'contactPhone',
  'companyAddress',
  'email',
  'country',
  'region',
  'industry',
  'website',
  'introduction',
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

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaClient,
    private readonly jwtService: JwtService,
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

    const prismaAny = this.prisma as unknown as Record<string, unknown>;
    const requestDelegate =
      (prismaAny.userProfileRequest as PrismaWithUserProfileRequest['userProfileRequest']) ??
      (prismaAny.companyProfileRequest as PrismaWithUserProfileRequest['userProfileRequest']);
    if (!requestDelegate?.findFirst || !requestDelegate?.create) {
      throw new InternalServerErrorException(
        'Prisma client missing userProfileRequest. Run: pnpm prisma generate',
      );
    }
    const existingPending = await requestDelegate.findFirst({
      where: { email, status: 'PENDING' },
    });
    if (existingPending) {
      throw new ConflictException(
        'A request with this email is already pending approval.',
      );
    }

    const createData = AuthService.registerDtoToRequestData(data);
    await requestDelegate.create({
      data: {
        email,
        ...createData,
        status: 'PENDING',
      },
    });
    return {
      message: 'Request submitted. We will email you after approval.',
      status: 'PENDING',
    };
  }

  private static registerDtoToRequestData(data: RegisterDto) {
    const out: Record<string, unknown> = {};
    const dataRecord = data as unknown as Record<string, unknown>;

    Object.keys(data).forEach((key) => {
      const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
      const value = dataRecord[key];
      out[camelKey] = typeof value === 'string' ? value.trim() : value;
    });

    return {
      ...out,
      membershipTier:
        (out.membershipTier as MembershipTier) ||
        DEFAULT_REGISTRATION_MEMBERSHIP_LEVEL,
      captcha: data.captcha?.trim() ?? null,
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

      const camelKey =
        key === 'upload_logo'
          ? 'logoUrl'
          : key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
      const raw = dataRecord[key];
      const val = typeof raw === 'string' ? raw.trim() || null : null;

      if (key === 'upload_logo' && val === null) return;

      out[camelKey] = val;
    });

    return out;
  }

  async getProfile(userId: string): Promise<ProfileResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, membershipTier: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const profile = (await this.prisma.userProfile.findUnique({
      where: { userId },
      select: profileSelect(),
    })) as Record<ProfileField, string | null> | null;

    const { email: _omit, ...profileRest } =
      profile ?? ({} as Record<ProfileField, string | null>);
    void _omit;
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
      select: { id: true, email: true, membershipTier: true },
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
        select: { id: true, email: true, membershipTier: true },
      });
    }

    if (data.membership_tier !== undefined && data.membership_tier.trim()) {
      const tier = data.membership_tier.trim() as MembershipTier;
      user = await this.prisma.user.update({
        where: { id: userId },
        data: { membershipTier: tier },
        select: { id: true, email: true, membershipTier: true },
      });
    }

    const profileData = AuthService.dtoToProfileData(data);
    const select = profileSelect();

    const profile: Record<ProfileField, string | null> | null =
      Object.keys(profileData).length > 0
        ? ((await this.prisma.userProfile.upsert({
            where: { userId },
            create: { userId, ...profileData },
            update: profileData,
            select,
          })) as Record<ProfileField, string | null>)
        : ((await this.prisma.userProfile.findUnique({
            where: { userId },
            select,
          })) as Record<ProfileField, string | null> | null);

    const { email: _omit, ...profileRest } =
      profile ?? ({} as Record<ProfileField, string | null>);
    void _omit;
    return {
      id: user.id,
      email: user.email,
      membershipTier: user.membershipTier,
      ...profileRest,
    };
  }
}
