CREATE TABLE "FeatureSpc" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "machineId" TEXT,
    "toolId" TEXT,
    "insufficientData" BOOLEAN NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "mean" DECIMAL(24,10),
    "median" DECIMAL(24,10),
    "variance" DECIMAL(24,10),
    "sigma" DECIMAL(24,10),
    "minimum" DECIMAL(24,10),
    "maximum" DECIMAL(24,10),
    "range" DECIMAL(24,10),
    "coefficientOfVariation" DECIMAL(24,10),
    "cp" DECIMAL(24,10),
    "cpk" DECIMAL(24,10),
    "ucl" DECIMAL(24,10),
    "lcl" DECIMAL(24,10),
    "trendSlope" DECIMAL(24,10),
    "trendDirection" TEXT,
    "processState" TEXT,
    "calculatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureSpc_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FeatureSpc_controlId_key" ON "FeatureSpc"("controlId");
CREATE INDEX "FeatureSpc_companyId_idx" ON "FeatureSpc"("companyId");
CREATE INDEX "FeatureSpc_productionOrderId_idx" ON "FeatureSpc"("productionOrderId");
CREATE INDEX "FeatureSpc_machineId_idx" ON "FeatureSpc"("machineId");
CREATE INDEX "FeatureSpc_toolId_idx" ON "FeatureSpc"("toolId");

ALTER TABLE "FeatureSpc" ADD CONSTRAINT "FeatureSpc_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FeatureSpc" ADD CONSTRAINT "FeatureSpc_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FeatureSpc" ADD CONSTRAINT "FeatureSpc_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "Control"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FeatureSpc" ADD CONSTRAINT "FeatureSpc_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FeatureSpc" ADD CONSTRAINT "FeatureSpc_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "Tool"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FeatureSpc" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FeatureSpc" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "FeatureSpc";
CREATE POLICY tenant_isolation ON "FeatureSpc"
  USING ("companyId" = NULLIF(current_setting('app.company_id', true), ''))
  WITH CHECK ("companyId" = NULLIF(current_setting('app.company_id', true), ''));
