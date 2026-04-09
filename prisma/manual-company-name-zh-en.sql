DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'companies'
      AND column_name = 'company_name_cn'
  ) THEN
    EXECUTE 'ALTER TABLE "public"."companies" RENAME COLUMN "company_name_cn" TO "company_name_zh"';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'companies'
      AND column_name = 'company_name_en'
  ) THEN
    EXECUTE 'ALTER TABLE "public"."companies" ADD COLUMN "company_name_en" VARCHAR(255)';
  END IF;
END $$;
