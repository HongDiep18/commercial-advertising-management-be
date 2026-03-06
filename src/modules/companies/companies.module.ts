import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AdEffectsModule } from '../ad-effects/ad-effects.module';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';

@Module({
  imports: [AdEffectsModule, DatabaseModule],
  controllers: [CompaniesController],
  providers: [CompaniesService],
  exports: [CompaniesService],
})
export class CompaniesModule {}
