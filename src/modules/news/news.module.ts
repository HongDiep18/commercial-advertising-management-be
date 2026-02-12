import { Module } from '@nestjs/common';
import { NewsController } from './news.controller';
import { NewsInternalController } from './news.internal.controller';
import { NewsService } from './news.service';

@Module({
  controllers: [NewsController, NewsInternalController],
  providers: [NewsService],
  exports: [NewsService],
})
export class NewsModule {}
