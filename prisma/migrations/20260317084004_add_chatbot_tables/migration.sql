-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- AlterTable
ALTER TABLE "company_profile_requests" ALTER COLUMN "membershipTier" SET DEFAULT 'BRONZE';

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "membershipTier" SET DEFAULT 'BRONZE';

-- CreateTable
CREATE TABLE "crawled_pages" (
    "id" UUID NOT NULL,
    "source_url" VARCHAR(512) NOT NULL,
    "page_title" VARCHAR(255) NOT NULL,
    "content_hash" VARCHAR(64) NOT NULL,
    "crawled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crawled_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_chunks" (
    "id" UUID NOT NULL,
    "source_url" VARCHAR(512) NOT NULL,
    "page_title" VARCHAR(255) NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1536) NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "crawled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "guest_id" VARCHAR(255),
    "messages" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "crawled_pages_source_url_key" ON "crawled_pages"("source_url");

-- CreateIndex
CREATE INDEX "document_chunks_source_url_idx" ON "document_chunks"("source_url");

-- CreateIndex
CREATE UNIQUE INDEX "chat_sessions_user_id_key" ON "chat_sessions"("user_id");

-- CreateIndex
CREATE INDEX "chat_sessions_guest_id_idx" ON "chat_sessions"("guest_id");

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
