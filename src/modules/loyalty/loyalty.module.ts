import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { LoyaltyController } from './loyalty.controller';
import { LoyaltyService } from './loyalty.service';

@Module({
  imports: [DatabaseModule],
  controllers: [LoyaltyController],
  providers: [LoyaltyService],
  exports: [LoyaltyService], // Export for future use in auth/ad-orders modules
})
export class LoyaltyModule {}
