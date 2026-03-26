import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AUDIT_ACTION } from '../audit/audit.constants';
import { AUDIT_LOG_RECORDED_EVENT_NAME } from '../audit/audit-log-recorded-event-name.constant';
import type { AuditLogRecordedEvent } from '../audit/audit-log-recorded.event';
import { NOTIFICATIONS_CONFIG } from './notifications.constants';

type ProjectableAuditLog = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: string | null;
  newValue: string | null;
};

type NotificationBuildResult = {
  title: string;
  content: string;
  metadata: Prisma.InputJsonValue;
};

type NotificationLocale = 'vi' | 'en' | 'zhTw';

type NotificationLocalizedText = Record<NotificationLocale, string>;

type CreateNotificationBuildResultInput = {
  titleTranslations: NotificationLocalizedText;
  contentTranslations: NotificationLocalizedText;
  metadata: Prisma.InputJsonObject;
};

const NOTIFICATION_DEFAULT_LOCALE: NotificationLocale = 'vi';

const NOTIFICATION_SUPPORTED_LOCALES: readonly NotificationLocale[] = [
  'vi',
  'en',
  'zhTw',
];

@Injectable()
export class NotificationsProjectorService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsProjectorService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.projectPendingAuditLogsToNotifications();
  }

  @OnEvent(AUDIT_LOG_RECORDED_EVENT_NAME, { async: true })
  async handleAuditLogRecorded(
    auditLogRecordedEvent: AuditLogRecordedEvent,
  ): Promise<void> {
    if (!this.isSupportedAuditAction(auditLogRecordedEvent.action)) {
      return;
    }
    await this.createNotificationFromAuditLog(auditLogRecordedEvent);
  }

  async projectPendingAuditLogsToNotifications(): Promise<void> {
    let hasMoreAuditLogs = true;
    while (hasMoreAuditLogs) {
      const auditLogs = await this.findUnprojectedSupportedAuditLogs();
      for (const auditLog of auditLogs) {
        await this.createNotificationFromAuditLog(auditLog);
      }
      hasMoreAuditLogs =
        auditLogs.length === NOTIFICATIONS_CONFIG.projectorBatchSize;
    }
  }

  private async findUnprojectedSupportedAuditLogs(): Promise<
    ProjectableAuditLog[]
  > {
    return this.prisma.auditLog.findMany({
      where: {
        action: {
          in: [...NOTIFICATIONS_CONFIG.supportedAuditActions],
        },
        notification: {
          is: null,
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: NOTIFICATIONS_CONFIG.projectorBatchSize,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        metadata: true,
        newValue: true,
      },
    });
  }

  private isSupportedAuditAction(action: string): boolean {
    const supportedActions: readonly string[] = [
      ...NOTIFICATIONS_CONFIG.supportedAuditActions,
    ];
    return supportedActions.includes(action);
  }

  private async createNotificationFromAuditLog(
    auditLog: ProjectableAuditLog,
  ): Promise<void> {
    const payload = this.buildNotificationPayload(auditLog);
    try {
      await this.prisma.notification.create({
        data: {
          auditLogId: auditLog.id,
          eventType: auditLog.action,
          title: payload.title,
          content: payload.content,
          entityType: auditLog.entityType,
          entityId: auditLog.entityId,
          metadata: payload.metadata,
        },
      });
    } catch (err: unknown) {
      if (this.isUniqueConstraintError(err)) {
        return;
      }
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `project notification failed for audit ${auditLog.id}: ${errorMessage}`,
      );
    }
  }

  private buildNotificationPayload(
    auditLog: ProjectableAuditLog,
  ): NotificationBuildResult {
    if (auditLog.action === AUDIT_ACTION.PROPERTY_CONTACT_INQUIRY_CREATED) {
      return this.buildPropertyInquiryNotification(auditLog);
    }
    if (auditLog.action === AUDIT_ACTION.AD_ORDER_CREATED) {
      return this.buildAdOrderCreatedNotification(auditLog);
    }
    return this.createNotificationBuildResult({
      titleTranslations: {
        vi: 'Có thông báo mới',
        en: 'You have a new notification',
        zhTw: '您有一則新通知',
      },
      contentTranslations: {
        vi: `Có hoạt động mới cho ${auditLog.entityType}.`,
        en: `There is new activity for ${auditLog.entityType}.`,
        zhTw: `${auditLog.entityType} 有新的活動。`,
      },
      metadata: {
        eventType: auditLog.action,
      },
    });
  }

  private buildPropertyInquiryNotification(
    auditLog: ProjectableAuditLog,
  ): NotificationBuildResult {
    const parsedMetadata = this.parseJsonObject(auditLog.metadata);
    const parsedNewValue = this.parseJsonObject(auditLog.newValue);
    const inquiryData = this.extractObject(parsedNewValue, 'contactInquiry');
    const shortPropertyId = auditLog.entityId.slice(0, 8);
    const propertyTitleFromMetadata = this.readString(parsedMetadata, [
      'propertyTitle',
    ]);
    const propertyTitleByLocale: NotificationLocalizedText = {
      vi: propertyTitleFromMetadata ?? `BĐS ${shortPropertyId}...`,
      en: propertyTitleFromMetadata ?? `Property ${shortPropertyId}...`,
      zhTw: propertyTitleFromMetadata ?? `房產 ${shortPropertyId}...`,
    };
    const inquiryNameFromData = this.readString(inquiryData, ['name']);
    const inquiryEmailFromData =
      this.readString(inquiryData, ['email']) ??
      this.readString(parsedMetadata, ['email']);
    const inquiryNameByLocale: NotificationLocalizedText = {
      vi: inquiryNameFromData ?? 'Khách hàng',
      en: inquiryNameFromData ?? 'Customer',
      zhTw: inquiryNameFromData ?? '客戶',
    };
    const inquiryEmailByLocale: NotificationLocalizedText = {
      vi: inquiryEmailFromData ?? 'không rõ email',
      en: inquiryEmailFromData ?? 'unknown email',
      zhTw: inquiryEmailFromData ?? '未知電子郵件',
    };
    return this.createNotificationBuildResult({
      titleTranslations: {
        vi: 'Có khách liên hệ bất động sản',
        en: 'New property inquiry received',
        zhTw: '有新的房地產諮詢',
      },
      contentTranslations: {
        vi: `${inquiryNameByLocale.vi} (${inquiryEmailByLocale.vi}) vừa gửi liên hệ cho "${propertyTitleByLocale.vi}".`,
        en: `${inquiryNameByLocale.en} (${inquiryEmailByLocale.en}) has submitted an inquiry for "${propertyTitleByLocale.en}".`,
        zhTw: `${inquiryNameByLocale.zhTw}（${inquiryEmailByLocale.zhTw}）剛提交了對「${propertyTitleByLocale.zhTw}」的諮詢。`,
      },
      metadata: {
        propertyId:
          this.readString(parsedMetadata, ['propertyId']) ?? auditLog.entityId,
        propertyTitle: propertyTitleByLocale.vi,
        inquiryName: inquiryNameByLocale.vi,
        inquiryEmail: inquiryEmailByLocale.vi,
      },
    });
  }

  private buildAdOrderCreatedNotification(
    auditLog: ProjectableAuditLog,
  ): NotificationBuildResult {
    const parsedMetadata = this.parseJsonObject(auditLog.metadata);
    const subtotal =
      this.readString(parsedMetadata, ['subtotal']) ??
      this.readNumber(parsedMetadata, ['subtotal'])?.toString() ??
      '0';
    const itemCount =
      this.readNumber(parsedMetadata, ['itemCount']) ??
      Number(
        this.readString(parsedMetadata, ['itemCount']) ?? Number.NaN.toString(),
      );
    const shortOrderId = `${auditLog.entityId.slice(0, 8)}...`;
    const itemCountTextVi = this.buildAdOrderItemCountText(itemCount, 'vi');
    const itemCountTextEn = this.buildAdOrderItemCountText(itemCount, 'en');
    const itemCountTextZhTw = this.buildAdOrderItemCountText(itemCount, 'zhTw');
    return this.createNotificationBuildResult({
      titleTranslations: {
        vi: 'Có đơn mua quảng cáo mới',
        en: 'New advertising order submitted',
        zhTw: '有新的廣告訂單',
      },
      contentTranslations: {
        vi: `Đơn #${shortOrderId} vừa được gửi với ${itemCountTextVi}, tổng giá trị ${subtotal}.`,
        en: `Order #${shortOrderId} was submitted with ${itemCountTextEn}, subtotal ${subtotal}.`,
        zhTw: `訂單 #${shortOrderId} 已提交，包含 ${itemCountTextZhTw}，小計 ${subtotal}。`,
      },
      metadata: {
        orderId: auditLog.entityId,
        subtotal,
        itemCount: Number.isFinite(itemCount) ? itemCount : null,
      },
    });
  }

  private buildAdOrderItemCountText(
    itemCount: number,
    locale: NotificationLocale,
  ): string {
    if (!Number.isFinite(itemCount)) {
      if (locale === 'vi') {
        return 'nhiều hạng mục';
      }
      if (locale === 'en') {
        return 'multiple items';
      }
      return '多個項目';
    }
    if (locale === 'vi') {
      return `${itemCount} hạng mục`;
    }
    if (locale === 'en') {
      return `${itemCount} items`;
    }
    return `${itemCount} 個項目`;
  }

  private createNotificationBuildResult(
    input: CreateNotificationBuildResultInput,
  ): NotificationBuildResult {
    return {
      title: input.titleTranslations[NOTIFICATION_DEFAULT_LOCALE],
      content: input.contentTranslations[NOTIFICATION_DEFAULT_LOCALE],
      metadata: {
        ...input.metadata,
        source: 'audit_log',
        defaultLocale: NOTIFICATION_DEFAULT_LOCALE,
        locales: [...NOTIFICATION_SUPPORTED_LOCALES],
        translations: {
          title: input.titleTranslations,
          content: input.contentTranslations,
        },
      },
    };
  }

  private parseJsonObject(payload: string | null): Record<string, unknown> {
    if (!payload) {
      return {};
    }
    try {
      const parsed = JSON.parse(payload) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return {};
    } catch {
      return {};
    }
  }

  private extractObject(
    source: Record<string, unknown>,
    key: string,
  ): Record<string, unknown> {
    const value = source[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return {};
  }

  private readString(
    source: Record<string, unknown>,
    keys: readonly string[],
  ): string | null {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
      }
    }
    return null;
  }

  private readNumber(
    source: Record<string, unknown>,
    keys: readonly string[],
  ): number | null {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'number') {
        return value;
      }
    }
    return null;
  }

  private isUniqueConstraintError(err: unknown): boolean {
    return (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    );
  }
}
