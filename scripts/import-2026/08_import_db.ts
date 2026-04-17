import 'reflect-metadata';

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtModule } from '@nestjs/jwt';
import { CompanyProfileRequestStatus, Prisma } from '@prisma/client';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { jwtConfig, mailConfig, storageConfig } from '../../src/config';
import { DatabaseModule } from '../../src/database/database.module';
import { PrismaService } from '../../src/database/prisma.service';
import { AuditModule } from '../../src/modules/audit/audit.module';
import {
  AuthService,
  type ProvisionCompanyUserResult,
} from '../../src/modules/auth/auth.service';
import { CaptchaVerificationService } from '../../src/modules/auth/captcha-verification.service';
import { CONTACT_TYPE } from '../../src/modules/companies/company-contact.constants';
import { LoyaltyService } from '../../src/modules/loyalty/loyalty.service';
import { MailModule } from '../../src/modules/mail/mail.module';

type JsonCompanyContact = {
  type?: string | null;
  value?: string | null;
};

type JsonUserContact = {
  name?: string | null;
  phone?: string | null;
};

type JsonCompany = {
  id?: string | null;
  companyNameVi?: string | null;
  companyNameZh?: string | null;
  companyNameEn?: string | null;
  taxId?: string | null;
  country?: string | null;
  region?: string | null;
  industries?: string[] | null;
  description?: string | null;
  companyContacts?: JsonCompanyContact[] | null;
  userContacts?: JsonUserContact[] | null;
  addresses?: string[] | null;
};

type ImportContactRow = {
  type: string;
  value: string;
  contactName: string | null;
};

type ImportSummary = {
  companiesInserted: number;
  companiesUpdated: number;
  contactsCreated: number;
  usersCreated: number;
  existingUsersLinked: number;
  existingUsersReused: number;
  userEmailConflictsSkipped: number;
  setPasswordEmailsSent: number;
};

const DEFAULT_INPUT = resolve(
  process.cwd(),
  'scripts/import-2026/out/05_companies.json',
);

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [jwtConfig, mailConfig, storageConfig],
    }),
    EventEmitterModule.forRoot(),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('jwt.secret');
        if (!secret) {
          throw new Error('JWT_SECRET is not configured');
        }
        const expiresIn = configService.get<string>('jwt.expiresIn') ?? '7d';
        return { secret, signOptions: { expiresIn } } as any;
      },
      inject: [ConfigService],
    }),
    DatabaseModule,
    AuditModule,
    MailModule,
  ],
  providers: [LoyaltyService, CaptchaVerificationService, AuthService],
})
class CompanyImportModule {}

function normalizeOptionalString(
  value: string | null | undefined,
): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

const REGION_MAP: Record<string, string> = {
  // Ho Chi Minh
  'ho chi minh city': 'hcm',
  'ho chi minh': 'hcm',
  'hồ chí minh': 'hcm',
  'tp hcm': 'hcm',
  'tp. hcm': 'hcm',
  hcm: 'hcm',
  // Ha Noi
  'ha noi': 'hanoi',
  'hà nội': 'hanoi',
  hanoi: 'hanoi',
  // Dong Nai
  'dong nai': 'dongnai',
  'đồng nai': 'dongnai',
  // Tay Ninh
  'tay ninh': 'tayninh',
  'tây ninh': 'tayninh',
  // Lam Dong
  'lam dong': 'lamdong',
  'lâm đồng': 'lamdong',
  // Da Nang
  'da nang': 'danang',
  'đà nẵng': 'danang',
  // Other / foreign
  other: 'other-region',
  zhejiang: 'other',
};

function normalizeRegion(region: string | null): string | null {
  if (!region) return null;
  return REGION_MAP[region.toLowerCase()] ?? region;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeUuid(value: string | null | undefined): string | null {
  const normalized = normalizeOptionalString(value)?.toLowerCase() ?? null;
  if (
    normalized &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      normalized,
    )
  ) {
    return normalized;
  }
  return null;
}

function normalizeMatchKey(value: string | null | undefined): string | null {
  const normalized = normalizeOptionalString(value)?.toLowerCase() ?? null;
  return normalized ? normalized.replace(/\s+/g, ' ') : null;
}

function buildCompanyContactRows(company: JsonCompany): ImportContactRow[] {
  const rows = new Map<string, ImportContactRow>();
  const upsertRow = (row: ImportContactRow): void => {
    const keyValue =
      row.type === CONTACT_TYPE.EMAIL ? normalizeEmail(row.value) : row.value;
    const key = `${row.type}\0${keyValue}`;
    const existing = rows.get(key);
    if (!existing) {
      rows.set(key, {
        type: row.type,
        value: keyValue,
        contactName: row.contactName,
      });
      return;
    }
    if (!existing.contactName && row.contactName) {
      existing.contactName = row.contactName;
    }
  };

  for (const contact of company.companyContacts ?? []) {
    const type = normalizeOptionalString(contact.type)?.toLowerCase();
    const rawValue = normalizeOptionalString(contact.value);
    if (!type || !rawValue) {
      continue;
    }
    upsertRow({
      type,
      value: rawValue,
      contactName: null,
    });
  }

  for (const contact of company.userContacts ?? []) {
    const phone = normalizeOptionalString(contact.phone);
    if (!phone) {
      continue;
    }
    upsertRow({
      type: CONTACT_TYPE.CONTACT_PERSON,
      value: phone,
      contactName: normalizeOptionalString(contact.name),
    });
  }

  for (const address of company.addresses ?? []) {
    const value = normalizeOptionalString(address);
    if (!value) {
      continue;
    }
    upsertRow({
      type: CONTACT_TYPE.ADDRESS,
      value,
      contactName: null,
    });
  }

  return Array.from(rows.values());
}

function getPrimaryCompanyEmail(company: JsonCompany): string | null {
  for (const contact of company.companyContacts ?? []) {
    if (
      normalizeOptionalString(contact.type)?.toLowerCase() !==
      CONTACT_TYPE.EMAIL
    ) {
      continue;
    }
    const email = normalizeOptionalString(contact.value);
    if (email) {
      return normalizeEmail(email);
    }
  }
  return null;
}

function getCompanyMatchName(company: JsonCompany): string | null {
  return normalizeMatchKey(
    company.companyNameZh ?? company.companyNameEn ?? company.companyNameVi,
  );
}

function getCompanyMatchNames(company: JsonCompany): string[] {
  return Array.from(
    new Set(
      [
        normalizeOptionalString(company.companyNameZh),
        normalizeOptionalString(company.companyNameEn),
        normalizeOptionalString(company.companyNameVi),
      ].filter((value): value is string => Boolean(value)),
    ),
  );
}

function getCompanyMatchPhones(
  contactRows: ReadonlyArray<ImportContactRow>,
): string[] {
  const phoneTypes = new Set<string>([
    CONTACT_TYPE.TEL,
    CONTACT_TYPE.HOTLINE,
    CONTACT_TYPE.CONTACT_PERSON,
  ]);
  return Array.from(
    new Set(
      contactRows
        .filter((row) => phoneTypes.has(row.type))
        .map((row) => row.value.trim())
        .filter((value) => value.length > 0),
    ),
  );
}

function buildCompanyImportLockKey(input: {
  company: JsonCompany;
  companyEmail: string | null;
  contactRows: ReadonlyArray<ImportContactRow>;
  normalizedRegion: string | null;
}): string {
  const sourceId = normalizeUuid(input.company.id);
  if (sourceId) {
    return `id:${sourceId}`;
  }

  const taxId = normalizeOptionalString(input.company.taxId);
  if (taxId) {
    return `tax:${taxId.toLowerCase()}`;
  }

  if (input.companyEmail) {
    return `email:${input.companyEmail}`;
  }

  const matchName = getCompanyMatchName(input.company);
  if (matchName) {
    return `name-region:${matchName}|${input.normalizedRegion ?? 'null'}`;
  }

  const phones = getCompanyMatchPhones(input.contactRows);
  if (phones.length > 0) {
    return `phone:${phones.join(',')}`;
  }

  return `fallback:${JSON.stringify({
    zh: normalizeOptionalString(input.company.companyNameZh),
    en: normalizeOptionalString(input.company.companyNameEn),
    vi: normalizeOptionalString(input.company.companyNameVi),
    region: input.normalizedRegion,
  })}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, ms);
  });
}

async function acquireCompanyImportLock(
  tx: Prisma.TransactionClient,
  lockKey: string,
): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt++) {
    const rows = await tx.$queryRaw<Array<{ locked: boolean }>>(
      Prisma.sql`
        SELECT pg_try_advisory_xact_lock(hashtext(${lockKey}), 0) AS locked
      `,
    );
    if (rows[0]?.locked) {
      return;
    }
    await sleep(200);
  }
  throw new Error(`Timed out waiting for import lock: ${lockKey}`);
}

async function findExistingCompanyForImport(
  tx: Prisma.TransactionClient,
  input: {
    company: JsonCompany;
    companyEmail: string | null;
    contactRows: ReadonlyArray<ImportContactRow>;
    normalizedRegion: string | null;
  },
): Promise<{ id: string } | null> {
  const sourceId = normalizeUuid(input.company.id);
  if (sourceId) {
    const company = await tx.company.findFirst({
      where: {
        OR: [{ importKey: sourceId }, { id: sourceId }],
      },
      select: { id: true },
    });
    if (company) {
      return company;
    }
  }

  const taxId = normalizeOptionalString(input.company.taxId);
  if (taxId) {
    const company = await tx.company.findFirst({
      where: {
        taxId: {
          equals: taxId,
          mode: 'insensitive',
        },
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (company) {
      return company;
    }
  }

  // Email is intentionally NOT used as a dedup key — group companies legitimately
  // share contact emails across separate legal entities with different taxIds.

  const namePredicates = getCompanyMatchNames(input.company).map(
    (name): Prisma.CompanyWhereInput => ({
      OR: [
        { companyNameZh: { equals: name, mode: 'insensitive' } },
        { companyNameEn: { equals: name, mode: 'insensitive' } },
        { companyNameVi: { equals: name, mode: 'insensitive' } },
      ],
    }),
  );
  if (namePredicates.length > 0 && input.normalizedRegion && !taxId) {
    const company = await tx.company.findFirst({
      where: {
        region: {
          equals: input.normalizedRegion,
          mode: 'insensitive',
        },
        OR: namePredicates,
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (company) {
      return company;
    }
  }

  const phones = getCompanyMatchPhones(input.contactRows);
  if (namePredicates.length > 0 && phones.length > 0) {
    const company = await tx.company.findFirst({
      where: {
        OR: namePredicates,
        companyContacts: {
          some: {
            type: {
              in: [
                CONTACT_TYPE.TEL,
                CONTACT_TYPE.HOTLINE,
                CONTACT_TYPE.CONTACT_PERSON,
              ],
            },
            value: {
              in: phones,
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (company) {
      return company;
    }
  }

  return null;
}

async function loadCompanies(inputPath: string): Promise<JsonCompany[]> {
  const raw = await readFile(inputPath, 'utf8');
  return JSON.parse(raw) as JsonCompany[];
}

function printSummary(
  summary: ImportSummary,
  companiesProcessed: number,
): void {
  const companiesImported =
    summary.companiesInserted + summary.companiesUpdated;
  const userOutcomesTotal =
    summary.usersCreated +
    summary.existingUsersLinked +
    summary.existingUsersReused +
    summary.userEmailConflictsSkipped;
  const companiesWithoutProvisionedUser = Math.max(
    companiesImported - userOutcomesTotal,
    0,
  );
  const formatNumber = (value: number): string => value.toLocaleString('en-US');

  console.log('Company import completed.');
  console.log('');
  console.log('Company summary');
  console.log(`  Total companies processed: ${formatNumber(companiesProcessed)}`);
  console.log(
    `  New companies inserted: ${formatNumber(summary.companiesInserted)}`,
  );
  console.log(
    `  Existing companies updated: ${formatNumber(summary.companiesUpdated)}`,
  );
  console.log(
    `  Total companies imported: ${formatNumber(companiesImported)}`,
  );
  console.log('');
  console.log('Contact summary');
  console.log(
    `  Total contact records created: ${formatNumber(summary.contactsCreated)}`,
  );
  console.log('');
  console.log('User account summary');
  console.log(
    `  New user accounts created: ${formatNumber(summary.usersCreated)}`,
  );
  console.log(
    `  Existing user accounts linked: ${formatNumber(summary.existingUsersLinked)}`,
  );
  console.log(
    `  Existing linked accounts already reused: ${formatNumber(summary.existingUsersReused)}`,
  );
  console.log(
    `  User provisioning skipped due to email conflict: ${formatNumber(summary.userEmailConflictsSkipped)}`,
  );
  console.log(
    `  Companies imported without a provisioned user: ${formatNumber(companiesWithoutProvisionedUser)}`,
  );
  console.log(
    `  Set-password emails sent: ${formatNumber(summary.setPasswordEmailsSent)}`,
  );
}

function updateUserSummary(
  summary: ImportSummary,
  result: ProvisionCompanyUserResult,
): void {
  if (result.setPasswordEmailSent) {
    summary.setPasswordEmailsSent += 1;
  }
  switch (result.status) {
    case 'created':
      summary.usersCreated += 1;
      return;
    case 'linked_existing':
      summary.existingUsersLinked += 1;
      return;
    case 'existing_same_company':
      summary.existingUsersReused += 1;
      return;
    case 'conflict_other_company':
      summary.userEmailConflictsSkipped += 1;
      console.warn(
        [
          'Skipped user provisioning due to email conflict:',
          `email=${result.email}`,
          `existingCompanyId=${result.companyId ?? 'null'}`,
          `targetCompanyId=${result.conflictingCompanyId}`,
        ].join(' '),
      );
      return;
  }
}

async function main(): Promise<void> {
  const inputPath = resolve(process.cwd(), process.argv[2] ?? DEFAULT_INPUT);
  const app = await NestFactory.createApplicationContext(CompanyImportModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const prisma = app.get(PrismaService);
    const authService = app.get(AuthService);
    const companies = await loadCompanies(inputPath);
    const sendSetPasswordEmails =
      process.env.IMPORT_SEND_SET_PASSWORD_EMAILS === 'true';
    const summary: ImportSummary = {
      companiesInserted: 0,
      companiesUpdated: 0,
      contactsCreated: 0,
      usersCreated: 0,
      existingUsersLinked: 0,
      existingUsersReused: 0,
      userEmailConflictsSkipped: 0,
      setPasswordEmailsSent: 0,
    };
    const errors: Array<{
      index: number;
      name: string | null;
      error: unknown;
    }> = [];

    console.log(`Importing ${companies.length} companies from ${inputPath}`);
    console.log(
      `Set-password email sending: ${sendSetPasswordEmails ? 'enabled' : 'disabled'}`,
    );

    for (let i = 0; i < companies.length; i++) {
      const company = companies[i];
      const taxId = normalizeOptionalString(company.taxId);
      const contactRows = buildCompanyContactRows(company);
      const companyEmail = getPrimaryCompanyEmail(company);
      const sourceCompanyId = normalizeUuid(company.id);
      const companyData = {
        importKey: sourceCompanyId,
        companyNameVi: normalizeOptionalString(company.companyNameVi),
        companyNameZh: normalizeOptionalString(company.companyNameZh),
        companyNameEn: normalizeOptionalString(company.companyNameEn),
        taxId,
        country: normalizeOptionalString(company.country),
        region: normalizeRegion(normalizeOptionalString(company.region)),
        industry: (company.industries ?? [])
          .map((value) => value.trim())
          .filter((value) => value.length > 0),
        description: normalizeOptionalString(company.description) ?? '',
        status: CompanyProfileRequestStatus.APPROVED,
      };

      let importedCompany: { id: string };
      try {
        importedCompany = await prisma.$transaction(async (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => {
          const lockKey = buildCompanyImportLockKey({
            company,
            companyEmail,
            contactRows,
            normalizedRegion: companyData.region,
          });
          await acquireCompanyImportLock(tx, lockKey);

          const existingCompany = await findExistingCompanyForImport(tx, {
            company,
            companyEmail,
            contactRows,
            normalizedRegion: companyData.region,
          });

          const savedCompany = existingCompany
            ? await tx.company.update({
                where: { id: existingCompany.id },
                data: companyData,
                select: { id: true },
              })
            : await tx.company.create({
                data: companyData,
                select: { id: true },
              });

          if (existingCompany) {
            summary.companiesUpdated += 1;
          } else {
            summary.companiesInserted += 1;
          }

          await tx.companyContact.deleteMany({
            where: { companyId: savedCompany.id },
          });

          if (contactRows.length > 0) {
            const created = await tx.companyContact.createMany({
              data: contactRows.map((row) => ({
                companyId: savedCompany.id,
                type: row.type,
                value: row.value,
                contactName: row.contactName,
              })),
            });
            summary.contactsCreated += created.count;
          }

          return savedCompany;
        });
      } catch (err) {
        const name =
          company.companyNameZh ??
          company.companyNameEn ??
          company.companyNameVi ??
          null;
        errors.push({ index: i, name, error: err });
        console.error(
          `[${i}] Failed to import company "${name ?? 'unknown'}":`,
          err,
        );
        continue;
      }

      const allEmails = contactRows
        .filter((row) => row.type === CONTACT_TYPE.EMAIL)
        .map((row) => row.value);

      for (const email of allEmails) {
        const result = await authService.provisionImportedCompanyUser({
          companyId: importedCompany.id,
          industry: companyData.industry,
          email,
          sendSetPasswordEmail: sendSetPasswordEmails,
        });
        updateUserSummary(summary, result);
        if (result.status !== 'conflict_other_company') {
          await prisma.companyContact.create({
            data: {
              companyId: importedCompany.id,
              type: CONTACT_TYPE.REGISTER_EMAIL,
              value: email,
              contactName: null,
            },
          });
          break;
        }
      }
    }

    printSummary(summary, companies.length);
    if (errors.length > 0) {
      console.error(`\n${errors.length} companies failed to import:`);
      for (const { index, name, error } of errors) {
        console.error(`  [${index}] "${name ?? 'unknown'}":`, error);
      }
      process.exitCode = 1;
    }
  } finally {
    await app.close();
  }
}

void main().catch((error: unknown) => {
  console.error('Company import failed.');
  console.error(error);
  process.exitCode = 1;
});
