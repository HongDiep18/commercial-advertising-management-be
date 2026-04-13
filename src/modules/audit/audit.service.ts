import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  CONTACT_TYPE,
  getPrimaryContactNameFromContactRows,
} from '../companies/company-contact.constants';
import {
  AuditActivityFormatter,
  type AuditLogRow,
} from './audit-activity-formatter';
import { AUDIT_LOG_RECORDED_EVENT_NAME } from './audit-log-recorded-event-name.constant';
import type { AuditLogRecordedEvent } from './audit-log-recorded.event';
import type {
  AdminRecentActivitiesResponseDto,
  RecentActivityItemDto,
} from './dto/admin-recent-activities.dto';

export type AuditRecordInput = {
  action: string;
  entityType: string;
  entityId: string;
  actorId?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  metadata?: Record<string, unknown> | null;
};

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async record(input: AuditRecordInput): Promise<void> {
    try {
      const action = input.action;
      const entityType = input.entityType;
      const entityId = input.entityId;
      const actorId = input.actorId ?? null;
      const oldValue = input.oldValue ?? null;
      const newValue = input.newValue ?? null;
      const metadata =
        input.metadata != null ? JSON.stringify(input.metadata) : null;
      const createdAuditLog = await this.prisma.auditLog.create({
        data: {
          action,
          entityType,
          entityId,
          actorId,
          oldValue,
          newValue,
          metadata,
        },
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          metadata: true,
          newValue: true,
        },
      });
      const auditLogRecordedEvent: AuditLogRecordedEvent = {
        id: createdAuditLog.id,
        action: createdAuditLog.action,
        entityType: createdAuditLog.entityType,
        entityId: createdAuditLog.entityId,
        metadata: createdAuditLog.metadata,
        newValue: createdAuditLog.newValue,
      };
      this.eventEmitter.emit(
        AUDIT_LOG_RECORDED_EVENT_NAME,
        auditLogRecordedEvent,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `record failed: ${message}. Ensure migration audit_logs is applied.`,
      );
    }
  }

  async listRecentActivities(): Promise<AdminRecentActivitiesResponseDto> {
    const limit = 6;
    const rows = await this.prisma.$queryRaw<AuditLogRow[]>(
      Prisma.sql`
        SELECT
          id,
          created_at AS "createdAt",
          action,
          entity_type AS "entityType",
          entity_id AS "entityId",
          actor_id AS "actorId",
          old_value AS "oldValue",
          new_value AS "newValue",
          metadata
        FROM audit_logs
        ORDER BY created_at DESC
        LIMIT ${limit}
      `,
    );

    const userLabelById = await this.buildUserLabelMap(rows);
    const profileRequestLabelById =
      await this.buildProfileRequestLabelMap(rows);
    const loyaltyLabelById = await this.buildLoyaltyLabelMap(rows);
    const propertyLabelById = await this.buildPropertyLabelMap(rows);
    const activities = rows.map((row) => {
      return this.mapRowToActivity(row, {
        userLabelById,
        profileRequestLabelById,
        loyaltyLabelById,
        propertyLabelById,
      });
    });
    return {
      activities,
      pagination: {
        page: 1,
        limit,
        total: activities.length,
        totalPages: 1,
      },
    };
  }

  private mapRowToActivity(
    row: AuditLogRow,
    labels: {
      readonly userLabelById: ReadonlyMap<string, string>;
      readonly profileRequestLabelById: ReadonlyMap<string, string>;
      readonly loyaltyLabelById: ReadonlyMap<string, string>;
      readonly propertyLabelById: ReadonlyMap<string, string>;
    },
  ): RecentActivityItemDto {
    const title = AuditActivityFormatter.toTitle(row.action);
    const content = AuditActivityFormatter.toContent(row, labels);
    return {
      id: row.id,
      time: row.createdAt.toISOString(),
      title,
      content,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      actorId: row.actorId,
    };
  }

  private getCompanyContactValue(
    contacts:
      | ReadonlyArray<{
          type: string;
          value: string;
          contactName?: string | null;
        }>
      | null
      | undefined,
    type: string,
  ): string | null {
    if (!contacts || contacts.length === 0) {
      return null;
    }
    const found = contacts.find((contact) => contact.type === type);
    return found?.value ?? null;
  }

  private getContactNameFromContacts(
    contacts:
      | ReadonlyArray<{
          type: string;
          value: string;
          contactName: string | null;
        }>
      | null
      | undefined,
  ): string | null {
    if (!contacts || contacts.length === 0) {
      return null;
    }
    return getPrimaryContactNameFromContactRows(contacts);
  }

  private async buildUserLabelMap(
    rows: readonly AuditLogRow[],
  ): Promise<Map<string, string>> {
    const userIds = new Set<string>();
    for (const row of rows) {
      if (row.entityType === 'User') {
        userIds.add(row.entityId);
      }
      if (row.actorId) {
        userIds.add(row.actorId);
      }
    }
    if (userIds.size === 0) {
      return new Map<string, string>();
    }
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...userIds] } },
      select: {
        id: true,
        email: true,
        company: {
          select: {
            companyNameVi: true,
            companyNameZh: true,
            companyContacts: {
              select: {
                type: true,
                value: true,
                contactName: true,
              },
            },
          },
        },
      } as Prisma.UserSelect,
    });
    const map = new Map<string, string>();
    for (const user of users as Array<UserLabelRow>) {
      const contactName = this.getContactNameFromContacts(
        user.company?.companyContacts,
      );
      const companyName =
        user.company?.companyNameVi ??
        user.company?.companyNameZh ??
        contactName;
      const label = user.email || companyName || user.id;
      map.set(user.id, label);
    }
    return map;
  }

  private async buildProfileRequestLabelMap(
    rows: readonly AuditLogRow[],
  ): Promise<Map<string, string>> {
    const requestIds = [
      ...new Set(
        rows
          .filter((row) => row.entityType === 'CompanyProfileRequest')
          .map((row) => row.entityId),
      ),
    ];
    if (requestIds.length === 0) {
      return new Map<string, string>();
    }
    const companies = await this.prisma.company.findMany({
      where: { id: { in: requestIds } },
      select: {
        id: true,
        companyNameVi: true,
        companyNameZh: true,
        companyContacts: {
          select: {
            type: true,
            value: true,
            contactName: true,
          },
        },
      },
    });
    const map = new Map<string, string>();
    for (const company of companies) {
      const email = this.getCompanyContactValue(
        company.companyContacts,
        CONTACT_TYPE.EMAIL,
      );
      const label =
        company.companyNameVi || company.companyNameZh || email || company.id;
      map.set(company.id, label);
    }
    return map;
  }

  private async buildLoyaltyLabelMap(
    rows: readonly AuditLogRow[],
  ): Promise<Map<string, string>> {
    const transactionIds = [
      ...new Set(
        rows
          .filter((row) => row.entityType === 'LoyaltyTransaction')
          .map((row) => row.entityId),
      ),
    ];
    if (transactionIds.length === 0) {
      return new Map<string, string>();
    }
    const transactions = await this.prisma.pointsTransaction.findMany({
      where: { id: { in: transactionIds } },
      select: {
        id: true,
        user: {
          select: {
            email: true,
            company: {
              select: {
                companyNameVi: true,
                companyNameZh: true,
                companyContacts: {
                  select: {
                    type: true,
                    value: true,
                    contactName: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    const map = new Map<string, string>();
    for (const transaction of transactions) {
      const contactName = this.getContactNameFromContacts(
        transaction.user.company?.companyContacts,
      );
      const companyName =
        transaction.user.company?.companyNameVi ??
        transaction.user.company?.companyNameZh ??
        contactName;
      const label = companyName || transaction.user.email || transaction.id;
      map.set(transaction.id, label);
    }
    return map;
  }

  private async buildPropertyLabelMap(
    rows: readonly AuditLogRow[],
  ): Promise<Map<string, string>> {
    const propertyIds = new Set<string>();
    for (const row of rows) {
      if (row.entityType === 'Property') {
        propertyIds.add(row.entityId);
      }
      const metadata = this.parseMetadata(row.metadata);
      const metadataPropertyId = this.readString(metadata, ['propertyId']);
      if (metadataPropertyId) {
        propertyIds.add(metadataPropertyId);
      }
    }
    if (propertyIds.size === 0) {
      return new Map<string, string>();
    }
    const properties = await this.prisma.property.findMany({
      where: {
        id: {
          in: [...propertyIds],
        },
      },
      select: {
        id: true,
        title: true,
      },
    });
    const map = new Map<string, string>();
    for (const property of properties) {
      map.set(property.id, property.title);
    }
    return map;
  }

  private parseMetadata(metadata: string | null): Record<string, unknown> {
    if (!metadata) {
      return {};
    }
    try {
      const parsed = JSON.parse(metadata) as unknown;
      if (parsed && typeof parsed === 'object') {
        return parsed as Record<string, unknown>;
      }
      return {};
    } catch {
      return {};
    }
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
}

type UserLabelRow = {
  id: string;
  email: string;
  company: {
    companyNameVi: string | null;
    companyNameZh: string | null;
    companyContacts: Array<{
      type: string;
      value: string;
      contactName: string | null;
    }>;
  } | null;
};
