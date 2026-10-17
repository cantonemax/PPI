import { PrismaClient } from "@prisma/client";
import { applyQaDataset } from "../src/lib/analytics-test-companies";

async function main() {
  const prisma = new PrismaClient();
  await applyQaDataset(prisma);
  await prisma.$disconnect();
}

main();
