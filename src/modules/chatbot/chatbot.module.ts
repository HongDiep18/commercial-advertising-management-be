import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { checkpointProvider } from './checkpoint.provider';
import { ChatbotController } from './chatbot.controller';
import { ChatbotScheduler } from './chatbot.scheduler';
import { ChatbotService } from './chatbot.service';
import { CrawlerService } from './crawler.service';
import { vectorStoreProvider } from './vectorstore.provider';

@Module({
  imports: [DatabaseModule],
  controllers: [ChatbotController],
  providers: [
    vectorStoreProvider,
    checkpointProvider,
    CrawlerService,
    ChatbotService,
    ChatbotScheduler,
  ],
})
export class ChatbotModule {}
