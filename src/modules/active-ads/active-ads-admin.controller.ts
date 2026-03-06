import {
  Body,
  Controller,
  Delete,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { UserPayload } from '../../common/interfaces/user-payload.interface';
import { ActiveAdsService } from './active-ads.service';
import {
  AdminAddActiveAdAssetsDto,
  AdminAddActiveAdAssetsResponseDto,
} from './dto/admin-add-active-ad-assets.dto';
import {
  AdminManualActivateAdDto,
  AdminManualActiveAdResponseDto,
} from './dto/admin-manual-activate-ad.dto';

@ApiTags('Admin - Active Ads')
@ApiBearerAuth()
@Controller('admin/active-ads')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class ActiveAdsAdminController {
  constructor(private readonly activeAdsService: ActiveAdsService) {}

  @Post(':activeAdId/assets')
  @ApiOperation({
    summary: 'Attach assets to an active ad',
    description:
      'Allows an admin to attach assets to an active ad. Upload files first using /files/upload, then attach the returned URLs here.',
  })
  @ApiResponse({
    status: 201,
    description: 'Assets attached successfully',
    type: AdminAddActiveAdAssetsResponseDto,
  })
  async addAssetsToActiveAd(
    @Param('activeAdId') activeAdId: string,
    @Body() dto: AdminAddActiveAdAssetsDto,
  ): Promise<AdminAddActiveAdAssetsResponseDto> {
    const activeAdsService: {
      addAssetsToActiveAd: (input: {
        activeAdId: string;
        assets: AdminAddActiveAdAssetsDto['assets'];
      }) => Promise<AdminAddActiveAdAssetsResponseDto>;
    } = this.activeAdsService;
    return await activeAdsService.addAssetsToActiveAd({
      activeAdId,
      assets: dto.assets,
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
}
