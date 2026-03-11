import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FileGeneratingModule } from '../file-generating/file-generating.module';
import { MailService } from './mail.service';

@Global()
@Module({
  imports: [ConfigModule, FileGeneratingModule],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
