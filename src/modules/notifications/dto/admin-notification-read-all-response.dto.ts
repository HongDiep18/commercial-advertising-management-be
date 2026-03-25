import { ApiProperty } from '@nestjs/swagger';

export class AdminNotificationReadAllResponseDto {
  @ApiProperty({ example: 5 })
  updatedCount!: number;
}
