import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from '../../database/database.module';
import { ChatThrottlerGuard } from '../../common/guards/chat-throttler.guard';
import { checkpointProvider } from './checkpoint.provider';
import { ChatbotController } from './chatbot.controller';
import { ChatbotScheduler } from './chatbot.scheduler';
import { ChatbotService } from './chatbot.service';
import { ContextRetrievalService } from './context-retrieval.service';
import { CrawlerService } from './crawler.service';
import { SessionService } from './session.service';
import { SpamDetectorService } from './spam-detector.service';
import { vectorStoreProvider } from './vectorstore.provider';

@Module({
  imports: [DatabaseModule, ScheduleModule.forRoot()],
  controllers: [ChatbotController],
  providers: [
    vectorStoreProvider,
    checkpointProvider,
    ChatThrottlerGuard,
    SpamDetectorService,
    SessionService,
    ContextRetrievalService,
    CrawlerService,
    ChatbotService,
    ChatbotScheduler,
  ],
})
export class ChatbotModule {}
