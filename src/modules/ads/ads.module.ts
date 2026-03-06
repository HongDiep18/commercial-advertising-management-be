import { Module } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CompaniesModule } from '../companies/companies.module';
import { AdPackageCategoryController } from './ad-package-category.controller';
import { AdPackagePricingAdminController } from './ad-package-pricing-admin.controller';
import { AdPackagePricingService } from './ad-package-pricing.service';
import { AdsController } from './ads.controller';
import { AdsService } from './ads.service';

@Module({
  imports: [CompaniesModule],
  controllers: [
    AdPackageCategoryController,
    AdPackagePricingAdminController,
    AdsController,
  ],
  providers: [AdsService, AdPackagePricingService, PrismaService],
  exports: [AdsService, AdPackagePricingService],
})
export class AdsModule {}
