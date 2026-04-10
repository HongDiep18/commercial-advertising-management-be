ALTER TABLE "companies"
ADD COLUMN "import_key" VARCHAR(255),
ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX "companies_import_key_key"
ON "companies"("import_key");
