DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'companies'
      AND column_name = 'industry'
      AND data_type <> 'ARRAY'
  ) THEN
    ALTER TABLE "public"."companies"
      ALTER COLUMN "industry" TYPE VARCHAR(255)[]
      USING CASE
        WHEN "industry" IS NULL OR btrim("industry") = '' THEN ARRAY[]::VARCHAR(255)[]
        ELSE ARRAY["industry"]::VARCHAR(255)[]
      END;
  END IF;
END $$;
