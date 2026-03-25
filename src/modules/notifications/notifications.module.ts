import { Module } from '@nestjs/common';
import { AdminNotificationsController } from './admin-notifications.controller';
import { NotificationsProjectorService } from './notifications-projector.service';
import { NotificationsService } from './notifications.service';

@Module({
  controllers: [AdminNotificationsController],
  providers: [NotificationsService, NotificationsProjectorService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
