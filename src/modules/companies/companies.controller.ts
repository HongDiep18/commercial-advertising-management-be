import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CompaniesService } from './companies.service';
import {
  CompanyCategoriesResponseDto,
  CompanyDirectoryQueryDto,
  CompanyDirectoryResponseDto,
} from './dto/company-directory.dto';
import { CompanyDetailResponseDto } from './dto/company-detail.dto';
import { CompanyWithAdsResponseDto } from './dto/company-with-ads-response.dto';
import { CreateCompanyDto } from './dto/create-company.dto';
import { CompanyDirectoryStatsResponseDto } from './dto/company-stats.dto';

@ApiTags('Companies')
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new company',
  })
  @ApiBody({ type: CreateCompanyDto })
  @ApiResponse({
    status: 201,
    description: 'Company created successfully',
    type: CompanyWithAdsResponseDto,
  })
  @ApiBearerAuth()
  async createCompany(
    @Body() dto: CreateCompanyDto,
    @CurrentUser('userId') userId: string,
  ): Promise<CompanyWithAdsResponseDto> {
    const company = await this.companiesService.createCompany(dto, userId);
    const name =
      company.companyNameVi ?? company.companyNameCn ?? company.email;
    return {
      id: company.id,
      name,
      logoUrl: company.logoUrl ?? null,
      email: company.email,
      contactName: company.contactName ?? '',
      phone: company.phone,
      industry: company.industry,
      address: company.address,
      description: company.description,
      featuredHighlight: false,
      companyInfoHighlight: false,
      sortPriority: 0,
    };
  }

  @Get()
  @Public()
  @ApiOperation({
    summary: 'Get company directory with search and filters',
    description:
      'Returns a paginated list of companies with search and filter capabilities. Only applies COMPANY_CATEGORY_TOP and COMPANY_INFO_HIGHLIGHT ad effects for directory browsing.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of companies with directory effects applied',
    type: CompanyDirectoryResponseDto,
  })
  async getCompanyDirectory(
    @Query() query: CompanyDirectoryQueryDto,
  ): Promise<CompanyDirectoryResponseDto> {
    return this.companiesService.getCompanyDirectory(query);
  }

  @Get('categories')
  @Public()
  @ApiOperation({
    summary: 'Get all company categories with counts',
    description:
      'Returns directory categories and the number of companies in each category.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of company categories with counts',
    type: CompanyCategoriesResponseDto,
  })
  async getCompanyCategories(): Promise<CompanyCategoriesResponseDto> {
    const result = await this.companiesService.getCompanyCategories();
    return result;
  }

  @Get('stats')
  @Public()
  @ApiOperation({
    summary: 'Company directory stats',
    description:
      'Returns total companies in the database and how many qualify for the public directory ' +
      '(approved profile request, matching company email, at least one active non-deleted user).',
  })
  @ApiResponse({
    status: 200,
    description: 'Total and directory-visible company counts',
    type: CompanyDirectoryStatsResponseDto,
  })
  getCompanyDirectoryStats(): Promise<CompanyDirectoryStatsResponseDto> {
    return this.companiesService.getCompanyDirectoryStats();
  }

  @Get('featured')
  @Public()
  @ApiOperation({
    summary: 'Get all companies with featured effects',
    description:
      'Returns all companies. Companies with FEATURED_HOMEPAGE_DISPLAY ads are moved to the top. Companies with FEATURED_HIGHLIGHT_BOOST ads have featuredHighlight=true. Companies with COMPANY_INFO_HIGHLIGHT ads have companyInfoHighlight=true.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of companies with featured effects applied',
    type: CompanyWithAdsResponseDto,
    isArray: true,
  })
  async getFeaturedCompanies(): Promise<CompanyWithAdsResponseDto[]> {
    return this.companiesService.getFeaturedCompanies();
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get company detail' })
  @ApiResponse({
    status: 200,
    description: 'Company detail',
    type: CompanyDetailResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Company not found' })
  async getCompanyDetail(
    @Param('id') id: string,
  ): Promise<CompanyDetailResponseDto> {
    return this.companiesService.getCompanyDetail(id);
  }
}
