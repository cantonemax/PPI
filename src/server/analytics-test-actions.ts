"use server";

import { redirect } from "next/navigation";
import { canClearDemoDataset, clearAnalyticsTestCompanies, clearQaDataset } from "@/lib/analytics-test-companies";
import { prisma } from "@/lib/prisma";
import { readPlatformSession } from "@/lib/session";

export async function clearAnalyticsTestData(): Promise<void> {
  const session = await readPlatformSession();
  if (!session || session.kind !== "platform" || !canClearDemoDataset(session.platformRole)) redirect("/platform/login");
  await clearAnalyticsTestCompanies(prisma, session.email);
  redirect("/platform?view=revenue");
}

export async function clearQaDatasetData(): Promise<void> {
  const session = await readPlatformSession();
  if (!session || session.kind !== "platform" || !canClearDemoDataset(session.platformRole)) redirect("/platform/login");
  await clearQaDataset(prisma, session.email);
  redirect("/platform?view=plans");
}
