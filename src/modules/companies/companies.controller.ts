import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { CompaniesService } from './companies.service';
import {
  CompanyCategoriesResponseDto,
  CompanyDirectoryQueryDto,
  CompanyDirectoryResponseDto,
} from './dto/company-directory.dto';
import { CompanyWithAdsResponseDto } from './dto/company-with-ads-response.dto';
import { CreateCompanyDto } from './dto/create-company.dto';

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
  ): Promise<CompanyWithAdsResponseDto> {
    const company = await this.companiesService.createCompany(dto);
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
}
