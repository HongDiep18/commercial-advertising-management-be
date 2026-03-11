import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Role } from '../../../common/enums/role.enum';

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
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret') || 'change-me',
    });
  }

  validate(payload: JwtPayload) {
    const userId = payload.userId ?? payload.sub;
    if (!userId || !payload.email || !payload.role) {
      throw new UnauthorizedException('Invalid token payload');
    }

    return {
      userId,
      email: payload.email,
      role: payload.role,
    };
  }
}
