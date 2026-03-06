import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { CompaniesModule } from '../companies/companies.module';
import { ActiveAdsAdminController } from './active-ads-admin.controller';
import { ActiveAdsController } from './active-ads.controller';
import { ActiveAdsService } from './active-ads.service';

@Module({
  imports: [DatabaseModule, CompaniesModule],
  controllers: [ActiveAdsController, ActiveAdsAdminController],
  providers: [ActiveAdsService],
  exports: [ActiveAdsService],
})
export class ActiveAdsModule {}
