import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { CompaniesService } from './companies.service';
import {
  CompanyCategoriesResponseDto,
  CompanyDirectoryQueryDto,
  CompanyDirectoryResponseDto,
} from './dto/company-directory.dto';
import { CompanyDetailResponseDto } from './dto/company-detail.dto';
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
  @UseGuards(OptionalJwtAuthGuard)
  @Public()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get company directory with search and filters',
    description:
      'Returns a paginated list of companies with search and filter capabilities. Data is filtered and masked based on user membership tier. Only applies COMPANY_CATEGORY_TOP and COMPANY_INFO_HIGHLIGHT ad effects for directory browsing.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Paginated list of companies with directory effects applied and masked by tier',
    type: CompanyDirectoryResponseDto,
  })
  async getCompanyDirectory(
    @Query() query: CompanyDirectoryQueryDto,
    @Request() req: any,
  ): Promise<CompanyDirectoryResponseDto> {
    const user = req.user; // May be undefined for guests

    // Always provide masking context (guests get masked data with null tier)
    const maskingContext = user
      ? {
          userTier: user.membershipTier,
          userIndustries: [
            user.primaryIndustry,
            ...(user.selectedIndustries ?? []),
          ].filter(Boolean),
          userId: user.userId,
          userCompanyId: user.companyId,
          userRole: user.role,
        }
      : {
          userTier: null, // Guest user - will apply full masking
          userIndustries: [],
          userId: undefined,
          userCompanyId: undefined,
          userRole: undefined,
        };

    return this.companiesService.getCompanyDirectory(query, maskingContext);
  }

  @Get('categories')
  @UseGuards(OptionalJwtAuthGuard)
  @Public()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get company categories accessible to the current user',
    description:
      'Returns categories and counts based on user membership tier. ' +
      'Guests and Diamond members see all categories. ' +
      'Bronze/Silver see only their primary industry. ' +
      'Gold sees primary + selected industries.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of accessible company categories with counts',
    type: CompanyCategoriesResponseDto,
  })
  async getCompanyCategories(
    @Request() req: any,
  ): Promise<CompanyCategoriesResponseDto> {
    const user = req.user; // May be undefined for guests

    const maskingContext = user
      ? {
          userTier: user.membershipTier,
          userIndustries: [
            user.primaryIndustry,
            ...(user.selectedIndustries ?? []),
          ].filter(Boolean),
          userId: user.userId,
          userCompanyId: user.companyId,
          userRole: user.role,
        }
      : undefined;

    return this.companiesService.getCompanyCategories(maskingContext);
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
  @UseGuards(OptionalJwtAuthGuard)
  @Public()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get company detail',
    description:
      'Returns company detail with data masked based on user membership tier and industry access.',
  })
  @ApiResponse({
    status: 200,
    description: 'Company detail (masked based on tier)',
    type: CompanyDetailResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Company not found' })
  @ApiResponse({
    status: 403,
    description: "No access to this company's industry",
  })
  async getCompanyDetail(
    @Param('id') id: string,
    @Request() req: any,
  ): Promise<CompanyDetailResponseDto> {
    const user = req.user; // May be undefined for guests

    // Always provide masking context (guests get masked data with null tier)
    const maskingContext = user
      ? {
          userTier: user.membershipTier,
          userIndustries: [
            user.primaryIndustry,
            ...(user.selectedIndustries ?? []),
          ].filter(Boolean),
          userId: user.userId,
          userCompanyId: user.companyId,
          userRole: user.role,
        }
      : {
          userTier: null, // Guest user - will apply full masking
          userIndustries: [],
          userId: undefined,
          userCompanyId: undefined,
          userRole: undefined,
        };

    return this.companiesService.getCompanyDetail(id, maskingContext);
  }
}
