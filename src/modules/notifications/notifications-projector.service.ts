import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
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
    if (auditLog.action === 'property.contact_inquiry_created') {
      return this.buildPropertyInquiryNotification(auditLog);
    }
    if (auditLog.action === 'ad_order.created') {
      return this.buildAdOrderCreatedNotification(auditLog);
    }
    return {
      title: 'Có thông báo mới',
      content: `Có hoạt động mới cho ${auditLog.entityType}.`,
      metadata: {
        source: 'audit_log',
      },
    };
  }

  private buildPropertyInquiryNotification(
    auditLog: ProjectableAuditLog,
  ): NotificationBuildResult {
    const parsedMetadata = this.parseJsonObject(auditLog.metadata);
    const parsedNewValue = this.parseJsonObject(auditLog.newValue);
    const inquiryData = this.extractObject(parsedNewValue, 'contactInquiry');
    const propertyTitle =
      this.readString(parsedMetadata, ['propertyTitle']) ??
      `BĐS ${auditLog.entityId.slice(0, 8)}...`;
    const inquiryName = this.readString(inquiryData, ['name']) ?? 'Khách hàng';
    const inquiryEmail =
      this.readString(inquiryData, ['email']) ??
      this.readString(parsedMetadata, ['email']) ??
      'không rõ email';
    return {
      title: 'Có khách liên hệ bất động sản',
      content: `${inquiryName} (${inquiryEmail}) vừa gửi liên hệ cho "${propertyTitle}".`,
      metadata: {
        propertyId:
          this.readString(parsedMetadata, ['propertyId']) ?? auditLog.entityId,
        propertyTitle,
        inquiryName,
        inquiryEmail,
      },
    };
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
    const itemCountText = Number.isFinite(itemCount)
      ? `${itemCount} hạng mục`
      : 'nhiều hạng mục';
    return {
      title: 'Có đơn mua quảng cáo mới',
      content: `Đơn #${shortOrderId} vừa được gửi với ${itemCountText}, tổng giá trị ${subtotal}.`,
      metadata: {
        orderId: auditLog.entityId,
        subtotal,
        itemCount: Number.isFinite(itemCount) ? itemCount : null,
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
