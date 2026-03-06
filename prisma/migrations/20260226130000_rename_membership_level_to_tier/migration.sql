-- 0) Rename enum so Prisma (UserProfileRequestStatus) matches DB
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'CompanyProfileRequestStatus'
  ) THEN
    ALTER TYPE "CompanyProfileRequestStatus" RENAME TO "UserProfileRequestStatus";
  END IF;
END $$;

-- 1) Ensure table is user_profile_requests (rename if still company_profile_requests)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'company_profile_requests'
  ) THEN
    ALTER TABLE "company_profile_requests" RENAME TO "user_profile_requests";
  END IF;
END $$;

-- 2) Alter membershipLevel -> membershipTier (only if column still exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_profile_requests'
      AND column_name = 'membershipLevel'
  ) THEN
    ALTER TABLE "user_profile_requests" RENAME COLUMN "membershipLevel" TO "membershipTier";
  END IF;
END $$;
