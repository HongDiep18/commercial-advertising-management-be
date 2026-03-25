import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  AuditActivityFormatter,
  type AuditLogRow,
} from './audit-activity-formatter';
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

  constructor(private readonly prisma: PrismaService) {}

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

      await this.prisma.$executeRaw`
        INSERT INTO audit_logs (id, created_at, action, entity_type, entity_id, actor_id, old_value, new_value, metadata)
        VALUES (gen_random_uuid(), NOW(), ${action}, ${entityType}, ${entityId}, ${actorId}, ${oldValue}, ${newValue}, ${metadata})
      `;
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
    const activities = rows.map((row) => {
      return this.mapRowToActivity(row, {
        userLabelById,
        profileRequestLabelById,
        loyaltyLabelById,
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
            companyNameCn: true,
            contactName: true,
          },
        },
      } as Prisma.UserSelect,
    });
    const map = new Map<string, string>();
    for (const user of users as Array<UserLabelRow>) {
      const companyName =
        user.company?.companyNameVi ??
        user.company?.companyNameCn ??
        user.company?.contactName;
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
    const requests = await this.prisma.companyProfileRequest.findMany({
      where: { id: { in: requestIds } },
      select: {
        id: true,
        companyNameVi: true,
        companyNameCn: true,
        email: true,
      },
    });
    const map = new Map<string, string>();
    for (const request of requests) {
      const label =
        request.companyNameVi ||
        request.companyNameCn ||
        request.email ||
        request.id;
      map.set(request.id, label);
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
                companyNameCn: true,
                contactName: true,
              },
            },
          },
        },
      },
    });
    const map = new Map<string, string>();
    for (const transaction of transactions) {
      const companyName =
        transaction.user.company?.companyNameVi ??
        transaction.user.company?.companyNameCn ??
        transaction.user.company?.contactName;
      const label = companyName || transaction.user.email || transaction.id;
      map.set(transaction.id, label);
    }
    return map;
  }
}

type UserLabelRow = {
  id: string;
  email: string;
  company: {
    companyNameVi: string | null;
    companyNameCn: string | null;
    contactName: string | null;
  } | null;
};
