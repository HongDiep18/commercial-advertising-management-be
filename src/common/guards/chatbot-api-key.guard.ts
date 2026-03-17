import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class ChatbotApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const configured = this.configService.get<string>('chatbot.apiKey');

    // If no key is configured, skip guard (useful in dev without the key set)
    if (!configured) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const provided = (
      request.headers?.['x-chatbot-key'] as string | undefined
    )?.trim();

    if (!provided || provided !== configured) {
      throw new UnauthorizedException('Invalid chatbot API key');
    }

    return true;
  }
}