import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { FileUploadModule } from '../file-upload/file-upload.module';
import { PropertiesController } from './properties.controller';
import { PropertiesService } from './properties.service';

/**
 * Registers the property domain module.
 */
@Module({
  imports: [DatabaseModule, FileUploadModule],
  controllers: [PropertiesController],
  providers: [PropertiesService],
  exports: [PropertiesService],
})
export class PropertiesModule {}
