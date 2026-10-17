CREATE TYPE "PlanStatus" AS ENUM ('ACTIVE', 'DISABLED');
CREATE TYPE "PlanChangeAction" AS ENUM ('PLAN_CREATED', 'PLAN_MODIFIED', 'FEATURE_ADDED', 'FEATURE_REMOVED', 'PRICE_CHANGED', 'LIMIT_CHANGED', 'PLAN_DISABLED', 'PLAN_REACTIVATED');
CREATE TYPE "PlatformAccess" AS ENUM ('SUPER_ADMIN', 'PLATFORM_ADMIN', 'READ_ONLY');

CREATE TABLE "PlanFeatureDefinition" (
  "key" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  CONSTRAINT "PlanFeatureDefinition_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "Plan" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "badgeColor" TEXT NOT NULL DEFAULT '#2dd4bf',
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "status" "PlanStatus" NOT NULL DEFAULT 'ACTIVE',
  "monthlyPrice" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "annualPrice" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "activationFee" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "annualDiscountPercent" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "customPricingAllowed" BOOLEAN NOT NULL DEFAULT false,
  "maxUsers" INTEGER,
  "maxDepartments" INTEGER,
  "maxMachines" INTEGER,
  "maxOrders" INTEGER,
  "maxMeasurements" INTEGER,
  "maxStorageMb" INTEGER,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlanFeature" (
  "planId" TEXT NOT NULL,
  "featureKey" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "PlanFeature_pkey" PRIMARY KEY ("planId","featureKey")
);

CREATE TABLE "PlanChange" (
  "id" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actorName" TEXT NOT NULL,
  "actorEmail" TEXT NOT NULL,
  "action" "PlanChangeAction" NOT NULL,
  "previousValue" TEXT,
  "newValue" TEXT,
  "reason" TEXT,
  CONSTRAINT "PlanChange_pkey" PRIMARY KEY ("id")
);

INSERT INTO "PlanFeatureDefinition" ("key", "sortOrder") VALUES
  ('spc', 1),
  ('advancedAnalytics', 2),
  ('aiInsights', 3),
  ('pdfExport', 4),
  ('excelExport', 5),
  ('alerts', 6),
  ('multiSite', 7),
  ('erpIntegrations', 8),
  ('apiAccess', 9),
  ('prioritySupport', 10),
  ('customDashboards', 11);

INSERT INTO "Plan" ("id", "name", "description", "badgeColor", "displayOrder", "monthlyPrice", "annualPrice", "customPricingAllowed", "maxUsers", "maxDepartments", "maxMachines", "maxOrders", "maxMeasurements", "maxStorageMb") VALUES
  ('plan_free', 'FREE', 'Accesso iniziale', '#94a3b8', 1, 0, 0, false, 2, 1, 1, 10, 100, 500),
  ('plan_core', 'CORE', 'Produzione quotidiana', '#2dd4bf', 2, 149, 1490, false, 10, 3, 5, 100, 5000, 5000),
  ('plan_professional', 'PROFESSIONAL', 'Reparto con analisi', '#38bdf8', 3, 349, 3490, false, 40, 10, 20, 1000, 50000, 20000),
  ('plan_enterprise', 'ENTERPRISE', 'Prezzo definito per ogni cliente', '#fbbf24', 4, 0, 0, true, NULL, NULL, NULL, NULL, NULL, NULL);

INSERT INTO "PlanFeature" ("planId", "featureKey", "enabled")
SELECT plan.id, feature.key, CASE
  WHEN plan.id = 'plan_core' AND feature.key IN ('spc', 'pdfExport', 'alerts') THEN true
  WHEN plan.id = 'plan_professional' AND feature.key IN ('spc', 'advancedAnalytics', 'pdfExport', 'excelExport', 'alerts', 'multiSite', 'customDashboards') THEN true
  WHEN plan.id = 'plan_enterprise' THEN true
  ELSE false
END
FROM "Plan" plan
CROSS JOIN "PlanFeatureDefinition" feature;

INSERT INTO "PlanChange" ("id", "planId", "actorName", "actorEmail", "action", "newValue")
SELECT 'seed_' || "id", "id", 'Sistema', 'system', 'PLAN_CREATED', "name" FROM "Plan";

ALTER TABLE "Company" ADD COLUMN "planId" TEXT;
UPDATE "Company" SET "planId" = CASE "plan"::text
  WHEN 'BASE' THEN 'plan_core'
  WHEN 'MEDIUM' THEN 'plan_professional'
  WHEN 'PREMIUM' THEN 'plan_enterprise'
  ELSE 'plan_free'
END;
ALTER TABLE "Company" ALTER COLUMN "planId" SET NOT NULL;
ALTER TABLE "Company" DROP COLUMN "plan";
DROP TYPE "CustomerPlan";

CREATE INDEX "Company_planId_idx" ON "Company"("planId");
CREATE INDEX "PlanChange_planId_occurredAt_idx" ON "PlanChange"("planId", "occurredAt");

ALTER TABLE "PlanFeature" ADD CONSTRAINT "PlanFeature_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanFeature" ADD CONSTRAINT "PlanFeature_featureKey_fkey" FOREIGN KEY ("featureKey") REFERENCES "PlanFeatureDefinition"("key") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlanChange" ADD CONSTRAINT "PlanChange_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Company" ADD CONSTRAINT "Company_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON "Plan", "PlanFeature", "PlanFeatureDefinition", "PlanChange" TO ppi_app;
