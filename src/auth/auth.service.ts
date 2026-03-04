import {
  ConflictException,
  Injectable,
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

    const prismaReq = this.prisma as PrismaWithUserProfileRequest;
    const existingPending = await prismaReq.userProfileRequest.findFirst({
      where: { email, status: 'PENDING' },
    });
    if (existingPending) {
      throw new ConflictException(
        'A request with this email is already pending approval.',
      );
    }

    const createData = AuthService.registerDtoToRequestData(data);
    await prismaReq.userProfileRequest.create({
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
    const map: Array<[keyof RegisterDto, string]> = [
      ['company_name_vi', 'companyNameVi'],
      ['company_name_cn', 'companyNameCn'],
      ['phone', 'phone'],
      ['tax_id', 'taxId'],
      ['contact_person', 'contactPerson'],
      ['contact_phone', 'contactPhone'],
      ['company_address', 'companyAddress'],
      ['country', 'country'],
      ['region', 'region'],
      ['industry', 'industry'],
      ['website', 'website'],
      ['introduction', 'introduction'],
    ];
    const out: Record<string, string | null> = {};
    for (const [from, to] of map) {
      const v = data[from];
      out[to] = typeof v === 'string' ? v.trim() : null;
    }
    return {
      ...out,
      captcha: data.captcha?.trim() ?? null,
      membershipTier:
        (data.membership_tier?.trim() as MembershipTier) ||
        DEFAULT_REGISTRATION_MEMBERSHIP_LEVEL,
    };
  }

  private static dtoToProfileData(
    data: UpdateProfileDto,
  ): Record<string, string | null> {
    const map: Array<[keyof UpdateProfileDto, string]> = [
      ['upload_logo', 'logoUrl'],
      ['company_name_vi', 'companyNameVi'],
      ['company_name_cn', 'companyNameCn'],
      ['phone', 'phone'],
      ['tax_id', 'taxId'],
      ['contact_person', 'contactPerson'],
      ['contact_phone', 'contactPhone'],
      ['company_address', 'companyAddress'],
      ['email', 'email'],
      ['country', 'country'],
      ['region', 'region'],
      ['industry', 'industry'],
      ['website', 'website'],
      ['introduction', 'introduction'],
    ];
    const out: Record<string, string | null> = {};
    for (const [from, to] of map) {
      const v = data[from];
      if (v !== undefined) {
        out[to] = typeof v === 'string' ? v.trim() || null : null;
      }
    }
    return out;
  }

  async updateProfile(
    userId: string,
    data: UpdateProfileDto,
  ): Promise<{
    id: string;
    email: string;
    membershipLevel: string;
    logoUrl?: string | null;
    companyNameVi?: string | null;
    companyNameCn?: string | null;
    phone?: string | null;
    taxId?: string | null;
    contactPerson?: string | null;
    contactPhone?: string | null;
    companyAddress?: string | null;
    country?: string | null;
    region?: string | null;
    industry?: string | null;
    website?: string | null;
    introduction?: string | null;
  }> {
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
    const select = {
      logoUrl: true,
      companyNameVi: true,
      companyNameCn: true,
      phone: true,
      taxId: true,
      contactPerson: true,
      contactPhone: true,
      companyAddress: true,
      email: true,
      country: true,
      region: true,
      industry: true,
      website: true,
      introduction: true,
    } as const;

    type ProfileSelect = { [K in keyof typeof select]: string | null };

    const profile: ProfileSelect | null =
      Object.keys(profileData).length > 0
        ? ((await this.prisma.userProfile.upsert({
            where: { userId },
            create: { userId, ...profileData },
            update: profileData,
            select,
          })) as ProfileSelect)
        : ((await this.prisma.userProfile.findUnique({
            where: { userId },
            select,
          })) as ProfileSelect | null);

    const { email: _profileEmail, ...restProfile } =
      profile ?? ({} as ProfileSelect);
    void _profileEmail;
    return {
      id: user.id,
      email: user.email,
      membershipLevel: user.membershipTier,
      ...restProfile,
    };
  }
}
