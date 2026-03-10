import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import {
  appConfig,
  databaseConfig,
  jwtConfig,
  mailConfig,
  newsConfig,
  storageConfig,
} from './config';
import { DatabaseModule } from './database/database.module';
import { MailModule } from './mail/mail.module';
import { ActiveAdsModule } from './modules/active-ads/active-ads.module';
import { AdOrdersModule } from './modules/ad-orders/ad-orders.module';
import { AdsModule } from './modules/ads/ads.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { FileUploadModule } from './modules/file-upload/file-upload.module';
import { HealthModule } from './modules/health/health.module';
import { NewsModule } from './modules/news/news.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        databaseConfig,
        jwtConfig,
        mailConfig,
        newsConfig,
        storageConfig,
      ],
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: parseInt(process.env.THROTTLE_TTL ?? '60000', 10),
        limit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),
      },
    ]),
    DatabaseModule,
    AuditModule,
    MailModule,
    AuthModule,
    HealthModule,
    NewsModule,
    AdsModule,
    AdOrdersModule,
    CompaniesModule,
    FileUploadModule,
    ActiveAdsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
