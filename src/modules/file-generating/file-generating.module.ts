import { Module } from '@nestjs/common';
import { FileGeneratingService } from './file-generating.service';

@Module({
  providers: [FileGeneratingService],
  exports: [FileGeneratingService],
})
export class FileGeneratingModule {}
