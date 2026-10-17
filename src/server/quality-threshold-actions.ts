"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/access";
import { withTenant } from "@/lib/prisma";
import { qualityThresholdsValid } from "@/lib/quality-thresholds";
import { RoleEngine } from "@/lib/auth/role-engine";

function percent(value: FormDataEntryValue | null) {
  const parsed = Number(String(value ?? "").trim().replace("%", ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export async function updateQualityThresholds(_state: string | null, formData: FormData): Promise<string | null> {
  const member = await requireMember();
  if (!RoleEngine.hasQualityAccess(member.activeRoles)) redirect("/dashboard");
  const target = percent(formData.get("defaultQualityTarget"));
  const warning = percent(formData.get("defaultWarningDelta"));
  const critical = percent(formData.get("defaultCriticalDelta"));
  if (target === null || warning === null || critical === null || !qualityThresholdsValid(target, warning, critical)) {
    return "common.required";
  }
  await withTenant(member.session.companyId, (tx) => tx.company.update({
    where: { id: member.session.companyId },
    data: {
      defaultQualityTargetPercent: new Prisma.Decimal(target),
      defaultWarningDeltaPercent: new Prisma.Decimal(warning),
      defaultCriticalDeltaPercent: new Prisma.Decimal(critical),
    },
  }));
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  return "settings.saved";
}
