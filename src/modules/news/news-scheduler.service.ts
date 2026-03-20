import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { NewsTranslatorService } from './news-translator.service';
import { NewsService } from './news.service';
import { RssCrawlerService } from './rss-crawler.service';

const PUBLISHED_RETENTION_DAYS = 90;
const DRAFT_RETENTION_DAYS = 7;

@Injectable()
export class NewsSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(NewsSchedulerService.name);
  private isRunning = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly crawlerService: RssCrawlerService,
    private readonly translatorService: NewsTranslatorService,
    private readonly newsService: NewsService,
  ) {}

  onModuleInit() {
    const enabled = this.configService.get<boolean>(
      'news.scheduleEnabled',
      true,
    );
    if (!enabled) {
      this.logger.log(
        'News pipeline scheduler is disabled (NEWS_SCHEDULE_ENABLED=false)',
      );
      return;
    } else {
      this.logger.log(
        'News pipeline scheduler is enabled (NEWS_SCHEDULE_ENABLED=true)',
      );
    }

    const cronExpr = this.configService.get<string>(
      'news.cron',
      '0 */15 * * * *',
    );
    const job = new CronJob(cronExpr, () => void this.runPipeline());
    this.schedulerRegistry.addCronJob('news-pipeline', job);
    job.start();
    this.logger.log(`News pipeline scheduled: ${cronExpr}`);

    // Weekly cleanup every Sunday at 03:00 — delete old published (90d) and stale draft (7d) articles
    const cleanupJob = new CronJob('0 0 3 * * 0', () => void this.runCleanup());
    this.schedulerRegistry.addCronJob('news-cleanup', cleanupJob);
    cleanupJob.start();
    this.logger.log('News cleanup scheduled: weekly on Sunday at 03:00');
  }

  async runNow() {
    return this.runPipeline();
  }

  private async runCleanup() {
    try {
      const result = await this.newsService.deleteOldArticles(
        PUBLISHED_RETENTION_DAYS,
        DRAFT_RETENTION_DAYS,
      );
      this.logger.log(
        `News cleanup: deletedPublished=${result.deletedPublished} deletedDrafts=${result.deletedDrafts}`,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`News cleanup failed: ${msg}`);
    }
  }

  private async runPipeline() {
    if (this.isRunning) {
      this.logger.warn('Pipeline already running, skipping');
      return { skipped: true };
    }
    this.isRunning = true;
    try {
      this.logger.log('News pipeline started');
      const crawlResult = await this.crawlerService.crawlAll();
      this.logger.log(
        `Crawl: created=${crawlResult.created} updated=${crawlResult.updated} skipped=${crawlResult.skipped}`,
      );
      const translateResult =
        await this.translatorService.translatePendingArticles();
      this.logger.log(
        `Translate: processed=${translateResult.processed} failed=${translateResult.failed}`,
      );
      return { crawlResult, translateResult };
    } finally {
      this.isRunning = false;
    }
  }
}
