-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "company_contacts" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;
