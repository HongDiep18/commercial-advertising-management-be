import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

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
}
