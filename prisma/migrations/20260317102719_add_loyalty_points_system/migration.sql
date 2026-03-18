-- AlterTable
ALTER TABLE "company_profile_requests" ALTER COLUMN "membershipTier" SET DEFAULT 'BRONZE';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "total_spending" BIGINT NOT NULL DEFAULT 0,
ALTER COLUMN "membershipTier" SET DEFAULT 'BRONZE';

-- CreateTable
CREATE TABLE "points_transactions" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" UUID NOT NULL,
    "points" INTEGER NOT NULL,
    "balance" INTEGER NOT NULL,
    "source" VARCHAR(64) NOT NULL,
    "description" VARCHAR(512) NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "points_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "points_transactions_user_id_created_at_idx" ON "points_transactions"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "points_transactions_source_idx" ON "points_transactions"("source");

-- AddForeignKey
ALTER TABLE "points_transactions" ADD CONSTRAINT "points_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
