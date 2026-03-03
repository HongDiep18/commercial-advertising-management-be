import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../database/prisma.service';
import * as bcrypt from 'bcrypt';
import { Role } from '../common/enums/role.enum';
import { DEFAULT_REGISTRATION_MEMBERSHIP_LEVEL } from '../common/enums/membership-tier.enum';
import type { RegisterDto } from './dto/register.dto';

interface PrismaWithCompanyProfileRequest {
  companyProfileRequest: {
    findFirst: (args: {
      where: { email: string; status: string };
    }) => Promise<unknown>;
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
  };
}

export type AuthUser = {
  id: string;
  email: string;
  password: string;
  role: string;
  isActive: boolean;
  firstName: string | null;
  lastName: string | null;
};

export type LoginResult = {
  accessToken: string;
  user: { id: string; email: string; role: Role };
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(
    email: string,
    password: string,
  ): Promise<AuthUser | null> {
    const prismaWithUser = this.prisma as unknown as {
      user: {
        findUnique: (args: {
          where: { email: string };
        }) => Promise<AuthUser | null>;
      };
    };
    const user = await prismaWithUser.user.findUnique({
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
    const prismaWithUser = this.prisma as unknown as {
      user: {
        findUnique: (args: {
          where: { email: string };
        }) => Promise<AuthUser | null>;
      };
    };

    const existingUser = await prismaWithUser.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }
    const prisma = this.prisma as unknown as PrismaWithCompanyProfileRequest;
    if (!prisma.companyProfileRequest) {
      throw new InternalServerErrorException(
        'Prisma client missing companyProfileRequest. Run: npx prisma generate, then rebuild and restart.',
      );
    }

    const existingPending = await prisma.companyProfileRequest.findFirst({
      where: { email, status: 'PENDING' },
    });
    if (existingPending) {
      throw new ConflictException(
        'A request with this email is already pending approval.',
      );
    }

    await prisma.companyProfileRequest.create({
      data: {
        email,
        company_name_vi: data.company_name_vi.trim(),
        company_name_cn: data.company_name_cn.trim(),
        phone: data.phone.trim(),
        tax_id: data.tax_id.trim(),
        contact_person: data.contact_person.trim(),
        contact_phone: data.contact_phone.trim(),
        company_address: data.company_address.trim(),
        country: data.country.trim(),
        region: data.region.trim(),
        industry: data.industry.trim(),
        website: data.website.trim(),
        introduction: data.introduction.trim(),
        captcha: data.captcha?.trim() ?? null,
        membership_level:
          data.membership_level?.trim() ||
          DEFAULT_REGISTRATION_MEMBERSHIP_LEVEL,
        status: 'PENDING',
      },
    });
    return {
      message: 'Request submitted. We will email you after approval.',
      status: 'PENDING',
    };
  }
}
