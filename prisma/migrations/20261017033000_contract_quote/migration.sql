ALTER TABLE "Company" ADD COLUMN "annualDiscountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE "Company" DROP COLUMN "customerValue";
