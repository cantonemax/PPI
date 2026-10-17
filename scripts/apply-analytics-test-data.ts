import { PrismaClient } from "@prisma/client";
import { applyAnalyticsTestCompanies } from "../src/lib/analytics-test-companies";

async function main() {
  const prisma = new PrismaClient();
  await applyAnalyticsTestCompanies(prisma);
  await prisma.$disconnect();
}

main();
