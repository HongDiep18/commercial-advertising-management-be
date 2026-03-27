import { Module } from '@nestjs/common';
import { ActiveAdsModule } from '../active-ads/active-ads.module';
import { CompaniesModule } from '../companies/companies.module';
import { FileGeneratingModule } from '../file-generating/file-generating.module';
import { FileUploadModule } from '../file-upload/file-upload.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { AdOrdersAdminController } from './ad-orders-admin.controller';
import { AdOrdersController } from './ad-orders.controller';
import { AdOrdersService } from './ad-orders.service';

@Module({
  imports: [
    FileUploadModule,
    FileGeneratingModule,
    CompaniesModule,
    LoyaltyModule,
    ActiveAdsModule,
  ],
  controllers: [AdOrdersController, AdOrdersAdminController],
  providers: [AdOrdersService],
})
export class AdOrdersModule {}
