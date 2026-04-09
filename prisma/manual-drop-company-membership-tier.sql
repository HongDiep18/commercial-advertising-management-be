-- Single source of truth: users.membership_tier. Drop duplicate on companies if present.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'companies'
      AND column_name = 'membership_tier'
  ) THEN
    EXECUTE 'ALTER TABLE "public"."companies" DROP COLUMN "membership_tier"';
  END IF;
END $$;
