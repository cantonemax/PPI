"use server";

import { CompanyAppearance, RoleName } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { alarmTones, alarmToneValue, type AlarmToneFlags } from "@/lib/alarm-tones";
import { hasRole, requireMember } from "@/lib/access";
import { objectKey, writeObject } from "@/lib/object-storage";
import { withTenant } from "@/lib/prisma";

const imageTypes = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
]);

export async function saveCompanyDesk(formData: FormData): Promise<void> {
  const member = await requireMember();
  if (!hasRole(member.activeRoles, RoleName.OWNER)) redirect("/dashboard");
  const slogan = String(formData.get("slogan") ?? "").trim().slice(0, 80);
  const appearance = formData.get("appearance") === "FLOOR" ? CompanyAppearance.FLOOR : CompanyAppearance.DARK;
  const alarmSoundEnabled = formData.get("alarmSound") === "on";
  const alarmTone = alarmToneValue(Object.fromEntries(alarmTones.map((tone) => [tone, formData.get(`tone.${tone}`) === "on"])) as AlarmToneFlags);
  const criticalScreenEnabled = formData.get("criticalScreen") === "on";
  const uploaded = formData.get("logo");
  let logoKey = member.user.company.logoKey;
  if (uploaded instanceof File && uploaded.size > 0) {
    const extension = imageTypes.get(uploaded.type);
    if (!extension || uploaded.size > 2 * 1024 * 1024) redirect("/dashboard/company?error=company.logoInvalid");
    logoKey = `${objectKey(member.session.companyId, "brand")}.${extension}`;
    await writeObject(logoKey, new Uint8Array(await uploaded.arrayBuffer()));
  }
  await withTenant(member.session.companyId, (tx) => tx.company.update({
    where: { id: member.session.companyId },
    data: { slogan: slogan || null, logoKey, appearance, alarmSoundEnabled, alarmTone, criticalScreenEnabled },
  }));
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/company");
  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/operator");
  redirect("/dashboard/company");
}
