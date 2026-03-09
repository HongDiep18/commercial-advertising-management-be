
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'companies'
      AND column_name = 'contactName'
  ) THEN
    EXECUTE 'ALTER TABLE "companies" RENAME COLUMN "contactName" TO "contact_name"';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'companies'
      AND column_name = 'contact_person'
  ) THEN
    EXECUTE 'ALTER TABLE "companies" RENAME COLUMN "contact_person" TO "contact_name"';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'companies'
      AND column_name = 'contact_name'
  ) THEN
    EXECUTE 'ALTER TABLE "companies" ADD COLUMN "contact_name" VARCHAR(255)';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'companies'
      AND column_name = 'contact_phone'
  ) THEN
    EXECUTE 'ALTER TABLE "companies" ADD COLUMN "contact_phone" VARCHAR(32)';
  END IF;
END $$;

