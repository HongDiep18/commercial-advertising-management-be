import { AUDIT_ACTION } from '../audit/audit.constants';

export const NOTIFICATIONS_CONFIG = {
  supportedAuditActions: [
    AUDIT_ACTION.PROPERTY_CONTACT_INQUIRY_CREATED,
    AUDIT_ACTION.AD_ORDER_CREATED,
  ] as const,
  projectorBatchSize: 100,
} as const;
