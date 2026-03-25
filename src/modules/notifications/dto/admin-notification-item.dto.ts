import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AdminNotificationItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty()
  eventType!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  content!: string;

  @ApiProperty()
  entityType!: string;

  @ApiProperty()
  entityId!: string;

  @ApiProperty({ default: false })
  isRead!: boolean;

  @ApiPropertyOptional({ nullable: true })
  readAt!: Date | null;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  metadata!: Record<string, unknown>;
}
