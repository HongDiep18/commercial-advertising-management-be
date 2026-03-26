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
  Param,
  Patch,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  UpdateProfileDto,
  UPDATE_PROFILE_FORM_KEYS,
} from '../auth/dto/update-profile.dto';
import { FileUploadService } from '../file-upload/file-upload.service';
import { CompaniesService } from './companies.service';
import { AdminCompanyStatsResponseDto } from './dto/admin-company-stats.dto';

const ADMIN_UPDATE_COMPANY_SCHEMA = {
  type: 'object',
  properties: {
    logo_url: {
      type: 'string',
      format: 'binary',
      description: 'Logo image file (optional)',
    },
    ...Object.fromEntries(
      UPDATE_PROFILE_FORM_KEYS.map((k) => [k, { type: 'string' }]),
    ),
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
  ) {}

  @Get('stats')
  @ApiOperation({
    summary: 'Get approved company stats (admin)',
    description: 'Returns total company profile requests with status APPROVED.',
  })
  @ApiResponse({
    status: 200,
    description: 'Approved company count',
    type: AdminCompanyStatsResponseDto,
  })
  async getApprovedCompanyStats(): Promise<AdminCompanyStatsResponseDto> {
    return this.companiesService.getAdminApprovedCompanyStats();
  }

  @Patch(':companyId')
  @UseInterceptors(FileInterceptor('logo_url'))
  @ApiOperation({
    summary: 'Update a company (admin)',
    description:
      'Same fields as PATCH /auth/update-profile. Target company by id; ' +
      'requires a user linked to that company. Records audit log company.updated_by_admin.',
  })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: ADMIN_UPDATE_COMPANY_SCHEMA })
  @ApiResponse({ status: 200, description: 'Company profile updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Company or linked user not found' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  async updateCompany(
    @Param('companyId') companyId: string,
    @Body() dto: UpdateProfileDto,
    @UploadedFile() logoFile: Express.Multer.File,
    @CurrentUser('userId') adminUserId: string,
  ) {
    const body = { ...dto };
    if (logoFile) {
      const { url } = await this.fileUploadService.uploadFile(
        logoFile,
        'company-logos',
      );
      body.upload_logo = url;
    }
    return await this.companiesService.adminUpdateCompany(
      adminUserId,
      companyId,
      body,
    );
  }
}
