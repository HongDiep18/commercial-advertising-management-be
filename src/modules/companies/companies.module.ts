import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AdEffectsModule } from '../ad-effects/ad-effects.module';
import { FileUploadModule } from '../file-upload/file-upload.module';
import { AdminCompaniesController } from './admin-companies.controller';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { CompanyMaskingService } from './company-masking.service';

@Module({
  imports: [AdEffectsModule, DatabaseModule, FileUploadModule],
  controllers: [CompaniesController, AdminCompaniesController],
  providers: [CompaniesService, CompanyMaskingService],
  exports: [CompaniesService, CompanyMaskingService],
})
export class CompaniesModule { }
