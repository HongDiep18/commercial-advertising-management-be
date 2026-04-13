export const CONTACT_TYPE = {
  EMAIL: 'email',
  TEL: 'tel',
  PHONE: 'phone',
  CONTACT_PERSON: 'contact_person',
  FAX: 'fax',
  WEBSITE: 'website',
  HOTLINE: 'hotline',
  WECHAT: 'wechat',
  LINE: 'line',
  SKYPE: 'skype',
  ZALO: 'zalo',
  FACEBOOK: 'facebook',
  VIBER: 'viber',
  ADDRESS: 'address',
  NOTE: 'note',
} as const;

export type ContactTypeValue = (typeof CONTACT_TYPE)[keyof typeof CONTACT_TYPE];

/** Resolve primary phone: legacy tel/phone rows first, then `contact_person` row (`value` is the number). */
export const PRIMARY_PHONE_VALUE_ORDER: readonly string[] = [
  CONTACT_TYPE.TEL,
  CONTACT_TYPE.PHONE,
  CONTACT_TYPE.CONTACT_PERSON,
];

/**
 * First non-empty phone value across legacy `tel` / `phone` and registration `contact_person` rows.
 */
export function getPrimaryPhoneValueFromContactRows(
  contacts: ReadonlyArray<{ type: string; value: string }>,
): string {
  for (const phoneType of PRIMARY_PHONE_VALUE_ORDER) {
    const row = contacts.find((c) => c.type === phoneType);
    const value = row?.value?.trim();
    if (value) {
      return value;
    }
  }
  return '';
}

/**
 * Prefer `contact_name` on the `contact_person` row, then legacy email/tel named rows.
 */
export function getPrimaryContactNameFromContactRows(
  contacts: ReadonlyArray<{
    type: string;
    value: string;
    contactName: string | null;
  }>,
): string | null {
  const contactPersonRow = contacts.find(
    (c) => c.type === CONTACT_TYPE.CONTACT_PERSON,
  );
  if (contactPersonRow?.contactName?.trim()) {
    return contactPersonRow.contactName.trim();
  }
  const priorityTypes = [CONTACT_TYPE.EMAIL, CONTACT_TYPE.TEL];
  for (const contactType of priorityTypes) {
    const row = contacts.find(
      (c) =>
        c.type === contactType &&
        c.contactName &&
        c.contactName.trim().length > 0,
    );
    if (row?.contactName) {
      return row.contactName.trim();
    }
  }
  const anyNamed = contacts.find(
    (c) => c.contactName && c.contactName.trim().length > 0,
  );
  return anyNamed?.contactName?.trim() ?? null;
}
