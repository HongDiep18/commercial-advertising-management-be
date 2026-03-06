-- CreateTable
CREATE TABLE "user_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "logoUrl" VARCHAR(2048),
    "companyNameVi" VARCHAR(255),
    "companyNameCn" VARCHAR(255),
    "phone" VARCHAR(32),
    "taxId" VARCHAR(64),
    "contactPerson" VARCHAR(255),
    "contactPhone" VARCHAR(32),
    "companyAddress" VARCHAR(512),
    "email" VARCHAR(255),          
    "country" VARCHAR(128),
    "region" VARCHAR(128),
    "industry" VARCHAR(128),
    "website" VARCHAR(2048),
    "introduction" TEXT,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);
-- one profile per user
CREATE UNIQUE INDEX "user_profiles_userId_key" ON "user_profiles"("userId");

-- link to users table
ALTER TABLE "user_profiles"
ADD CONSTRAINT "user_profiles_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;