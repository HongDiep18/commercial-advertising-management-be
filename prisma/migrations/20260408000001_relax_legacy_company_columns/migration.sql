DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'email'
  ) THEN
    EXECUTE 'ALTER TABLE "public"."companies" ALTER COLUMN "email" DROP NOT NULL';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'phone'
  ) THEN
    EXECUTE 'ALTER TABLE "public"."companies" ALTER COLUMN "phone" DROP NOT NULL';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'address'
  ) THEN
    EXECUTE 'ALTER TABLE "public"."companies" ALTER COLUMN "address" DROP NOT NULL';
  END IF;
END $$;
