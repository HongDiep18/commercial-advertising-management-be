-- AlterTable: company_profile_requests: rename contactPerson to contact_name
-- Prisma field stays `contactName`, DB column is `contact_name`
ALTER TABLE "company_profile_requests" RENAME COLUMN "contactPerson" TO "contact_name";

-- companies: column is already "contact_name" from 20260306073116; schema @map("contact_name"), so no change
