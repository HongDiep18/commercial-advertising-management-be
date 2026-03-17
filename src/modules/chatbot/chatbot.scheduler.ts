import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { PrismaService } from '../../database/prisma.service';
import { CrawlerService } from './crawler.service';

@Injectable()
export class ChatbotScheduler implements OnModuleInit {
  private readonly logger = new Logger(ChatbotScheduler.name);
  private isCrawling = false;

  constructor(
    private readonly config: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly crawlerService: CrawlerService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    const enabled = this.config.get<boolean>(
      'chatbot.crawlScheduleEnabled',
      true,
    );

    if (!enabled) {
      this.logger.log(
        'Chatbot crawl scheduler disabled (CHATBOT_CRAWL_SCHEDULE_ENABLED=false)',
      );
    } else {
      const crawlCron = this.config.get<string>(
        'chatbot.crawlCron',
        '0 3 * * 0',
      );
      const crawlJob = new CronJob(crawlCron, () => void this.runCrawl());
      this.schedulerRegistry.addCronJob('chatbot-crawl', crawlJob);
      crawlJob.start();
      this.logger.log(`Chatbot crawl scheduled: ${crawlCron}`);
    }

    // Session cleanup always runs regardless of crawl schedule
    const cleanupCron = this.config.get<string>(
      'chatbot.sessionCleanupCron',
      '0 2 * * *',
    );
    const cleanupJob = new CronJob(cleanupCron, () => void this.cleanupExpiredSessions());
    this.schedulerRegistry.addCronJob('chatbot-session-cleanup', cleanupJob);
    cleanupJob.start();
    this.logger.log(`Chatbot session cleanup scheduled: ${cleanupCron}`);
  }

  async runCrawl() {
    if (this.isCrawling) {
      this.logger.warn('Crawl already in progress, skipping');
      return;
    }
    this.isCrawling = true;
    try {
      this.logger.log('Chatbot crawl started');
      const result = await this.crawlerService.crawlAll();
      this.logger.log(
        `Crawl complete — processed: ${result.pagesProcessed}, skipped: ${result.pagesSkipped}, chunks: ${result.chunksUpserted}`,
      );
    } finally {
      this.isCrawling = false;
    }
  }

  private async cleanupExpiredSessions() {
    const result = await this.prisma.chatSession.deleteMany({
      where: { expiresAt: { lt: new Date() }, userId: null },
    });
    this.logger.log(`Cleaned up ${result.count} expired guest sessions`);
  }
}
