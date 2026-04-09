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
