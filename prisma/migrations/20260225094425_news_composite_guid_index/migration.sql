/*
  Warnings:

  - The `status` column on the `news_articles` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "NewsArticleStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- DropIndex
DROP INDEX "news_articles_guid_idx";

-- AlterTable
ALTER TABLE "news_articles" DROP COLUMN "status",
ADD COLUMN     "status" "NewsArticleStatus" NOT NULL DEFAULT 'DRAFT';

-- CreateIndex
CREATE INDEX "news_articles_sourceSite_guid_idx" ON "news_articles"("sourceSite", "guid");
