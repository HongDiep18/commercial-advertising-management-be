import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdPackageType } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { CompanyWithAdsResponseDto } from '../companies/dto/company-with-ads-response.dto';
import type { ActiveAdResponse } from './active-ads.service';
import { ActiveAdsService } from './active-ads.service';

@ApiTags('Active Ads')
@Controller('active-ads')
@Public() // Public endpoints for frontend rendering
export class ActiveAdsController {
  constructor(private readonly activeAdsService: ActiveAdsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get active ads by package type',
    description: 'Get active ads for frontend rendering based on package type',
  })
  @ApiQuery({
    name: 'type',
    enum: AdPackageType,
    description: 'Package type to filter ads',
    required: true,
  })
  @ApiQuery({
    name: 'limit',
    type: Number,
    description: 'Maximum number of ads to return',
    required: false,
    example: 5,
  })
  @ApiResponse({
    status: 200,
    description: 'Active ads retrieved successfully',
  })
  async getActiveAds(
    @Query('type') packageType: AdPackageType,
    @Query('limit') limit?: string,
  ): Promise<ActiveAdResponse[]> {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.activeAdsService.getActiveAdsByType(packageType, limitNum);
  }

  @Get('popup-priority')
  @ApiOperation({
    summary: 'Get companies for popup priority display',
    description:
      'Returns companies that have POPUP_PRIORITY_SLOT ads activated. ' +
      'If a company has POPUP_VIEW_DETAILS_LINK activated, ad_link_url is included. ' +
      'Companies with POPUP_RANKING_ADJUSTMENT are prioritized.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of companies eligible for popup priority display',
    type: CompanyWithAdsResponseDto,
    isArray: true,
  })
  getPopupPriorityCompanies(): Promise<CompanyWithAdsResponseDto[]> {
    return this.activeAdsService.getPopupPriorityCompanies();
  }

  @Get('popup-rotational')
  @ApiOperation({
    summary: 'Get companies for popup rotational display',
    description:
      'Returns companies that have POPUP_ROTATION_SLOT ads activated. ' +
      'If a company has POPUP_VIEW_DETAILS_LINK activated, ad_link_url is included. ' +
      'Companies with POPUP_RANKING_ADJUSTMENT are prioritized.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of companies eligible for popup rotational display',
    type: CompanyWithAdsResponseDto,
    isArray: true,
  })
  getPopupRotationalCompanies(): Promise<CompanyWithAdsResponseDto[]> {
    return this.activeAdsService.getPopupRotationalCompanies();
  }

  @Get('placement')
  @ApiOperation({
    summary: 'Get companies with print placement ads',
    description:
      'Returns all companies that have PRINT_PLACEMENT ads activated, including their metadata.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of companies with print placement ads',
    type: CompanyWithAdsResponseDto,
    isArray: true,
  })
  async getPrintPlacementCompanies(): Promise<CompanyWithAdsResponseDto[]> {
    const companies: CompanyWithAdsResponseDto[] =
      await this.activeAdsService.getPrintPlacementCompanies();
    return companies;
  }
}
