-- AlterTable: company_profile_requests: rename contactPerson to contactName
ALTER TABLE "company_profile_requests" RENAME COLUMN "contactPerson" TO "contactName";

-- companies: column is already "contact_name" from 20260306073116; schema @map("contact_name"), so no change
