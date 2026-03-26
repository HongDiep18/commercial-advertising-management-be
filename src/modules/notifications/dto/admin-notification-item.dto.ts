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

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    example: {
      source: 'audit_log',
      defaultLocale: 'vi',
      locales: ['vi', 'en', 'zhTw'],
      translations: {
        title: {
          vi: 'Có đơn mua quảng cáo mới',
          en: 'New advertising order submitted',
          zhTw: '有新的廣告訂單',
        },
        content: {
          vi: 'Đơn #ab12cd34... vừa được gửi với 2 hạng mục, tổng giá trị 1500000.',
          en: 'Order #ab12cd34... was submitted with 2 items, subtotal 1500000.',
          zhTw: '訂單 #ab12cd34... 已提交，包含 2 個項目，小計 1500000。',
        },
      },
      orderId: 'ab12cd34-ef56-7890-ab12-cd34ef567890',
      subtotal: '1500000',
      itemCount: 2,
    },
  })
  metadata!: Record<string, unknown>;
}
