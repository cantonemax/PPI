CREATE TYPE "CustomerPlan" AS ENUM ('FREE', 'BASE', 'MEDIUM', 'PREMIUM');
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'YEARLY');
CREATE TYPE "ContractStatus" AS ENUM ('TRIAL', 'ACTIVE', 'SUSPENDED', 'EXPIRED');

ALTER TABLE "Company"
  ADD COLUMN "businessName" TEXT,
  ADD COLUMN "vatNumber" TEXT,
  ADD COLUMN "taxCode" TEXT,
  ADD COLUMN "pec" TEXT,
  ADD COLUMN "email" TEXT,
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "mobile" TEXT,
  ADD COLUMN "website" TEXT,
  ADD COLUMN "addressLine" TEXT,
  ADD COLUMN "zipCode" TEXT,
  ADD COLUMN "city" TEXT,
  ADD COLUMN "province" TEXT,
  ADD COLUMN "country" TEXT,
  ADD COLUMN "plan" "CustomerPlan" NOT NULL DEFAULT 'FREE',
  ADD COLUMN "billingCycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
  ADD COLUMN "contractStatus" "ContractStatus" NOT NULL DEFAULT 'TRIAL',
  ADD COLUMN "activatedAt" TIMESTAMP(3),
  ADD COLUMN "renewalAt" TIMESTAMP(3),
  ADD COLUMN "expiresAt" TIMESTAMP(3),
  ADD COLUMN "lastPaymentAt" TIMESTAMP(3),
  ADD COLUMN "nextPaymentAt" TIMESTAMP(3),
  ADD COLUMN "contractNotes" TEXT,
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "deletedBy" TEXT;

CREATE INDEX "Company_deletedAt_idx" ON "Company"("deletedAt");

ALTER TABLE "User"
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "lastLoginAt" TIMESTAMP(3);
