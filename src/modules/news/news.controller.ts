import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { NewsArticleDto } from './dto/news-article.dto';
import { NewsService } from './news.service';

@ApiTags('News')
@Controller('news')
@Public()
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Get()
  @ApiOkResponse({ type: [NewsArticleDto] })
  async list(@Query() pagination: PaginationDto) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const result = await this.newsService.listPublished(page, limit);
    return {
      ...result,
      data: result.data.map((a) => NewsArticleDto.fromEntity(a)),
    };
  }

  @Get(':id')
  @ApiOkResponse({ type: NewsArticleDto })
  async get(@Param('id') id: string) {
    const article = await this.newsService.getPublishedById(id);
    return NewsArticleDto.fromEntity(article);
  }

  @Get(':id/out')
  async out(@Param('id') id: string, @Res() res: Response) {
    const article = await this.newsService.getPublishedById(id);
    return res.redirect(article.url);
  }
}
