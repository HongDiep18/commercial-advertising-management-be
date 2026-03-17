-- Add DB-level UUID default so PGVectorStore can insert without providing id
ALTER TABLE "document_chunks" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- Drop unused columns (data lives in metadata JSONB)
ALTER TABLE "document_chunks" DROP COLUMN IF EXISTS "source_url";
ALTER TABLE "document_chunks" DROP COLUMN IF EXISTS "page_title";

-- Same default fix for other chatbot tables (Prisma inserts handle them, but good practice)
ALTER TABLE "crawled_pages" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "chat_sessions" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
