-- CreateTable
CREATE TABLE "news_articles" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sourceSite" VARCHAR(64) NOT NULL,
    "sourceCategory" VARCHAR(256),
    "url" VARCHAR(2048) NOT NULL,
    "guid" VARCHAR(512),
    "title" VARCHAR(1024) NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "thumbnailUrl" VARCHAR(2048),
    "language" VARCHAR(16) NOT NULL DEFAULT 'vi',
    "contentText" TEXT,
    "rawHtml" TEXT,
    "status" VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
    "aiSummaryVi" TEXT,
    "aiSummaryZhTw" TEXT,
    "aiSummaryEn" TEXT,
    "aiModel" VARCHAR(128),
    "summarizedAt" TIMESTAMP(3),

    CONSTRAINT "news_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_tags" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "slug" VARCHAR(128) NOT NULL,
    "name" VARCHAR(256) NOT NULL,

    CONSTRAINT "news_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_article_tags" (
    "articleId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "news_article_tags_pkey" PRIMARY KEY ("articleId","tagId")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "role" VARCHAR(32) NOT NULL DEFAULT 'MEMBER',
    "firstName" VARCHAR(100),
    "lastName" VARCHAR(100),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "membershipTier" VARCHAR(32),
    "loyaltyPoints" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "news_articles_url_key" ON "news_articles"("url");

-- CreateIndex
CREATE INDEX "news_articles_sourceSite_idx" ON "news_articles"("sourceSite");

-- CreateIndex
CREATE INDEX "news_articles_guid_idx" ON "news_articles"("guid");

-- CreateIndex
CREATE UNIQUE INDEX "news_tags_slug_key" ON "news_tags"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- AddForeignKey
ALTER TABLE "news_article_tags" ADD CONSTRAINT "news_article_tags_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "news_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_article_tags" ADD CONSTRAINT "news_article_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "news_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
