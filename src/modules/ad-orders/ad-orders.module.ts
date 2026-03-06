import { Module } from '@nestjs/common';
import { FileUploadModule } from '../file-upload/file-upload.module';
import { CompaniesModule } from '../companies/companies.module';
import { AdOrdersAdminController } from './ad-orders-admin.controller';
import { AdOrdersController } from './ad-orders.controller';
import { AdOrdersService } from './ad-orders.service';

@Module({
  imports: [FileUploadModule, CompaniesModule],
  controllers: [AdOrdersController, AdOrdersAdminController],
  providers: [AdOrdersService],
})
export class AdOrdersModule {}
