import { Module } from '@nestjs/common';
import { NewsController } from './news.controller';
import { NewsInternalController } from './news.internal.controller';
import { NewsService } from './news.service';
import { RssCrawlerService } from './rss-crawler.service';
import { NewsTranslatorService } from './news-translator.service';
import { NewsSchedulerService } from './news-scheduler.service';

@Module({
  controllers: [NewsController, NewsInternalController],
  providers: [NewsService, RssCrawlerService, NewsTranslatorService, NewsSchedulerService],
  exports: [NewsService],
})
export class NewsModule {}
