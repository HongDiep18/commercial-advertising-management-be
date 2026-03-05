-- CreateEnum
CREATE TYPE "UserProfileRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

--CreateEnum
CREATE TYPE "MembershipTier" AS ENUM ('NONE', 'BRONZE', 'SILVER', 'GOLD', 'DIAMOND');

-- CreateTable
CREATE TABLE "company_profile_requests" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp(3) NOT NULL,
    "email" varchar(255) NOT NULL,
    "companyNameVi" varchar(255) NOT NULL,
    "companyNameCn" varchar(255) NOT NULL,
    "phone" varchar(32) NOT NULL,
    "taxId" varchar(64) NOT NULL,
    "contactPerson" varchar(255) NOT NULL,
    "contactPhone" varchar(32) NOT NULL,
    "companyAddress" varchar(512) NOT NULL,
    "country" varchar(128) NOT NULL,
    "region" varchar(128) NOT NULL,
    "industry" varchar(128) NOT NULL,
    "website" varchar(2048) NOT NULL,
    "introduction" text NOT NULL,
    "captcha" varchar(32),
    "membershipLevel" "MembershipTier" NOT NULL DEFAULT 'NONE',
    "status" "UserProfileRequestStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "company_profile_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "company_profile_requests_email_idx" ON "company_profile_requests"("email");

-- CreateIndex
CREATE INDEX "company_profile_requests_status_idx" ON "company_profile_requests"("status");
