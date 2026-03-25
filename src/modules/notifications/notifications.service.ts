import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AdminListNotificationsQueryDto } from './dto/admin-list-notifications-query.dto';
import { AdminListNotificationsResponseDto } from './dto/admin-list-notifications-response.dto';
import { AdminNotificationReadAllResponseDto } from './dto/admin-notification-read-all-response.dto';
import { AdminNotificationReadResponseDto } from './dto/admin-notification-read-response.dto';
import { AdminNotificationUnreadCountDto } from './dto/admin-notification-unread-count.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listAdminNotifications(
    query: AdminListNotificationsQueryDto,
  ): Promise<AdminListNotificationsResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.NotificationWhereInput = {};
    if (query.unreadOnly === true) {
      where.isRead = false;
    }
    if (query.eventType) {
      where.eventType = query.eventType;
    }
    const skip = (page - 1) * limit;
    const [total, notifications] = await this.prisma.$transaction([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
    ]);
    return {
      notifications: notifications.map((notification) => {
        return {
          id: notification.id,
          createdAt: notification.createdAt,
          updatedAt: notification.updatedAt,
          eventType: notification.eventType,
          title: notification.title,
          content: notification.content,
          entityType: notification.entityType,
          entityId: notification.entityId,
          isRead: notification.isRead,
          readAt: notification.readAt,
          metadata: this.toMetadataRecord(notification.metadata),
        };
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getAdminUnreadCount(): Promise<AdminNotificationUnreadCountDto> {
    const unreadCount = await this.prisma.notification.count({
      where: {
        isRead: false,
      },
    });
    return { unreadCount };
  }

  async markAdminNotificationAsRead(
    id: string,
  ): Promise<AdminNotificationReadResponseDto> {
    const now = new Date();
    await this.prisma.notification.updateMany({
      where: {
        id,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: now,
      },
    });
    const notification = await this.prisma.notification.findUnique({
      where: { id },
      select: {
        id: true,
        isRead: true,
        readAt: true,
      },
    });
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    return {
      id: notification.id,
      isRead: notification.isRead,
      readAt: notification.readAt,
    };
  }

  async markAllAdminNotificationsAsRead(): Promise<AdminNotificationReadAllResponseDto> {
    const now = new Date();
    const result = await this.prisma.notification.updateMany({
      where: {
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: now,
      },
    });
    return {
      updatedCount: result.count,
    };
  }

  private toMetadataRecord(
    metadata: Prisma.JsonValue | null,
  ): Record<string, unknown> {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return {};
    }
    return metadata as Record<string, unknown>;
  }
}
