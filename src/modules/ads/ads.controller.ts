import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AdPackageCategoryItem } from './ads.service';
import { AdsService } from './ads.service';

@ApiTags('Ads')
@ApiBearerAuth()
@Controller()
export class AdsController {
  constructor(private readonly adsService: AdsService) {}

  @Get('ad-packages')
  @ApiOperation({
    summary: 'Get available ad packages and pricing for purchase',
    description:
      'Returns active ad package categories with their active packages and pricing options.',
  })
  async getAvailableAdPackages(): Promise<AdPackageCategoryItem[]> {
    return this.adsService.getAvailableAdPackages();
  }
}
