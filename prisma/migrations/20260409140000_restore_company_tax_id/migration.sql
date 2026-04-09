-- Restore tax_id as a dedicated column on companies (not an EAV contact row).
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "tax_id" VARCHAR(64);

-- Copy existing tax_id values back from company_contacts.
UPDATE "companies" c
SET "tax_id" = cc."value"
FROM "company_contacts" cc
WHERE cc."company_id" = c."id"
  AND cc."type" = 'tax_id'
  AND btrim(cc."value") <> '';

-- Remove tax_id rows from company_contacts — no longer stored there.
DELETE FROM "company_contacts" WHERE "type" = 'tax_id';
