import 'reflect-metadata';

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtModule } from '@nestjs/jwt';
import { CompanyProfileRequestStatus } from '@prisma/client';
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
  providers: [
    LoyaltyService,
    CaptchaVerificationService,
    AuthService,
  ],
})
class CompanyImportModule {}

function normalizeOptionalString(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
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
      type: CONTACT_TYPE.TEL,
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
    if (normalizeOptionalString(contact.type)?.toLowerCase() !== CONTACT_TYPE.EMAIL) {
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

async function loadCompanies(inputPath: string): Promise<JsonCompany[]> {
  const raw = await readFile(inputPath, 'utf8');
  return JSON.parse(raw) as JsonCompany[];
}

function printSummary(summary: ImportSummary, companiesProcessed: number): void {
  console.log('Company import completed.');
  console.log(`  Companies processed: ${companiesProcessed}`);
  console.log(`  Companies inserted: ${summary.companiesInserted}`);
  console.log(`  Companies updated: ${summary.companiesUpdated}`);
  console.log(`  Contacts created: ${summary.contactsCreated}`);
  console.log(`  Users created: ${summary.usersCreated}`);
  console.log(`  Existing users linked: ${summary.existingUsersLinked}`);
  console.log(`  Existing users reused: ${summary.existingUsersReused}`);
  console.log(
    `  User-email conflicts skipped: ${summary.userEmailConflictsSkipped}`,
  );
  console.log(`  Set-password emails sent: ${summary.setPasswordEmailsSent}`);
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

    console.log(`Importing ${companies.length} companies from ${inputPath}`);
    console.log(
      `Set-password email sending: ${sendSetPasswordEmails ? 'enabled' : 'disabled'}`,
    );

    for (const company of companies) {
      const taxId = normalizeOptionalString(company.taxId);
      const contactRows = buildCompanyContactRows(company);
      const companyEmail = getPrimaryCompanyEmail(company);
      const companyMatchName = getCompanyMatchName(company);
      const companyMatchRegion = normalizeMatchKey(company.region);
      const companyData = {
        companyNameVi: normalizeOptionalString(company.companyNameVi),
        companyNameZh: normalizeOptionalString(company.companyNameZh),
        companyNameEn: normalizeOptionalString(company.companyNameEn),
        taxId,
        country: normalizeOptionalString(company.country),
        region: normalizeOptionalString(company.region),
        industry:
          (company.industries ?? [])
            .map((value) => value.trim())
            .filter((value) => value.length > 0) || [],
        description: normalizeOptionalString(company.description) ?? '',
        status: CompanyProfileRequestStatus.APPROVED,
      };

      const importedCompany = await prisma.$transaction(async (tx) => {
        let existingCompany = taxId
          ? await tx.company.findFirst({
              where: { taxId },
              select: { id: true },
            })
          : null;

        if (!existingCompany && !taxId && companyEmail) {
          existingCompany = await tx.company.findFirst({
            where: {
              companyContacts: {
                some: {
                  type: CONTACT_TYPE.EMAIL,
                  value: companyEmail,
                },
              },
            },
            select: { id: true },
          });
        }

        if (
          !existingCompany &&
          !taxId &&
          companyMatchName &&
          companyMatchRegion
        ) {
          existingCompany = await tx.company.findFirst({
            where: {
              region: company.region,
              OR: [
                { companyNameZh: company.companyNameZh ?? undefined },
                { companyNameEn: company.companyNameEn ?? undefined },
                { companyNameVi: company.companyNameVi ?? undefined },
              ].filter(
                (
                  value,
                ): value is
                  | { companyNameZh: string }
                  | { companyNameEn: string }
                  | { companyNameVi: string } => {
                  const raw = Object.values(value)[0];
                  return typeof raw === 'string' && raw.trim().length > 0;
                },
              ),
            },
            select: { id: true },
          });
        }

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

      if (!companyEmail) {
        continue;
      }

      const result = await authService.provisionImportedCompanyUser({
        companyId: importedCompany.id,
        industry: companyData.industry,
        email: companyEmail,
        sendSetPasswordEmail: sendSetPasswordEmails,
      });
      updateUserSummary(summary, result);
    }

    printSummary(summary, companies.length);
  } finally {
    await app.close();
  }
}

void main().catch((error: unknown) => {
  console.error('Company import failed.');
  console.error(error);
  process.exitCode = 1;
});
