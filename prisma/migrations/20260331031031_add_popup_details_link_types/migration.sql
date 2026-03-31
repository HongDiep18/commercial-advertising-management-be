-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AdPackageType" ADD VALUE 'popup_priority_details_link';
ALTER TYPE "AdPackageType" ADD VALUE 'popup_rotation_details_link';

-- AlterTable
ALTER TABLE "notifications" ALTER COLUMN "updated_at" DROP DEFAULT;

UPDATE ad_packages SET is_active = false WHERE type = 'popup_view_details_link';
