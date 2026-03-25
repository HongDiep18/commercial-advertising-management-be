import { ApiProperty } from '@nestjs/swagger';

export class AdminNotificationUnreadCountDto {
  @ApiProperty({ example: 3 })
  unreadCount!: number;
}
