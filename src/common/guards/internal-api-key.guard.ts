import {
  CanActivate,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class InternalApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const configured = this.configService.get<string>('app.internalApiKey');
    if (!configured) {
      throw new InternalServerErrorException('INTERNAL_API_KEY is not configured');
    }

    const allowedKeys = configured
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);

    const request = context.switchToHttp().getRequest<Request>();
    const provided = (request.headers?.['x-internal-api-key'] as string | undefined)?.trim();

    if (!provided || !allowedKeys.includes(provided)) {
      throw new UnauthorizedException('Invalid internal API key');
    }

    return true;
  }
}
