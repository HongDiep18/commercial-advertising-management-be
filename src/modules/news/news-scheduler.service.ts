import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { NewsTranslatorService } from './news-translator.service';
import { RssCrawlerService } from './rss-crawler.service';

@Injectable()
export class NewsSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(NewsSchedulerService.name);
  private isRunning = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly crawlerService: RssCrawlerService,
    private readonly translatorService: NewsTranslatorService,
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
  }

  async runNow() {
    return this.runPipeline();
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
