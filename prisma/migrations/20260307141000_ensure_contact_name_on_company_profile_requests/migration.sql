DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'company_profile_requests'
      AND column_name = 'contactPerson'
  ) THEN
    EXECUTE 'ALTER TABLE "company_profile_requests" RENAME COLUMN "contactPerson" TO "contact_name"';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'company_profile_requests'
      AND column_name = 'contactName'
  ) THEN
    EXECUTE 'ALTER TABLE "company_profile_requests" RENAME COLUMN "contactName" TO "contact_name"';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'company_profile_requests'
      AND column_name = 'contact_name'
  ) THEN
    EXECUTE 'ALTER TABLE "company_profile_requests" ADD COLUMN "contact_name" VARCHAR(255)';
  END IF;
END $$;

