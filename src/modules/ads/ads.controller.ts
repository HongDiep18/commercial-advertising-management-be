import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import type { AdPackageCategoryItem, BookedDatesResult } from './ads.service';
import { AdsService } from './ads.service';
import { GetBookedDatesQueryDto } from './dto/get-booked-dates-query.dto';

@ApiTags('Ads')
@Controller()
export class AdsController {
  constructor(private readonly adsService: AdsService) {}

  @Public()
  @Get('ad-packages')
  @ApiOperation({
    summary: 'Get available ad packages and pricing for purchase',
    description:
      'Returns active ad package categories with their active packages and pricing options.',
  })
  async getAvailableAdPackages(): Promise<AdPackageCategoryItem[]> {
    return this.adsService.getAvailableAdPackages();
  }

  @Public()
  @Get('ads/booked-dates')
  @ApiOperation({
    summary: 'Get fully-booked date ranges for a slot-limited ad package type',
    description:
      'Returns date ranges where the slot is at full capacity. ' +
      'Use this to grey out unavailable start dates in the calendar picker. ' +
      'Only relevant for POPUP_PRIORITY_SLOT and POPUP_ROTATION_SLOT.',
  })
  async getBookedDates(
    @Query() query: GetBookedDatesQueryDto,
  ): Promise<BookedDatesResult> {
    return this.adsService.getBookedDates(query.packageType);
  }
}
