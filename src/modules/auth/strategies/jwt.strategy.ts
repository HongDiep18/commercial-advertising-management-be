import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma.service';
import { Role } from '../../../common/enums/role.enum';
import { assertUserActive } from '../auth.utils';

export interface JwtPayload {
  userId?: string;
  sub?: string;
  email: string;
  role: Role;
  issuedAt?: number;
  expiresAt?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret') || 'change-me',
    });
  }

  async validate(payload: JwtPayload) {
    const userId = payload.userId ?? payload.sub;
    if (!userId || !payload.email || !payload.role) {
      throw new UnauthorizedException('Invalid token payload');
    }

    const user = (await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isActive: true, deletedAt: true } as {
        isActive: boolean;
        deletedAt: boolean;
      },
    })) as { isActive: boolean; deletedAt: Date | null } | null;
    assertUserActive(user);

    return {
      userId,
      email: payload.email,
      role: payload.role,
    };
  }
}
