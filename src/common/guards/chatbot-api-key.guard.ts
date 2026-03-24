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
export class ChatbotApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const configured = this.configService.get<string>('chatbot.apiKey');

    if (!configured) {
      throw new InternalServerErrorException('CHATBOT_API_KEY is not configured');
    }

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