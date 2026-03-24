-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('LAND', 'FACTORY', 'WAREHOUSE', 'HOUSE', 'OFFICE');

-- CreateEnum
CREATE TYPE "PropertyPublicationStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'UNPUBLISHED');

-- CreateEnum
CREATE TYPE "PropertyAvailabilityStatus" AS ENUM ('AVAILABLE', 'SOLD');

-- AlterTable
ALTER TABLE "chat_sessions" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "crawled_pages" ALTER COLUMN "id" DROP DEFAULT;

-- CreateTable
CREATE TABLE "properties" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "price" VARCHAR(128) NOT NULL,
    "type" "PropertyType" NOT NULL,
    "province" VARCHAR(128) NOT NULL,
    "province_name" VARCHAR(255) NOT NULL,
    "full_address" VARCHAR(512) NOT NULL,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "area_value" DECIMAL(12,2) NOT NULL,
    "area_unit" VARCHAR(32) NOT NULL,
    "description" TEXT NOT NULL,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "publication_status" "PropertyPublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMP(3),
    "availability_status" "PropertyAvailabilityStatus" NOT NULL DEFAULT 'AVAILABLE',
    "sold_at" TIMESTAMP(3),
    "views" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_legal_documents" (
    "id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "file_url" VARCHAR(2048) NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(128),
    "file_size_kb" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_legal_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_contact_inquiries" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "property_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "message" TEXT,

    CONSTRAINT "property_contact_inquiries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "properties_type_idx" ON "properties"("type");

-- CreateIndex
CREATE INDEX "properties_province_idx" ON "properties"("province");

-- CreateIndex
CREATE INDEX "properties_publication_status_idx" ON "properties"("publication_status");

-- CreateIndex
CREATE INDEX "properties_availability_status_idx" ON "properties"("availability_status");

-- CreateIndex
CREATE INDEX "property_legal_documents_property_id_idx" ON "property_legal_documents"("property_id");

-- CreateIndex
CREATE INDEX "property_contact_inquiries_property_id_idx" ON "property_contact_inquiries"("property_id");

-- AddForeignKey
ALTER TABLE "property_legal_documents" ADD CONSTRAINT "property_legal_documents_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_contact_inquiries" ADD CONSTRAINT "property_contact_inquiries_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
