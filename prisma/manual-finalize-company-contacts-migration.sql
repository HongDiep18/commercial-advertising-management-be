CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS "public"."company_contacts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "type" VARCHAR(64) NOT NULL,
  "value" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "company_contacts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "company_contacts_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "company_contacts_company_id_idx"
  ON "public"."company_contacts" ("company_id");

CREATE INDEX IF NOT EXISTS "company_contacts_company_id_type_idx"
  ON "public"."company_contacts" ("company_id", "type");

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'email'
  ) THEN
    INSERT INTO "public"."company_contacts" ("company_id", "type", "value")
    SELECT "id", 'email', "email"
    FROM "public"."companies"
    WHERE "email" IS NOT NULL AND btrim("email") <> ''
      AND NOT EXISTS (
        SELECT 1 FROM "public"."company_contacts" cc
        WHERE cc."company_id" = "companies"."id" AND cc."type" = 'email' AND cc."value" = "companies"."email"
      );
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'phone'
  ) THEN
    INSERT INTO "public"."company_contacts" ("company_id", "type", "value")
    SELECT "id", 'phone', "phone"
    FROM "public"."companies"
    WHERE "phone" IS NOT NULL AND btrim("phone") <> ''
      AND NOT EXISTS (
        SELECT 1 FROM "public"."company_contacts" cc
        WHERE cc."company_id" = "companies"."id" AND cc."type" = 'phone' AND cc."value" = "companies"."phone"
      );
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'address'
  ) THEN
    INSERT INTO "public"."company_contacts" ("company_id", "type", "value")
    SELECT "id", 'address', "address"
    FROM "public"."companies"
    WHERE "address" IS NOT NULL AND btrim("address") <> ''
      AND NOT EXISTS (
        SELECT 1 FROM "public"."company_contacts" cc
        WHERE cc."company_id" = "companies"."id" AND cc."type" = 'address' AND cc."value" = "companies"."address"
      );
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'tax_id'
  ) THEN
    INSERT INTO "public"."company_contacts" ("company_id", "type", "value")
    SELECT "id", 'tax_id', "tax_id"
    FROM "public"."companies"
    WHERE "tax_id" IS NOT NULL AND btrim("tax_id") <> ''
      AND NOT EXISTS (
        SELECT 1 FROM "public"."company_contacts" cc
        WHERE cc."company_id" = "companies"."id" AND cc."type" = 'tax_id' AND cc."value" = "companies"."tax_id"
      );
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'website'
  ) THEN
    INSERT INTO "public"."company_contacts" ("company_id", "type", "value")
    SELECT "id", 'website', "website"
    FROM "public"."companies"
    WHERE "website" IS NOT NULL AND btrim("website") <> ''
      AND NOT EXISTS (
        SELECT 1 FROM "public"."company_contacts" cc
        WHERE cc."company_id" = "companies"."id" AND cc."type" = 'website' AND cc."value" = "companies"."website"
      );
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'contact_name'
  ) THEN
    INSERT INTO "public"."company_contacts" ("company_id", "type", "value")
    SELECT "id", 'contact_name', "contact_name"
    FROM "public"."companies"
    WHERE "contact_name" IS NOT NULL AND btrim("contact_name") <> ''
      AND NOT EXISTS (
        SELECT 1 FROM "public"."company_contacts" cc
        WHERE cc."company_id" = "companies"."id" AND cc."type" = 'contact_name' AND cc."value" = "companies"."contact_name"
      );
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'contact_phone'
  ) THEN
    INSERT INTO "public"."company_contacts" ("company_id", "type", "value")
    SELECT "id", 'contact_phone', "contact_phone"
    FROM "public"."companies"
    WHERE "contact_phone" IS NOT NULL AND btrim("contact_phone") <> ''
      AND NOT EXISTS (
        SELECT 1 FROM "public"."company_contacts" cc
        WHERE cc."company_id" = "companies"."id" AND cc."type" = 'contact_phone' AND cc."value" = "companies"."contact_phone"
      );
  END IF;
END $$;

ALTER TABLE "public"."companies" DROP COLUMN IF EXISTS "email";
ALTER TABLE "public"."companies" DROP COLUMN IF EXISTS "phone";
ALTER TABLE "public"."companies" DROP COLUMN IF EXISTS "address";
ALTER TABLE "public"."companies" DROP COLUMN IF EXISTS "tax_id";
ALTER TABLE "public"."companies" DROP COLUMN IF EXISTS "website";
ALTER TABLE "public"."companies" DROP COLUMN IF EXISTS "contact_name";
ALTER TABLE "public"."companies" DROP COLUMN IF EXISTS "contact_phone";
