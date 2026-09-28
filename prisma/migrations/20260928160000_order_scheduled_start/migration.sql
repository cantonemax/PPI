ALTER TABLE "ProductionOrder" ADD COLUMN IF NOT EXISTS "scheduledStartAt" TIMESTAMP(3);
ALTER TABLE "ProductionOrder" ADD COLUMN IF NOT EXISTS "scheduledStartByUserId" TEXT;
CREATE INDEX IF NOT EXISTS "ProductionOrder_companyId_phase_scheduledStartAt_idx" ON "ProductionOrder"("companyId", "phase", "scheduledStartAt");
