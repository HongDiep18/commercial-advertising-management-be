import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { InternalApiKeyGuard } from '../../common/guards';
import {
  IngestNewsArticlesDto,
  IngestNewsArticlesResultDto,
} from './dto/ingest-news-article.dto';
import { WriteNewsSummaryDto } from './dto/write-news-summary.dto';
import { NewsArticleDto } from './dto/news-article.dto';
import { NewsService } from './news.service';

@ApiTags('Internal News')
@Controller('internal/news')
@UseGuards(InternalApiKeyGuard)
export class NewsInternalController {
  constructor(private readonly newsService: NewsService) {}

  @Post('articles/ingest')
  @ApiOkResponse({ type: IngestNewsArticlesResultDto })
  async ingest(@Body() body: IngestNewsArticlesDto): Promise<IngestNewsArticlesResultDto> {
    return this.newsService.ingestMany(body.articles);
  }

  @Post('articles/:id/summary')
  @ApiOkResponse({ type: NewsArticleDto })
  async writeSummary(@Param('id') id: string, @Body() body: WriteNewsSummaryDto) {
    const updated = await this.newsService.writeSummary(id, body);
    return NewsArticleDto.fromEntity(updated);
  }
}

