import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { InternalApiKeyGuard } from '../../common/guards';
import { WriteNewsSummaryDto } from './dto/write-news-summary.dto';
import { NewsArticleDto } from './dto/news-article.dto';
import { NewsService } from './news.service';
import { NewsSchedulerService } from './news-scheduler.service';

@ApiTags('Internal News')
@Controller('internal/news')
@UseGuards(InternalApiKeyGuard)
export class NewsInternalController {
  constructor(
    private readonly newsService: NewsService,
    private readonly schedulerService: NewsSchedulerService,
  ) {}

  @Post('articles/:id/summary')
  @ApiOkResponse({ type: NewsArticleDto })
  async writeSummary(@Param('id') id: string, @Body() body: WriteNewsSummaryDto) {
    const updated = await this.newsService.writeSummary(id, body);
    return NewsArticleDto.fromEntity(updated);
  }

  @Post('pipeline/run')
  @ApiOkResponse({ description: 'Runs crawl + translate pipeline immediately' })
  async runPipeline() {
    return this.schedulerService.runNow();
  }
}
