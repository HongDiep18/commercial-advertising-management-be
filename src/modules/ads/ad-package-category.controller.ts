import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AdPackageCategory } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { AdsService } from './ads.service';
import { AdminCreateAdPackageCategoryDto } from './dto/admin-create-ad-package-category.dto';
import { AdminUpdateAdPackageCategoryDto } from './dto/admin-update-ad-package-category.dto';

@ApiTags('Admin Ads')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@Controller('admin')
export class AdPackageCategoryController {
  constructor(private readonly adsService: AdsService) {}

  @Get('ad-package-categories')
  async listCategories(): Promise<AdPackageCategory[]> {
    return this.adsService.listAdminCategories();
  }

  @Patch('ad-package-categories/:id')
  async updateCategory(
    @Param('id') id: string,
    @Body() body: AdminUpdateAdPackageCategoryDto,
  ): Promise<AdPackageCategory> {
    return this.adsService.updateAdminCategory(id, body);
  }

  @Post('ad-package-categories')
  async createCategory(
    @Body() body: AdminCreateAdPackageCategoryDto,
  ): Promise<AdPackageCategory> {
    return this.adsService.createAdminCategory(body);
  }

  @Post('ad-package-categories/:id/deactivate')
  async deactivateCategory(
    @Param('id') id: string,
  ): Promise<{ id: string; isActive: boolean }> {
    return this.adsService.deactivateAdminCategory(id);
  }
}
