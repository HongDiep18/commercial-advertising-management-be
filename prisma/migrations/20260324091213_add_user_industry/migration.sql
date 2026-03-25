-- AlterTable
ALTER TABLE "users" ADD COLUMN     "industries_selected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "primary_industry" VARCHAR(64),
ADD COLUMN     "selected_industries" TEXT[] DEFAULT ARRAY[]::TEXT[];
