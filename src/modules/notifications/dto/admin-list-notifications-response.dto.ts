import { ApiProperty } from '@nestjs/swagger';
import { AdminNotificationItemDto } from './admin-notification-item.dto';

export class AdminListNotificationsResponseDto {
  @ApiProperty({ type: [AdminNotificationItemDto] })
  notifications!: AdminNotificationItemDto[];

  @ApiProperty({
    example: { page: 1, limit: 20, total: 150, totalPages: 8 },
  })
  pagination!: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
