/*
  Warnings:

  - The `membershipTier` column on the `users` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `user_profile_requests` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user_profiles` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "CompanyProfileRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AdCategoryType" AS ENUM ('homepage_popup', 'featured_company', 'company_directory', 'platform_print', 'product_listing');

-- CreateEnum
CREATE TYPE "AdPackageType" AS ENUM ('popup_priority_slot', 'popup_rotation_slot', 'popup_view_details_link', 'popup_ranking_adjustment', 'featured_homepage_display', 'featured_highlight_boost', 'company_category_top', 'company_info_highlight', 'print_placement', 'listing_basic_plan', 'listing_advanced_plan', 'listing_boost_homepage', 'listing_boost_category');

-- CreateEnum
CREATE TYPE "DurationUnit" AS ENUM ('day', 'week', 'month', 'year');

-- CreateEnum
CREATE TYPE "PricingModel" AS ENUM ('duration', 'one_time', 'per_action');

-- CreateEnum
CREATE TYPE "AdOrderStatus" AS ENUM ('draft', 'submitted', 'pending', 'approved', 'rejected');

-- DropForeignKey
ALTER TABLE "user_profiles" DROP CONSTRAINT "user_profiles_userId_fkey";

-- AlterTable
ALTER TABLE "news_articles" ADD COLUMN     "tags" TEXT[];

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "company_id" UUID,
ALTER COLUMN "id" DROP DEFAULT,
DROP COLUMN "membershipTier",
ADD COLUMN     "membershipTier" "MembershipTier" NOT NULL DEFAULT 'NONE';

-- DropTable
DROP TABLE "user_profile_requests";

-- DropTable
DROP TABLE "user_profiles";

-- DropEnum
DROP TYPE "UserProfileRequestStatus";

-- CreateTable
CREATE TABLE "company_profile_requests" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "companyNameVi" VARCHAR(255) NOT NULL,
    "companyNameCn" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(32) NOT NULL,
    "taxId" VARCHAR(64) NOT NULL,
    "contactPerson" VARCHAR(255) NOT NULL,
    "contactPhone" VARCHAR(32) NOT NULL,
    "companyAddress" VARCHAR(512) NOT NULL,
    "country" VARCHAR(128) NOT NULL,
    "region" VARCHAR(128) NOT NULL,
    "industry" VARCHAR(128) NOT NULL,
    "website" VARCHAR(2048) NOT NULL,
    "introduction" TEXT NOT NULL,
    "captcha" VARCHAR(32),
    "membershipTier" "MembershipTier" NOT NULL DEFAULT 'NONE',
    "status" "CompanyProfileRequestStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "company_profile_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "contact_name" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(50) NOT NULL,
    "industry" VARCHAR(255) NOT NULL,
    "address" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "logo_url" VARCHAR(2048),
    "company_name_vi" VARCHAR(255),
    "company_name_cn" VARCHAR(255),
    "tax_id" VARCHAR(64),
    "country" VARCHAR(128),
    "region" VARCHAR(128),
    "website" VARCHAR(2048),

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_package_categories" (
    "id" UUID NOT NULL,
    "type" "AdCategoryType" NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "name_zh" VARCHAR(255),
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_package_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_packages" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "type" "AdPackageType" NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "name_zh" VARCHAR(255),
    "description" TEXT,
    "pricing_model" "PricingModel" NOT NULL,
    "metadata" JSONB DEFAULT '{}',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_package_pricing" (
    "id" UUID NOT NULL,
    "package_id" UUID NOT NULL,
    "pricing_model" "PricingModel" NOT NULL,
    "duration_value" INTEGER,
    "duration_unit" "DurationUnit",
    "base_price" BIGINT NOT NULL,
    "discount_rate" DECIMAL(65,30) NOT NULL DEFAULT 0.0,
    "final_price" BIGINT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_package_pricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_orders" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "company_id" UUID,
    "status" "AdOrderStatus" NOT NULL DEFAULT 'draft',
    "subtotal" BIGINT NOT NULL DEFAULT 0,
    "notes" TEXT,
    "submitted_at" TIMESTAMP(3),
    "last_updated_by" UUID,
    "last_updated_at" TIMESTAMP(3),
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "package_id" UUID NOT NULL,
    "pricing_id" UUID NOT NULL,
    "duration_value" INTEGER,
    "duration_unit" "DurationUnit",
    "start_date" TIMESTAMP(3) NOT NULL,
    "design_service_required" BOOLEAN NOT NULL DEFAULT false,
    "ad_link_url" VARCHAR(2048) NOT NULL,
    "unit_price" BIGINT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "line_total" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_order_assets" (
    "id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "asset_type" VARCHAR(50) NOT NULL,
    "file_url" VARCHAR(500),
    "file_size_kb" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_order_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "active_ads" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "order_id" UUID,
    "order_item_id" UUID,
    "pricing_id" UUID NOT NULL,
    "package_type" "AdPackageType" NOT NULL,
    "pricing_model" "PricingModel" NOT NULL,
    "ad_link_url" VARCHAR(2048),
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "total_quantity" INTEGER,
    "used_quantity" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "completed_at" TIMESTAMP(3),
    "approved_by" UUID NOT NULL,
    "approved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "active_ads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "active_ad_assets" (
    "id" UUID NOT NULL,
    "active_ad_id" UUID NOT NULL,
    "asset_type" VARCHAR(50) NOT NULL,
    "file_url" VARCHAR(500),
    "file_size_kb" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "active_ad_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "company_profile_requests_email_idx" ON "company_profile_requests"("email");

-- CreateIndex
CREATE INDEX "company_profile_requests_status_idx" ON "company_profile_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "companies_email_key" ON "companies"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ad_package_categories_type_key" ON "ad_package_categories"("type");

-- CreateIndex
CREATE UNIQUE INDEX "ad_order_items_order_id_pricing_id_key" ON "ad_order_items"("order_id", "pricing_id");

-- CreateIndex
CREATE INDEX "idx_active_ads_company_type" ON "active_ads"("company_id", "package_type");

-- CreateIndex
CREATE INDEX "idx_active_ads_dates" ON "active_ads"("start_date", "end_date", "is_active");

-- CreateIndex
CREATE INDEX "idx_active_ads_model" ON "active_ads"("pricing_model", "is_active");

-- CreateIndex
CREATE INDEX "idx_active_ads_pricing_active" ON "active_ads"("pricing_id", "is_active");

-- CreateIndex
CREATE INDEX "idx_active_ad_assets_active_ad" ON "active_ad_assets"("active_ad_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_packages" ADD CONSTRAINT "ad_packages_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "ad_package_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_package_pricing" ADD CONSTRAINT "ad_package_pricing_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "ad_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_orders" ADD CONSTRAINT "ad_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_orders" ADD CONSTRAINT "ad_orders_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_order_items" ADD CONSTRAINT "ad_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "ad_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_order_items" ADD CONSTRAINT "ad_order_items_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "ad_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_order_items" ADD CONSTRAINT "ad_order_items_pricing_id_fkey" FOREIGN KEY ("pricing_id") REFERENCES "ad_package_pricing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_order_assets" ADD CONSTRAINT "ad_order_assets_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "ad_order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "active_ads" ADD CONSTRAINT "active_ads_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "active_ads" ADD CONSTRAINT "active_ads_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "ad_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "active_ads" ADD CONSTRAINT "active_ads_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "ad_order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "active_ads" ADD CONSTRAINT "active_ads_pricing_id_fkey" FOREIGN KEY ("pricing_id") REFERENCES "ad_package_pricing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "active_ad_assets" ADD CONSTRAINT "active_ad_assets_active_ad_id_fkey" FOREIGN KEY ("active_ad_id") REFERENCES "active_ads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
