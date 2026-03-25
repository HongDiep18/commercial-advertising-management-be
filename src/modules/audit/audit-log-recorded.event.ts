export type AuditLogRecordedEvent = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: string | null;
  newValue: string | null;
};