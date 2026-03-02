-- CreateTable
CREATE TABLE "news_categories" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "nameVi" VARCHAR(128) NOT NULL,
    "nameZhTw" VARCHAR(128) NOT NULL,
    "nameEn" VARCHAR(128) NOT NULL,

    CONSTRAINT "news_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_subcategories" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(128) NOT NULL,
    "nameVi" VARCHAR(256) NOT NULL,
    "nameZhTw" VARCHAR(256) NOT NULL,
    "nameEn" VARCHAR(256) NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "news_subcategories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_articles" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sourceSite" VARCHAR(64) NOT NULL,
    "url" VARCHAR(2048) NOT NULL,
    "guid" VARCHAR(512),
    "title" VARCHAR(1024) NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "thumbnailUrl" VARCHAR(2048),
    "language" VARCHAR(16) NOT NULL DEFAULT 'vi',
    "categoryId" TEXT,
    "subcategoryId" TEXT,
    "status" VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
    "summaryVi" TEXT,
    "summaryZhTw" TEXT,
    "summaryEn" TEXT,

    CONSTRAINT "news_articles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "news_categories_slug_key" ON "news_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "news_subcategories_slug_key" ON "news_subcategories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "news_articles_url_key" ON "news_articles"("url");

-- CreateIndex
CREATE INDEX "news_articles_sourceSite_idx" ON "news_articles"("sourceSite");

-- CreateIndex
CREATE INDEX "news_articles_guid_idx" ON "news_articles"("guid");

-- CreateIndex
CREATE INDEX "news_articles_categoryId_idx" ON "news_articles"("categoryId");

-- AddForeignKey
ALTER TABLE "news_subcategories" ADD CONSTRAINT "news_subcategories_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "news_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_articles" ADD CONSTRAINT "news_articles_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "news_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_articles" ADD CONSTRAINT "news_articles_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "news_subcategories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
