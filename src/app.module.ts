import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import {
  appConfig,
  chatbotConfig,
  databaseConfig,
  jwtConfig,
  mailConfig,
  newsConfig,
  storageConfig,
} from './config';
import { DatabaseModule } from './database/database.module';
import { MailModule } from './modules/mail/mail.module';
import { ActiveAdsModule } from './modules/active-ads/active-ads.module';
import { AdOrdersModule } from './modules/ad-orders/ad-orders.module';
import { AdsModule } from './modules/ads/ads.module';
import { ChatbotModule } from './modules/chatbot/chatbot.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { FileUploadModule } from './modules/file-upload/file-upload.module';
import { HealthModule } from './modules/health/health.module';
import { LoyaltyModule } from './modules/loyalty/loyalty.module';
import { NewsModule } from './modules/news/news.module';
import { PropertiesModule } from './modules/properties/properties.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        chatbotConfig,
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
    LoyaltyModule,
    NewsModule,
    ChatbotModule,
    PropertiesModule,
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
