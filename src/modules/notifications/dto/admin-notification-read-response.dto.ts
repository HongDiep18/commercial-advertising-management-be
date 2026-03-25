import { ApiProperty } from '@nestjs/swagger';

export class AdminNotificationReadResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: true })
  isRead!: boolean;

  @ApiProperty({ nullable: true })
  readAt!: Date | null;
}
