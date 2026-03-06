import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdPackageType } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { CompanyWithAdsResponseDto } from '../companies/dto/company-with-ads-response.dto';
import { ActiveAdResponse, ActiveAdsService } from './active-ads.service';

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

  @Get('companies/:companyId')
  @ApiOperation({
    summary: 'Get active ads for a specific company',
    description: 'Get all active ads for a specific company',
  })
  @ApiResponse({
    status: 200,
    description: 'Company active ads retrieved successfully',
  })
  async getCompanyActiveAds(
    @Param('companyId') companyId: string,
  ): Promise<ActiveAdResponse[]> {
    return this.activeAdsService.getCompanyActiveAds(companyId);
  }

  @Get('popup')
  @ApiOperation({
    summary: 'Get companies for popup display',
    description:
      'Returns companies that have POPUP_PRIORITY_SLOT or POPUP_ROTATION_SLOT ads activated. ' +
      'If a company has POPUP_VIEW_DETAILS_LINK activated, ad_link_url is included. ' +
      'Companies with POPUP_RANKING_ADJUSTMENT are prioritized.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of companies eligible for popup display',
    type: CompanyWithAdsResponseDto,
    isArray: true,
  })
  async getPopupCompanies(): Promise<CompanyWithAdsResponseDto[]> {
    const companies: CompanyWithAdsResponseDto[] =
      await this.activeAdsService.getPopupCompanies();
    return companies;
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
