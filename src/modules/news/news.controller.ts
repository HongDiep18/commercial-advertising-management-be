import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { NewsArticleDto, NewsCategoryWithSubsDto } from './dto/news-article.dto';
import { ListNewsQueryDto } from './dto/list-news-query.dto';
import { NewsService } from './news.service';

@ApiTags('News')
@Controller('news')
@Public()
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Get()
  @ApiOkResponse({ type: [NewsArticleDto] })
  async list(@Query() query: ListNewsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const result = await this.newsService.listPublished(page, limit, {
      categorySlug: query.categorySlug,
      subcategoryId: query.subcategoryId,
    });
    return {
      ...result,
      data: result.data.map((a) => NewsArticleDto.fromEntity(a)),
    };
  }

  @Get('categories')
  @ApiOkResponse({ type: [NewsCategoryWithSubsDto] })
  async categories() {
    return this.newsService.listCategories();
  }

  @Get(':id')
  @ApiOkResponse({ type: NewsArticleDto })
  async get(@Param('id') id: string) {
    const article = await this.newsService.getPublishedById(id);
    return NewsArticleDto.fromEntity(article);
  }

}
