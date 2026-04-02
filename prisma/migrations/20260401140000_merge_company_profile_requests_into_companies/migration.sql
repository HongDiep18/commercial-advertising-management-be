-- Merge workflow into companies; drop company_profile_requests.

ALTER TABLE "companies" ALTER COLUMN "address" TYPE VARCHAR(512);

ALTER TABLE "companies" ADD COLUMN "registration_status" "CompanyProfileRequestStatus" NOT NULL DEFAULT 'APPROVED';
ALTER TABLE "companies" ADD COLUMN "membership_tier" "MembershipTier" NOT NULL DEFAULT 'BRONZE';
ALTER TABLE "companies" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "companies" SET "updated_at" = "created_at";

-- Merge request data into existing companies (same email)
UPDATE "companies" c
SET
  "registration_status" = r."status",
  "membership_tier" = r."membershipTier",
  "company_name_vi" = r."companyNameVi",
  "company_name_cn" = r."companyNameCn",
  "phone" = SUBSTRING(r.phone FROM 1 FOR 50),
  "tax_id" = r."taxId",
  "contact_name" = r."contact_name",
  "contact_phone" = r."contactPhone",
  "address" = SUBSTRING(r."companyAddress" FROM 1 FOR 512),
  "country" = r.country,
  "region" = r.region,
  "industry" = r.industry,
  "website" = r.website,
  "description" = r.introduction,
  "updated_at" = r."updatedAt"
FROM "company_profile_requests" r
WHERE LOWER(TRIM(c.email)) = LOWER(TRIM(r.email));

INSERT INTO "companies" (
  "id",
  "email",
  "phone",
  "industry",
  "address",
  "description",
  "created_at",
  "updated_at",
  "registration_status",
  "membership_tier",
  "logo_url",
  "company_name_vi",
  "company_name_cn",
  "tax_id",
  "country",
  "region",
  "website",
  "contact_name",
  "contact_phone"
)
SELECT
  gen_random_uuid(),
  LOWER(TRIM(r.email)),
  SUBSTRING(r.phone FROM 1 FOR 50),
  r.industry,
  SUBSTRING(r."companyAddress" FROM 1 FOR 512),
  r.introduction,
  r."createdAt",
  r."updatedAt",
  r."status",
  r."membershipTier",
  NULL,
  r."companyNameVi",
  r."companyNameCn",
  r."taxId",
  r.country,
  r.region,
  r.website,
  r."contact_name",
  r."contactPhone"
FROM "company_profile_requests" r
WHERE NOT EXISTS (
  SELECT 1 FROM "companies" c WHERE LOWER(TRIM(c.email)) = LOWER(TRIM(r.email))
);

DROP TABLE "company_profile_requests";

CREATE INDEX "companies_registration_status_idx" ON "companies"("registration_status");
