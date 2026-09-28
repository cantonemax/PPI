ALTER TABLE "Tool" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "Tool" ADD COLUMN IF NOT EXISTS "toolFamily" TEXT;
ALTER TABLE "Tool" ADD COLUMN IF NOT EXISTS "manufacturer" TEXT;
ALTER TABLE "Tool" ADD COLUMN IF NOT EXISTS "notes" TEXT;

ALTER TABLE "Control" ADD COLUMN IF NOT EXISTS "frequency" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Control" ADD COLUMN IF NOT EXISTS "markerX" DECIMAL(18,6);
ALTER TABLE "Control" ADD COLUMN IF NOT EXISTS "markerY" DECIMAL(18,6);

CREATE TABLE IF NOT EXISTS "ArticleTool" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "partId" TEXT NOT NULL,
  "toolId" TEXT NOT NULL,
  CONSTRAINT "ArticleTool_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ArticleTool_partId_toolId_key" ON "ArticleTool"("partId", "toolId");
CREATE INDEX IF NOT EXISTS "ArticleTool_companyId_idx" ON "ArticleTool"("companyId");
CREATE INDEX IF NOT EXISTS "ArticleTool_toolId_idx" ON "ArticleTool"("toolId");

DO $$ BEGIN
  ALTER TABLE "ArticleTool" ADD CONSTRAINT "ArticleTool_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ArticleTool" ADD CONSTRAINT "ArticleTool_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ArticleTool" ADD CONSTRAINT "ArticleTool_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "Tool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
