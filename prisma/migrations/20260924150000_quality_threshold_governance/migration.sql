ALTER TABLE "Company" ADD COLUMN "defaultQualityTargetPercent" DECIMAL(18,6) NOT NULL DEFAULT 90;
ALTER TABLE "Company" ADD COLUMN "defaultWarningDeltaPercent" DECIMAL(18,6) NOT NULL DEFAULT 2;
ALTER TABLE "Company" ADD COLUMN "defaultCriticalDeltaPercent" DECIMAL(18,6) NOT NULL DEFAULT 5;

ALTER TABLE "RoleAssignment" ADD COLUMN "qualityThresholdAuthority" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Estimate" ADD COLUMN "useCompanyQualityDefaults" BOOLEAN NOT NULL DEFAULT true;
UPDATE "Estimate"
SET "useCompanyQualityDefaults" = false
WHERE "qualityTargetPercent" IS NOT NULL
  AND "warningDeltaPercent" IS NOT NULL
  AND "criticalDeltaPercent" IS NOT NULL;
