-- Add person/label name on each channel row; legacy "contact_name" was stored as type = 'contact_name'.

ALTER TABLE "company_contacts" ADD COLUMN "contact_name" VARCHAR(255);

-- Copy first legacy contact_name row per company onto all other channel rows.
WITH first_legacy AS (
  SELECT DISTINCT ON ("company_id")
    "company_id",
    "value"
  FROM "company_contacts"
  WHERE "type" = 'contact_name'
  ORDER BY "company_id", "created_at" ASC
)
UPDATE "company_contacts" AS cc
SET "contact_name" = fl."value"
FROM first_legacy AS fl
WHERE cc."company_id" = fl."company_id"
  AND cc."type" <> 'contact_name';

-- Remove legacy EAV rows for contact person name.
DELETE FROM "company_contacts" WHERE "type" = 'contact_name';
