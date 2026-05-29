import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthService } from '../auth/auth.service';
import { FileUploadService } from '../file-upload/file-upload.service';
import { CompaniesService } from './companies.service';
import {
  AdminAssignCompanyUserDto,
  AdminAssignCompanyUserResponseDto,
} from './dto/admin-assign-company-user.dto';
import {
  AdminCreateCompanyDto,
  AdminCreateCompanyResponseDto,
} from './dto/admin-create-company.dto';
import { AdminCompanyDetailResponseDto } from './dto/admin-company-detail.dto';
import { AdminUpdateCompanyDto } from './dto/admin-update-company.dto';
import { AddCompanyContactsDto } from './dto/add-company-contacts.dto';
import { AddCompanyContactsResponseDto } from './dto/add-company-contacts-response.dto';
import { AdminCompanyStatsResponseDto } from './dto/admin-company-stats.dto';
import { CompanyContactTypesResponseDto } from './dto/company-contact-types-response.dto';
import { AdminArchiveCompanyResponseDto } from './dto/admin-archive-company-response.dto';
import { AdminUpdateCompanyActiveDto } from './dto/admin-update-company-active.dto';
import { AdminCompanyActiveResponseDto } from './dto/admin-company-active-response.dto';
import {
  AdminListCompaniesQueryDto,
  AdminListCompaniesResponseDto,
} from './dto/admin-list-companies.dto';
import { AdminExportCompaniesQueryDto } from './dto/admin-export-companies.dto';
import { AdminListUnlinkedCompaniesResponseDto } from './dto/admin-list-unlinked-companies.dto';

const ADMIN_UPDATE_COMPANY_SCHEMA = {
  type: 'object',
  properties: {
    logo_url: {
      type: 'string',
      format: 'binary',
      description: 'Logo image file (optional)',
    },
    logoUrl: {
      type: 'string',
      description: 'Logo URL override when not uploading a file',
    },
    companyNameVi: { type: 'string' },
    companyNameEn: { type: 'string' },
    companyNameZh: { type: 'string' },
    taxId: { type: 'string' },
    country: { type: 'string' },
    region: { type: 'string' },
    industry: {
      oneOf: [
        {
          type: 'array',
          items: { type: 'string' },
        },
        {
          type: 'string',
          description:
            'JSON-stringified array or comma-separated string when sent as multipart/form-data',
        },
      ],
    },
    description: { type: 'string' },
    note: {
      type: 'string',
      nullable: true,
      description:
        'Free-form note (stored as company_contact type `note`). Empty or null clears the note.',
      maxLength: 4000,
    },
    contacts: {
      oneOf: [
        {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              value: { type: 'string' },
              contactName: { type: 'string', nullable: true },
            },
            required: ['type', 'value'],
          },
        },
        {
          type: 'string',
          description:
            'JSON-stringified contact array when sent as multipart/form-data',
        },
      ],
    },
  },
};

@ApiTags('Admin - Companies')
@ApiBearerAuth()
@Controller('admin/companies')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class AdminCompaniesController {
  constructor(
    private readonly companiesService: CompaniesService,
    private readonly fileUploadService: FileUploadService,
    private readonly authService: AuthService,
  ) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Create a new company with a linked member account (admin)',
    description:
      'Creates a company record (status APPROVED, isActive true) and a linked MEMBER user account in one transaction. ' +
      'Sends a set-password email immediately — no approval step required.',
  })
  @ApiBody({ type: AdminCreateCompanyDto })
  @ApiResponse({
    status: 201,
    description: 'Company and member account created; set-password email sent',
    type: AdminCreateCompanyResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({
    status: 409,
    description:
      'register_email already in use or already registered to a company',
  })
  async createCompany(
    @Body() dto: AdminCreateCompanyDto,
    @CurrentUser('userId') actorId: string,
  ): Promise<AdminCreateCompanyResponseDto> {
    return this.authService.adminCreateCompany(actorId, dto);
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Get active company count (admin)',
    description:
      'Returns how many companies have `is_active = true` on the `companies` table.',
  })
  @ApiResponse({
    status: 200,
    description: '`activeCount`: companies with `is_active = true`',
    type: AdminCompanyStatsResponseDto,
  })
  async getCompanyStats(): Promise<AdminCompanyStatsResponseDto> {
    return this.companiesService.getAdminCompanyStats();
  }

  @Get()
  @ApiOperation({
    summary: 'Search and list companies (admin)',
    description:
      'Optional `search` across company names (VI/EN/ZH), tax id, industry tags, and email/phone/tel/contact_person values. ' +
      'Supports optional registration `status` and company `isActive` filters.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated company search results',
    type: AdminListCompaniesResponseDto,
  })
  async listCompanies(
    @Query() query: AdminListCompaniesQueryDto,
  ): Promise<AdminListCompaniesResponseDto> {
    return this.companiesService.adminListCompanies(query);
  }

  @Get('export')
  @ApiOperation({
    summary: 'Export companies to Excel or CSV (admin)',
    description:
      'Downloads a file. Requires `type` (`excel` or `csv`) and `locale` (`vi`, `en`, or `zh`). ' +
      'Column headers and name column order follow `locale`. ' +
      'Optional `search`, `status`, and `isActive` match the admin company list filters.',
  })
  @ApiResponse({
    status: 200,
    description: 'Companies Excel export',
    content: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
        schema: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Companies CSV export',
    content: {
      'text/csv': {
        schema: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid query or export too large',
  })
  async exportCompanies(
    @Query() query: AdminExportCompaniesQueryDto,
  ): Promise<StreamableFile> {
    const { buffer, filename, mimeType } =
      await this.companiesService.exportAdminCompanies(query);
    return new StreamableFile(buffer, {
      type: mimeType,
      disposition: `attachment; filename="${filename}"`,
    });
  }

  @Get('contact-types')
  @ApiOperation({
    summary: 'Get all company contact types',
    description: 'Returns distinct `type` values from company_contacts table.',
  })
  @ApiResponse({
    status: 200,
    description: 'Distinct company contact types',
    type: CompanyContactTypesResponseDto,
  })
  async getCompanyContactTypes(): Promise<CompanyContactTypesResponseDto> {
    return this.companiesService.getCompanyContactTypes();
  }

  @Get('no-user')
  @ApiOperation({
    summary: 'List companies with no linked user account (admin)',
    description:
      'Returns approved companies that have never had a linked user account ' +
      '(excludes PENDING/REJECTED/DELETED and companies with any user history), ' +
      'including full company_contacts rows for each company.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of unlinked companies with contacts',
    type: AdminListUnlinkedCompaniesResponseDto,
  })
  async listUnlinkedCompanies(): Promise<AdminListUnlinkedCompaniesResponseDto> {
    return this.companiesService.adminListUnlinkedCompanies();
  }

  @Get(':companyId')
  @ApiOperation({
    summary: 'Get company detail for admin management',
    description:
      'Returns scalar company fields, raw company_contacts rows, and linked member account summary for admin management screens.',
  })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiResponse({
    status: 200,
    description: 'Company detail for admin management',
    type: AdminCompanyDetailResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Company not found' })
  async getCompanyDetailForAdmin(
    @Param('companyId') companyId: string,
  ): Promise<AdminCompanyDetailResponseDto> {
    return this.companiesService.getAdminCompanyDetail(companyId);
  }

  @Patch(':companyId')
  @UseInterceptors(FileInterceptor('logo_url'))
  @ApiOperation({
    summary: 'Update a company (admin)',
    description:
      'Updates scalar company fields, optional `note` (company_contact type `note`), ' +
      'and optionally replaces all company_contacts rows. ' +
      'Supports JSON requests and multipart/form-data requests with optional `logo_url` upload.',
  })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiConsumes('application/json', 'multipart/form-data')
  @ApiBody({ schema: ADMIN_UPDATE_COMPANY_SCHEMA })
  @ApiResponse({
    status: 200,
    description: 'Company profile updated',
    type: AdminCompanyDetailResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  async updateCompany(
    @Param('companyId') companyId: string,
    @Body() dto: AdminUpdateCompanyDto,
    @UploadedFile() logoFile: Express.Multer.File,
    @CurrentUser('userId') adminUserId: string,
  ): Promise<AdminCompanyDetailResponseDto> {
    const body: AdminUpdateCompanyDto = { ...dto };
    if (logoFile) {
      const { url } = await this.fileUploadService.uploadFile(
        logoFile,
        'company-logos',
      );
      body.logoUrl = url;
    }
    return this.companiesService.adminUpdateCompany(
      adminUserId,
      companyId,
      body,
    );
  }

  @Patch(':companyId/archive')
  @ApiOperation({
    summary: 'Archive an unlinked company (admin)',
    description:
      'Marks a company as REJECTED for admin cleanup flows. Intended for company rows without a linked non-deleted user account.',
  })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiResponse({
    status: 200,
    description: 'Company archived',
    type: AdminArchiveCompanyResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Company still has a linked user account; use the user deletion/disable flow instead',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  async archiveCompany(
    @Param('companyId') companyId: string,
    @CurrentUser('userId') adminUserId: string,
  ): Promise<AdminArchiveCompanyResponseDto> {
    return this.companiesService.archiveCompanyWithoutLinkedUser(
      adminUserId,
      companyId,
    );
  }

  @Patch(':companyId/active')
  @ApiOperation({
    summary: 'Enable or disable an unlinked company (admin)',
    description:
      'Sets company isActive for company rows without a linked non-deleted user account. If a linked user exists, use the user active toggle flow instead.',
  })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiBody({ type: AdminUpdateCompanyActiveDto })
  @ApiResponse({
    status: 200,
    description: 'Company active status updated',
    type: AdminCompanyActiveResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Company still has a linked user account; use the user active toggle flow instead',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  async setCompanyActive(
    @Param('companyId') companyId: string,
    @Body() dto: AdminUpdateCompanyActiveDto,
    @CurrentUser('userId') adminUserId: string,
  ): Promise<AdminCompanyActiveResponseDto> {
    return this.companiesService.setCompanyActive(
      adminUserId,
      companyId,
      dto.isActive,
    );
  }

  @Post(':companyId/assign-user')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Assign a member user to an unlinked company (admin)',
    description:
      'Creates a new MEMBER account or links an existing unlinked account to the company. ' +
      'Company must be APPROVED and have no existing linked user. ' +
      'Sends a set-password email so the user activates their own password.',
  })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiBody({ type: AdminAssignCompanyUserDto })
  @ApiResponse({
    status: 201,
    description: 'User created or linked; set-password email sent',
    type: AdminAssignCompanyUserResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Company not approved' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  @ApiResponse({
    status: 409,
    description:
      'Company already has a user, or email belongs to another company',
  })
  async assignCompanyUser(
    @Param('companyId') companyId: string,
    @Body() dto: AdminAssignCompanyUserDto,
    @CurrentUser('userId') actorId: string,
  ): Promise<AdminAssignCompanyUserResponseDto> {
    return this.authService.adminAssignCompanyUser(actorId, companyId, dto);
  }

  @Post(':companyId/contacts')
  @ApiOperation({
    summary: 'Add company contacts (append)',
    description:
      'Creates additional `company_contacts` rows for emails and contact phones. ' +
      'Optional `contactName` is stored on each new row (DB column `contact_name`). ' +
      'Does not replace existing profile fields from PATCH; appends new rows only. ' +
      'Duplicate values for the same company and contact type are skipped.',
  })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiResponse({
    status: 201,
    description: 'Contacts processed; see added vs skippedDuplicates',
    type: AddCompanyContactsResponseDto,
  })
  @ApiResponse({ status: 400, description: 'No valid contact values in body' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  async addCompanyContacts(
    @Param('companyId') companyId: string,
    @Body() dto: AddCompanyContactsDto,
    @CurrentUser('userId') adminUserId: string,
  ): Promise<AddCompanyContactsResponseDto> {
    return this.companiesService.addCompanyContacts(
      adminUserId,
      companyId,
      dto,
    );
  }
}
