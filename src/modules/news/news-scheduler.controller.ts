import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { InternalApiKeyGuard } from '../../common/guards';
import { NewsSchedulerService } from './news-scheduler.service';

@ApiTags('Internal News')
@Controller('internal/news')
@UseGuards(InternalApiKeyGuard)
export class NewsSchedulerController {
  constructor(private readonly schedulerService: NewsSchedulerService) {}

  @Post('pipeline/run')
  @ApiOkResponse({ description: 'Runs crawl + translate pipeline immediately' })
  async runPipeline() {
    return this.schedulerService.runNow();
  }
}
