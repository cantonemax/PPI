ALTER TABLE "Part" ADD COLUMN IF NOT EXISTS "familyId" TEXT;

CREATE TABLE IF NOT EXISTS "ProductFamily" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  CONSTRAINT "ProductFamily_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FamilyDimension" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "familyId" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "dimensionName" TEXT NOT NULL,
  "nominal" DECIMAL(18,6) NOT NULL,
  "tolerance" DECIMAL(18,6) NOT NULL,
  "frequency" INTEGER NOT NULL,
  "markerX" DECIMAL(18,6) NOT NULL,
  "markerY" DECIMAL(18,6) NOT NULL,
  CONSTRAINT "FamilyDimension_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ArticleDimension" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "partId" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "dimensionName" TEXT NOT NULL,
  "nominal" DECIMAL(18,6) NOT NULL,
  "tolerance" DECIMAL(18,6) NOT NULL,
  "lowerLimit" DECIMAL(18,6) NOT NULL,
  "upperLimit" DECIMAL(18,6) NOT NULL,
  "frequency" INTEGER NOT NULL,
  "markerX" DECIMAL(18,6) NOT NULL,
  "markerY" DECIMAL(18,6) NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "ArticleDimension_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProductFamily_companyId_key_key" ON "ProductFamily"("companyId", "key");
CREATE INDEX IF NOT EXISTS "ProductFamily_companyId_idx" ON "ProductFamily"("companyId");
CREATE UNIQUE INDEX IF NOT EXISTS "FamilyDimension_familyId_reference_key" ON "FamilyDimension"("familyId", "reference");
CREATE INDEX IF NOT EXISTS "FamilyDimension_companyId_idx" ON "FamilyDimension"("companyId");
CREATE UNIQUE INDEX IF NOT EXISTS "ArticleDimension_partId_reference_key" ON "ArticleDimension"("partId", "reference");
CREATE INDEX IF NOT EXISTS "ArticleDimension_companyId_idx" ON "ArticleDimension"("companyId");
CREATE INDEX IF NOT EXISTS "Part_familyId_idx" ON "Part"("familyId");

DO $$ BEGIN
  ALTER TABLE "ProductFamily" ADD CONSTRAINT "ProductFamily_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "FamilyDimension" ADD CONSTRAINT "FamilyDimension_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "FamilyDimension" ADD CONSTRAINT "FamilyDimension_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "ProductFamily"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ArticleDimension" ADD CONSTRAINT "ArticleDimension_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ArticleDimension" ADD CONSTRAINT "ArticleDimension_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Part" ADD CONSTRAINT "Part_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "ProductFamily"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
