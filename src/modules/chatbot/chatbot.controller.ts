import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Res,
  HttpException,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ThrottleChat } from '../../common/decorators/throttle-auth.decorator';
import { ChatbotApiKeyGuard } from '../../common/guards/chatbot-api-key.guard';
import { InternalApiKeyGuard } from '../../common/guards/internal-api-key.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import type { UserPayload } from '../../common/interfaces/user-payload.interface';
import { ChatbotService } from './chatbot.service';
import { CrawlerService } from './crawler.service';
import { SpamDetectorService } from './spam-detector.service';
import { ChatMessageDto } from './dto/chat-message.dto';
import { SessionQueryDto } from './dto/session-query.dto';

@ApiTags('Chatbot')
@Controller('chatbot')
export class ChatbotController {
  constructor(
    private readonly chatbotService: ChatbotService,
    private readonly crawlerService: CrawlerService,
    private readonly spamDetector: SpamDetectorService,
  ) {}

  @Post('message')
  @Public()
  @ThrottleChat()
  @UseGuards(OptionalJwtAuthGuard, ChatbotApiKeyGuard)
  @ApiOperation({ summary: 'Send a message to the chatbot (SSE stream)' })
  async message(
    @Body() dto: ChatMessageDto,
    @CurrentUser() user: UserPayload | undefined,
    @Res() res: Response,
  ): Promise<void> {
    if (!user?.userId && !dto.guestId) {
      throw new BadRequestException('guestId is required for unauthenticated requests');
    }

    const identity = user?.userId
      ? `user:${user.userId}`
      : `guest:${dto.guestId ?? 'anon'}`;

    const spamResult = this.spamDetector.check(identity, dto.message);
    if (spamResult) {
      const retryAfterSec = Math.ceil(spamResult.retryAfterMs / 1000);
      throw new HttpException(
        `Spam detected. Please wait ${retryAfterSec} seconds before sending again.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
      for await (const token of this.chatbotService.chatStream(dto.message, {
        userId: user?.userId,
        guestId: dto.guestId,
      })) {
        if (!res.writable) break;
        res.write(`data: ${JSON.stringify({ token })}\n\n`);
      }
    } catch {
      if (res.writable) {
        res.write(`data: ${JSON.stringify({ error: 'An error occurred. Please try again.' })}\n\n`);
      }
    } finally {
      if (res.writable) {
        res.write('data: [DONE]\n\n');
        res.end();
      }
    }
  }

  @Get('session')
  @Public()
  @UseGuards(OptionalJwtAuthGuard, ChatbotApiKeyGuard)
  @ApiOperation({ summary: 'Get session message history for UI display' })
  async getSession(
    @Query() query: SessionQueryDto,
    @CurrentUser() user?: UserPayload,
  ) {
    if (!user?.userId && !query.guestId) {
      throw new BadRequestException('guestId is required for unauthenticated requests');
    }
    return this.chatbotService.getSessionMessages({
      userId: user?.userId,
      guestId: query.guestId,
    });
  }

  @Delete('session')
  @Public()
  @UseGuards(OptionalJwtAuthGuard, ChatbotApiKeyGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear session (refresh button)' })
  async clearSession(
    @Body() body: SessionQueryDto,
    @CurrentUser() user?: UserPayload,
  ) {
    if (!user?.userId && !body?.guestId) {
      throw new BadRequestException('guestId is required for unauthenticated requests');
    }
    await this.chatbotService.clearSession({
      userId: user?.userId,
      guestId: body?.guestId,
    });
    return { cleared: true };
  }

  @Post('crawl')
  @Public()
  @UseGuards(InternalApiKeyGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger a full site re-crawl (internal)' })
  async crawl() {
    return this.crawlerService.crawlAll();
  }
}
