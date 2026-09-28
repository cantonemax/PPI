ALTER TABLE "ProductionOrder" ADD COLUMN IF NOT EXISTS "code" TEXT;
ALTER TABLE "ProductionOrder" ADD COLUMN IF NOT EXISTS "assignedOperatorId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "ProductionOrder_companyId_code_key" ON "ProductionOrder"("companyId", "code");
DO $$ BEGIN
  ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_assignedOperatorId_fkey" FOREIGN KEY ("assignedOperatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "FamilyDimension" ADD COLUMN IF NOT EXISTS "toleranceKind" TEXT NOT NULL DEFAULT 'symmetric';
ALTER TABLE "FamilyDimension" ADD COLUMN IF NOT EXISTS "upperDeviation" DECIMAL(18,6);
ALTER TABLE "FamilyDimension" ADD COLUMN IF NOT EXISTS "lowerDeviation" DECIMAL(18,6);

ALTER TABLE "ArticleDimension" ADD COLUMN IF NOT EXISTS "toleranceKind" TEXT NOT NULL DEFAULT 'symmetric';
ALTER TABLE "ArticleDimension" ADD COLUMN IF NOT EXISTS "upperDeviation" DECIMAL(18,6);
ALTER TABLE "ArticleDimension" ADD COLUMN IF NOT EXISTS "lowerDeviation" DECIMAL(18,6);

ALTER TABLE "Control" ADD COLUMN IF NOT EXISTS "toleranceKind" TEXT NOT NULL DEFAULT 'symmetric';
ALTER TABLE "Control" ADD COLUMN IF NOT EXISTS "upperDeviation" DECIMAL(18,6);
ALTER TABLE "Control" ADD COLUMN IF NOT EXISTS "lowerDeviation" DECIMAL(18,6);
