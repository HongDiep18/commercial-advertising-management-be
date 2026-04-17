import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { UserPayload } from '../../common/interfaces/user-payload.interface';
import { FileUploadService } from '../file-upload/file-upload.service';
import { ActiveAdsErrors } from './active-ads.errors';
import {
  ActiveAdsService,
  type TrackedAdSlotStatus,
} from './active-ads.service';
import type { ActiveAdDto } from './dto/active-ads.dto';
import {
  AdminAddActiveAdAssetsDto,
  AdminAddActiveAdAssetsResponseDto,
} from './dto/admin-add-active-ad-assets.dto';
import { TrackedAdSlotStatusResponseDto } from './dto/tracked-slot-status-response.dto';
import { AdminCreateCompanyPopupAddonDto } from './dto/admin-create-company-popup-addon.dto';
import {
  AdminManualActivateAdDto,
  AdminManualActiveAdResponseDto,
} from './dto/admin-manual-activate-ad.dto';
import { AdminReplaceActiveAdAssetsDto } from './dto/admin-replace-active-ad-assets.dto';
import { AdminUpdateActiveAdDto } from './dto/admin-update-active-ad.dto';

@ApiTags('Admin - Active Ads')
@ApiBearerAuth()
@Controller('admin/active-ads')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class ActiveAdsAdminController {
  constructor(
    private readonly activeAdsService: ActiveAdsService,
    private readonly fileUploadService: FileUploadService,
  ) {}

  @Get('slot-status')
  @ApiOperation({
    summary: 'Get tracked slot statuses',
    description:
      'Returns status summary for popup and featured slot package types, including active, expired, and waiting ads.',
  })
  @ApiResponse({
    status: 200,
    description: 'Tracked slot statuses retrieved successfully',
    type: TrackedAdSlotStatusResponseDto,
    isArray: true,
  })
  async getTrackedSlotStatuses(): Promise<TrackedAdSlotStatus[]> {
    return this.activeAdsService.getTrackedSlotStatuses();
  }

  @Post(':activeAdId/assets')
  @UseInterceptors(FilesInterceptor('files', 10))
  @ApiOperation({
    summary: 'Attach assets to an active ad',
    description:
      'Allows an admin to upload files and attach them to an active ad in a single request.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        assetTypes: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Asset type per uploaded file (e.g. popup_image, banner, logo). Must align with files index.',
        },
        notes: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Optional notes per uploaded file. Must align with files index if provided.',
        },
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'Files to upload and attach (max 10).',
        },
      },
      required: ['assetTypes', 'files'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Assets attached successfully',
    type: AdminAddActiveAdAssetsResponseDto,
  })
  async addAssetsToActiveAd(
    @Param('activeAdId') activeAdId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body('assetTypes') assetTypesRaw?: string[] | string,
    @Body('notes') notesRaw?: string[] | string,
  ): Promise<AdminAddActiveAdAssetsResponseDto> {
    const uploadedFiles: Express.Multer.File[] = files ?? [];
    if (uploadedFiles.length === 0) {
      throw new BadRequestException(
        ActiveAdsErrors.ACTIVE_AD_ASSETS_FILES_REQUIRED,
      );
    }

    const assetTypes: string[] = Array.isArray(assetTypesRaw)
      ? assetTypesRaw
      : assetTypesRaw
        ? [assetTypesRaw]
        : [];
    if (assetTypes.length !== uploadedFiles.length) {
      throw new BadRequestException(
        ActiveAdsErrors.ACTIVE_AD_ASSETS_ASSET_TYPES_LENGTH_MISMATCH,
      );
    }

    const notes: string[] = Array.isArray(notesRaw)
      ? notesRaw
      : notesRaw
        ? [notesRaw]
        : [];
    if (notes.length > 0 && notes.length !== uploadedFiles.length) {
      throw new BadRequestException(
        ActiveAdsErrors.ACTIVE_AD_ASSETS_NOTES_LENGTH_MISMATCH,
      );
    }

    const assets: AdminAddActiveAdAssetsDto['assets'] = [];
    for (let index = 0; index < uploadedFiles.length; index += 1) {
      const file = uploadedFiles[index];
      const uploaded = await this.fileUploadService.uploadFile(
        file,
        `active-ads/${activeAdId}`,
      );
      assets.push({
        assetType: assetTypes[index],
        fileUrl: uploaded.url,
        fileSizeKb: uploaded.sizeKb,
        notes: notes[index],
      });
    }

    return await this.activeAdsService.addAssetsToActiveAd({
      activeAdId,
      assets,
    });
  }

  @Delete('assets/:assetId')
  @ApiOperation({
    summary: 'Delete an active ad asset',
    description: 'Deletes a single asset record from an active ad.',
  })
  @ApiResponse({
    status: 200,
    description: 'Asset deleted successfully',
    schema: { type: 'object', properties: { message: { type: 'string' } } },
  })
  async deleteActiveAdAsset(
    @Param('assetId') assetId: string,
  ): Promise<{ message: string }> {
    const activeAdsService: {
      deleteActiveAdAsset: (inputAssetId: string) => Promise<void>;
    } = this.activeAdsService;
    await activeAdsService.deleteActiveAdAsset(assetId);
    return { message: 'Asset deleted successfully' };
  }

  @Post('manual')
  @ApiOperation({
    summary: 'Manually activate an ad for a company',
    description:
      'Allows an admin to manually create and activate an ad for a company without going through the order process.',
  })
  @ApiResponse({
    status: 201,
    description: 'Ad manually activated successfully',
    type: AdminManualActiveAdResponseDto,
  })
  async manuallyActivateAdForCompany(
    @CurrentUser() admin: UserPayload,
    @Body() dto: AdminManualActivateAdDto,
  ): Promise<AdminManualActiveAdResponseDto> {
    const startDate: Date = dto.startDate
      ? new Date(dto.startDate)
      : new Date();

    return this.activeAdsService.manuallyActivateAdForCompany({
      companyId: dto.companyId,
      pricingId: dto.pricingId,
      adminUserId: admin.userId,
      startDate,
      adLinkUrl: dto.adLinkUrl,
    });
  }

  @Post('company/popup-addon')
  @ApiOperation({
    summary: 'Create popup add-on active ad for a company',
    description:
      'Creates a ranking adjustment or view-details link active ad without an order. Assets are optional.',
  })
  @ApiResponse({
    status: 201,
    description: 'Active ad created',
    type: AdminManualActiveAdResponseDto,
  })
  async createCompanyPopupAddon(
    @CurrentUser() admin: UserPayload,
    @Body() dto: AdminCreateCompanyPopupAddonDto,
  ): Promise<AdminManualActiveAdResponseDto> {
    const startDate = new Date(dto.startDate);
    const endDate =
      dto.endDate !== undefined && dto.endDate !== null && dto.endDate !== ''
        ? new Date(dto.endDate)
        : null;
    return this.activeAdsService.createCompanyPopupAddonActiveAd({
      companyId: dto.companyId,
      packageType: dto.packageType,
      startDate,
      endDate,
      adLinkUrl: dto.adLinkUrl,
      adminUserId: admin.userId,
    });
  }

  @Patch(':activeAdId')
  @ApiOperation({
    summary: 'Update an active ad',
    description:
      'Update isActive, startDate, endDate, or adLinkUrl of an active ad.',
  })
  @ApiResponse({ status: 200, description: 'Active ad updated successfully' })
  async updateActiveAd(
    @Param('activeAdId') activeAdId: string,
    @Body() dto: AdminUpdateActiveAdDto,
    @CurrentUser() admin: UserPayload,
  ): Promise<void> {
    await this.activeAdsService.updateActiveAd(activeAdId, dto, admin.userId);
  }

  @Delete(':activeAdId')
  @ApiOperation({
    summary: 'Delete an active ad',
    description: 'Hard deletes an active ad and all of its assets.',
  })
  @ApiResponse({ status: 200, description: 'Active ad deleted successfully' })
  async deleteActiveAd(
    @Param('activeAdId') activeAdId: string,
    @CurrentUser() admin: UserPayload,
  ): Promise<{ message: string }> {
    await this.activeAdsService.deleteActiveAd(activeAdId, admin.userId);
    return { message: 'Active ad deleted successfully' };
  }

  @Put(':activeAdId/assets')
  @ApiOperation({
    summary: 'Replace all assets of an active ad',
    description:
      'Deletes all existing assets for the active ad and replaces them with the provided list.',
  })
  @ApiResponse({ status: 200, description: 'Assets replaced successfully' })
  async replaceActiveAdAssets(
    @Param('activeAdId') activeAdId: string,
    @Body() dto: AdminReplaceActiveAdAssetsDto,
  ): Promise<{ replacedCount: number }> {
    const activeAdsService: {
      replaceActiveAdAssets: (
        id: string,
        assets: AdminReplaceActiveAdAssetsDto['assets'],
      ) => Promise<{ replacedCount: number }>;
    } = this.activeAdsService;
    return await activeAdsService.replaceActiveAdAssets(activeAdId, dto.assets);
  }

  @Get('company/:companyId')
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
  ): Promise<ActiveAdDto> {
    return this.activeAdsService.getCompanyActiveAds(companyId);
  }
}
