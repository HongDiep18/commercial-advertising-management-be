import type { Prisma } from '@prisma/client';
import { CONTACT_TYPE } from './company-contact.constants';

/** `undefined` = leave unchanged; `clear` = remove note rows; `set` = replace with text. */
export type AdminNotePatch =
  | undefined
  | { readonly kind: 'clear' }
  | { readonly kind: 'set'; readonly value: string };

export function parseAdminUpdateNote(
  note: string | null | undefined,
): AdminNotePatch {
  if (note === undefined) {
    return undefined;
  }
  if (note === null) {
    return { kind: 'clear' };
  }
  const trimmed = note.trim();
  return trimmed.length > 0
    ? { kind: 'set', value: trimmed }
    : { kind: 'clear' };
}

export function getNoteFromContactRows(
  contacts: ReadonlyArray<{ type: string; value: string }>,
): string | null {
  const raw = contacts.find((c) => c.type === CONTACT_TYPE.NOTE)?.value ?? null;
  if (raw === null) {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function applyCompanyNotePatch(
  tx: Prisma.TransactionClient,
  companyId: string,
  patch: AdminNotePatch,
): Promise<void> {
  if (patch === undefined) {
    return;
  }
  await tx.companyContact.deleteMany({
    where: { companyId, type: CONTACT_TYPE.NOTE },
  });
  if (patch.kind === 'clear') {
    return;
  }
  await tx.companyContact.create({
    data: {
      companyId,
      type: CONTACT_TYPE.NOTE,
      value: patch.value,
      contactName: null,
    },
  });
}
