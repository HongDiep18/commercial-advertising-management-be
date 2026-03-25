type FormatterContext = {
  readonly userLabelById: ReadonlyMap<string, string>;
  readonly profileRequestLabelById: ReadonlyMap<string, string>;
  readonly loyaltyLabelById: ReadonlyMap<string, string>;
  readonly propertyLabelById: ReadonlyMap<string, string>;
};

export type AuditLogRow = {
  id: string;
  createdAt: Date;
  action: string;
  entityType: string;
  entityId: string;
  actorId: string | null;
  oldValue: string | null;
  newValue: string | null;
  metadata: string | null;
};

type ContentContext = {
  readonly row: AuditLogRow;
  readonly context: FormatterContext;
  readonly metadata: Record<string, unknown>;
  readonly companyName: string | null;
  readonly email: string | null;
  readonly userLabel: string | null;
  readonly shortEntityId: string;
  readonly profileSubject: string;
  readonly companySubject: string;
  readonly propertySubject: string;
  readonly userAccountLabel: string;
};

const TITLE_BY_ACTION: Record<string, string> = {
  'profile_request.created': 'Profile request submitted',
  'profile_request.status_changed': 'Profile request status changed',
  'profile_request.approved': 'Profile request approved',
  'profile_request.rejected': 'Profile request rejected',
  'company.created': 'Company created',
  'company.updated': 'Company updated',
  'company.updated_by_admin': 'Company updated by admin',
  'user.active_changed': 'User status changed',
  'user.soft_deleted': 'User soft deleted',
  'user.password_changed': 'User password changed',
  'user.set_password_used': 'Set password completed',
  'ad_order.created': 'Ad order created',
  'ad_order.approved': 'Ad order approved',
  'ad_order.rejected': 'Ad order rejected',
  'ad_pricing.created': 'Ad pricing created',
  'ad_pricing.updated': 'Ad pricing updated',
  'ad_pricing.deleted': 'Ad pricing deleted',
  'active_ad.created': 'Active ad created',
  'active_ad.manually_created': 'Active ad created manually',
  'loyalty.points_awarded': 'Loyalty points awarded',
  'loyalty.points_deducted': 'Loyalty points deducted',
  'loyalty.tier_changed': 'Loyalty tier changed',
  'loyalty.tier_recalculated': 'Loyalty tier recalculated',
  'property.created': 'Property created',
  'property.updated': 'Property updated',
  'property.deleted': 'Property deleted',
  'property.legal_document_uploaded': 'Property legal documents uploaded',
  'property.legal_document_deleted': 'Property legal document deleted',
  'property.contact_inquiry_created': 'Property contact inquiry created',
};

const ACTION_CONTENT_HANDLERS: Record<string, (c: ContentContext) => string> = {
  'profile_request.approved': (c) =>
    `Approved registration for ${c.profileSubject}.`,
  'profile_request.rejected': (c) =>
    `Rejected registration for ${c.profileSubject}.`,
  'profile_request.created': (c) =>
    `New registration request from ${c.profileSubject}.`,
  'company.updated_by_admin': (c) =>
    `Updated company profile for ${c.companySubject}.`,
  'company.updated': (c) => `Updated company profile for ${c.companySubject}.`,
  'company.created': (c) => `Created company profile for ${c.companySubject}.`,
  'user.active_changed': (c) => {
    const toState =
      (c.row.newValue ?? '').toLowerCase() === 'true' ? 'enabled' : 'disabled';
    return `${c.userAccountLabel} was ${toState}.`;
  },
  'user.soft_deleted': (c) => `${c.userAccountLabel} was soft deleted.`,
  'user.password_changed': (c) => `Password updated for ${c.userAccountLabel}.`,
  'user.set_password_used': (c) =>
    `Set-password completed for ${c.userAccountLabel}.`,
  'ad_order.approved': (c) => `Approved ad order ${c.shortEntityId}.`,
  'ad_order.rejected': (c) => `Rejected ad order ${c.shortEntityId}.`,
  'ad_order.created': (c) => `Created ad order ${c.shortEntityId}.`,
  'property.created': (c) => `Created property ${c.propertySubject}.`,
  'property.updated': (c) => `Updated property ${c.propertySubject}.`,
  'property.deleted': (c) => `Deleted property ${c.propertySubject}.`,
  'property.legal_document_uploaded': (c) => {
    const uploadedCount = readNumberFromMetadata(c.metadata, ['uploadedCount']);
    if (uploadedCount && uploadedCount > 0) {
      return `Uploaded ${uploadedCount} legal document(s) for ${c.propertySubject}.`;
    }
    return `Uploaded legal document(s) for ${c.propertySubject}.`;
  },
  'property.legal_document_deleted': (c) => {
    const legalDocumentName = resolveLegalDocumentNameFromContext(c);
    if (legalDocumentName) {
      return `Deleted legal document ${legalDocumentName} from ${c.propertySubject}.`;
    }
    return `Deleted legal document from ${c.propertySubject}.`;
  },
  'property.contact_inquiry_created': (c) =>
    `Created contact inquiry for ${c.propertySubject}.`,
};

const ENTITY_CONTENT_HANDLERS: Partial<
  Record<string, (c: ContentContext) => string>
> = {
  LoyaltyTransaction: (c) => formatLoyaltyEntityContent(c),
};

const PRIMARY_LABEL_RESOLVERS: Array<(c: ContentContext) => string | null> = [
  (c) => c.companyName,
  (c) =>
    c.row.entityType === 'CompanyProfileRequest' &&
    c.context.profileRequestLabelById.has(c.row.entityId)
      ? (c.context.profileRequestLabelById.get(c.row.entityId) ?? null)
      : null,
  (c) =>
    c.row.entityType === 'LoyaltyTransaction' &&
    c.context.loyaltyLabelById.has(c.row.entityId)
      ? (c.context.loyaltyLabelById.get(c.row.entityId) ?? null)
      : null,
  (c) =>
    c.row.entityType === 'Property' &&
    c.context.propertyLabelById.has(c.row.entityId)
      ? (c.context.propertyLabelById.get(c.row.entityId) ?? null)
      : null,
  (c) => (c.row.entityType === 'User' && c.userLabel ? c.userLabel : null),
  (c) => c.email,
];

function formatLoyaltyEntityContent(c: ContentContext): string {
  const subject =
    c.context.loyaltyLabelById.get(c.row.entityId) ?? 'loyalty account';
  const { oldValue, newValue } = c.row;
  const detail = describePointsDelta(oldValue, newValue);
  if (detail) {
    return `${subject} points ${detail}.`;
  }
  return `Loyalty activity recorded for ${subject}.`;
}

function describePointsDelta(
  oldValue: string | null,
  newValue: string | null,
): string | null {
  if (newValue && oldValue) {
    return `changed from ${oldValue} to ${newValue}`;
  }
  if (newValue) {
    return `updated to ${newValue}`;
  }
  return null;
}

function describeGenericValueChange(
  oldValue: string | null,
  newValue: string | null,
): string | null {
  if (newValue && oldValue) {
    return `changed from ${oldValue} to ${newValue}`;
  }
  if (newValue) {
    return `new value ${newValue}`;
  }
  return null;
}

function readStringFromUnknown(
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

function readNumberFromMetadata(
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

function readNestedStringFromJsonByKey(
  payload: string | null,
  nestedKey: string,
  keys: readonly string[],
): string | null {
  if (!payload) {
    return null;
  }
  try {
    const parsed = JSON.parse(payload) as unknown;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    const root = parsed as Record<string, unknown>;
    const nested = root[nestedKey];
    if (nested && typeof nested === 'object') {
      return readStringFromUnknown(nested as Record<string, unknown>, keys);
    }
    return readStringFromUnknown(root, keys);
  } catch {
    return null;
  }
}

function resolveLegalDocumentNameFromContext(c: ContentContext): string | null {
  const metadataFileName = readStringFromUnknown(c.metadata, ['fileName']);
  if (metadataFileName) {
    return metadataFileName;
  }
  return (
    readNestedStringFromJsonByKey(c.row.oldValue, 'legalDocument', [
      'fileName',
    ]) ??
    readNestedStringFromJsonByKey(c.row.newValue, 'legalDocument', ['fileName'])
  );
}

export class AuditActivityFormatter {
  static toTitle(action: string): string {
    return TITLE_BY_ACTION[action] ?? action.replaceAll('_', ' ');
  }

  static toContent(row: AuditLogRow, context: FormatterContext): string {
    const ctx = AuditActivityFormatter.buildContentContext(row, context);
    const byAction = ACTION_CONTENT_HANDLERS[row.action];
    if (byAction) {
      return byAction(ctx);
    }
    const byEntity = ENTITY_CONTENT_HANDLERS[row.entityType];
    if (byEntity) {
      return byEntity(ctx);
    }
    return AuditActivityFormatter.formatGenericFallback(ctx);
  }

  private static buildContentContext(
    row: AuditLogRow,
    context: FormatterContext,
  ): ContentContext {
    const metadata = AuditActivityFormatter.parseMetadata(row.metadata);
    const companyName = AuditActivityFormatter.resolveCompanyName(
      row,
      metadata,
    );
    const email = AuditActivityFormatter.readString(metadata, ['email']);
    const userLabel = AuditActivityFormatter.resolveUserLabel(
      row,
      metadata,
      context.userLabelById,
    );
    const shortEntityId = AuditActivityFormatter.toShortId(row.entityId);
    const profileSubject =
      companyName ??
      email ??
      context.profileRequestLabelById.get(row.entityId) ??
      `request ${shortEntityId}`;
    const companySubject = companyName ?? email ?? 'company profile';
    const propertySubject = AuditActivityFormatter.resolvePropertySubject(
      row,
      context,
      metadata,
      shortEntityId,
    );
    const userAccountLabel = userLabel ?? 'User account';
    return {
      row,
      context,
      metadata,
      companyName,
      email,
      userLabel,
      shortEntityId,
      profileSubject,
      companySubject,
      propertySubject,
      userAccountLabel,
    };
  }

  private static formatGenericFallback(c: ContentContext): string {
    const primary = AuditActivityFormatter.resolvePrimaryLabel(c);
    const change = describeGenericValueChange(c.row.oldValue, c.row.newValue);
    return change ? `${primary} - ${change}` : primary;
  }

  private static resolvePrimaryLabel(c: ContentContext): string {
    for (const resolve of PRIMARY_LABEL_RESOLVERS) {
      const value = resolve(c);
      if (value) {
        return value;
      }
    }
    return c.row.entityType === 'User'
      ? 'User account'
      : `${c.row.entityType} ${c.shortEntityId}`;
  }

  private static parseMetadata(
    metadata: string | null,
  ): Record<string, unknown> {
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

  private static readString(
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

  private static resolveCompanyName(
    row: AuditLogRow,
    metadata: Record<string, unknown>,
  ): string | null {
    const extractors: Array<
      (r: AuditLogRow, m: Record<string, unknown>) => string | null
    > = [
      (_, m) =>
        AuditActivityFormatter.readString(m, [
          'companyNameVi',
          'companyNameCn',
        ]),
      (r) =>
        AuditActivityFormatter.readNestedStringFromJson(r.newValue, 'company', [
          'companyNameVi',
          'companyNameCn',
        ]),
      (r) =>
        AuditActivityFormatter.readNestedStringFromJson(r.oldValue, 'company', [
          'companyNameVi',
          'companyNameCn',
        ]),
    ];
    for (const extract of extractors) {
      const value = extract(row, metadata);
      if (value) {
        return value;
      }
    }
    return null;
  }

  private static resolveUserLabel(
    row: AuditLogRow,
    metadata: Record<string, unknown>,
    userLabelById: ReadonlyMap<string, string>,
  ): string | null {
    const userKeys = [
      'email',
      'userEmail',
      'accountEmail',
      'contactName',
      'userName',
    ] as const;
    const jsonKeys = ['email', 'userEmail', 'name', 'userName'] as const;
    const extractors: Array<() => string | null> = [
      () => AuditActivityFormatter.readString(metadata, userKeys),
      () =>
        AuditActivityFormatter.readNestedStringFromJson(
          row.newValue,
          'user',
          jsonKeys,
        ),
      () =>
        AuditActivityFormatter.readNestedStringFromJson(
          row.oldValue,
          'user',
          jsonKeys,
        ),
      () => userLabelById.get(row.entityId) ?? null,
      () => (row.actorId ? (userLabelById.get(row.actorId) ?? null) : null),
    ];
    for (const extract of extractors) {
      const value = extract();
      if (value) {
        return value;
      }
    }
    return null;
  }

  private static resolvePropertySubject(
    row: AuditLogRow,
    context: FormatterContext,
    metadata: Record<string, unknown>,
    shortEntityId: string,
  ): string {
    const metadataPropertyTitle = AuditActivityFormatter.readString(metadata, [
      'propertyTitle',
    ]);
    if (metadataPropertyTitle) {
      return metadataPropertyTitle;
    }
    const metadataPropertyId = AuditActivityFormatter.readString(metadata, [
      'propertyId',
    ]);
    if (
      metadataPropertyId &&
      context.propertyLabelById.has(metadataPropertyId)
    ) {
      return (
        context.propertyLabelById.get(metadataPropertyId) ??
        `property ${metadataPropertyId.slice(0, 8)}...`
      );
    }
    if (
      row.entityType === 'Property' &&
      context.propertyLabelById.has(row.entityId)
    ) {
      return (
        context.propertyLabelById.get(row.entityId) ??
        `property ${shortEntityId}`
      );
    }
    const propertyTitleFromPayload =
      readNestedStringFromJsonByKey(row.newValue, 'property', ['title']) ??
      readNestedStringFromJsonByKey(row.oldValue, 'property', ['title']);
    if (propertyTitleFromPayload) {
      return propertyTitleFromPayload;
    }
    return `property ${shortEntityId}`;
  }

  private static readNestedStringFromJson(
    payload: string | null,
    nestedKey: 'company' | 'user',
    keys: readonly string[],
  ): string | null {
    if (!payload) {
      return null;
    }
    try {
      const parsed = JSON.parse(payload) as unknown;
      if (!parsed || typeof parsed !== 'object') {
        return null;
      }
      const root = parsed as Record<string, unknown>;
      const nested = root[nestedKey];
      if (nested && typeof nested === 'object') {
        return AuditActivityFormatter.readString(
          nested as Record<string, unknown>,
          keys,
        );
      }
      return AuditActivityFormatter.readString(root, keys);
    } catch {
      return null;
    }
  }

  private static toShortId(value: string): string {
    if (value.length <= 8) {
      return value;
    }
    return `${value.slice(0, 8)}...`;
  }
}
