import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { appConfig, databaseConfig, jwtConfig, newsConfig } from './config';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './modules/health/health.module';
import { NewsModule } from './modules/news/news.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, jwtConfig, newsConfig],
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: parseInt(process.env.THROTTLE_TTL ?? '60000', 10),
        limit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),
      },
    ]),
    DatabaseModule,
    HealthModule,
    NewsModule,
  ],
})
export class AppModule {}
