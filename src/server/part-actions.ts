"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { RoleName } from "@prisma/client";
import { hasRole, requireMember } from "@/lib/access";
import { objectKey, writeObject } from "@/lib/object-storage";
import { familyTemplate, isPartFamily, readSpecifications } from "@/lib/part-families";
import { resolveLimits } from "@/lib/tolerance";
import { t } from "@/lib/i18n";
import { withTenant } from "@/lib/prisma";

async function requirePlanner() {
  const member = await requireMember();
  if (!hasRole(member.activeRoles, RoleName.OWNER) && !hasRole(member.activeRoles, RoleName.PRODUCTION_MANAGER)) {
    redirect("/dashboard");
  }
  return member;
}

function readToolIds(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim() === "") return [];
  try {
    const parsed = JSON.parse(value) as string[];
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string" && item.trim() !== "") : [];
  } catch {
    return [];
  }
}

export async function createPartQuick(formData: FormData): Promise<{ id: string; name: string } | { error: string }> {
  const member = await requirePlanner();
  const code = String(formData.get("code") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const family = String(formData.get("partType") ?? "");
  if (!code || !description || !isPartFamily(family)) return { error: "common.required" };
  const specifications = readSpecifications(formData.get("dimensions"));
  let drawingKey: string | null = null;
  let drawingName: string | null = null;
  const file = formData.get("drawing");
  const allowed = file instanceof File && file.size > 0 && (file.type === "application/pdf" || file.type.startsWith("image/"));
  if (family === "special" && allowed) {
    drawingKey = objectKey(member.session.companyId, "drawings");
    drawingName = file.name;
    await writeObject(drawingKey, new Uint8Array(await file.arrayBuffer()));
  }
  const part = await withTenant(member.session.companyId, async (tx) => {
    const familyId = await ensureFamilyTemplate(tx, member.session.companyId, family);
    return tx.part.create({
      data: {
        companyId: member.session.companyId,
        name: code,
        description,
        partType: family,
        familyId,
        drawingKey,
        drawingName,
        tools: {
          create: readToolIds(formData.get("toolIds")).map((toolId) => ({ companyId: member.session.companyId, toolId })),
        },
        dimensions: {
          create: specifications.filter((row) => row.enabled).map((row) => ({
            companyId: member.session.companyId,
            reference: row.reference,
            dimensionName: row.dimensionName,
            nominal: row.nominal,
            tolerance: row.tolerance,
            toleranceKind: row.toleranceKind,
            upperDeviation: row.upperDeviation,
            lowerDeviation: row.lowerDeviation,
            lowerLimit: resolveLimits({ ...row, kind: row.toleranceKind }).lower,
            upperLimit: resolveLimits({ ...row, kind: row.toleranceKind }).upper,
            frequency: row.frequency,
            markerX: row.x,
            markerY: row.y,
            enabled: true,
          })),
        },
      },
    });
  });
  revalidatePath("/dashboard/parts");
  revalidatePath("/dashboard/orders/new");
  return { id: part.id, name: part.name };
}

async function ensureFamilyTemplate(tx: Parameters<Parameters<typeof withTenant>[1]>[0], companyId: string, key: string) {
  const existing = await tx.productFamily.findFirst({ where: { companyId, key }, select: { id: true } });
  if (existing) return existing.id;
  const template = isPartFamily(key) ? familyTemplate(key) : null;
  const created = await tx.productFamily.create({
    data: {
      companyId,
      key,
      dimensions: {
        create: (template ?? []).map((row) => ({
          companyId,
          reference: row.reference,
          dimensionName: t(row.nameKey),
          nominal: row.nominal,
          tolerance: row.tolerance,
          frequency: row.frequency,
          markerX: row.x,
          markerY: row.y,
        })),
      },
    },
    select: { id: true },
  });
  return created.id;
}

export async function createPart(_state: string | null, formData: FormData): Promise<string | null> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return "common.required";
  formData.set("code", name);
  if (!String(formData.get("description") ?? "").trim()) formData.set("description", name);
  if (!String(formData.get("partType") ?? "").trim()) formData.set("partType", "bolt");
  const result = await createPartQuick(formData);
  if ("error" in result) return result.error;
  redirect("/dashboard/parts");
}

export async function updatePart(_state: string | null, formData: FormData): Promise<string | null> {
  const member = await requirePlanner();
  const partId = String(formData.get("partId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return "common.required";
  await withTenant(member.session.companyId, async (tx) => {
    const part = await tx.part.findFirst({
      where: { id: partId, companyId: member.session.companyId, hiddenAt: null },
    });
    if (!part) return;
    await tx.part.update({ where: { id: part.id }, data: { name } });
  });
  revalidatePath("/dashboard/parts");
  redirect(`/dashboard/parts/${partId}`);
}

export async function retirePart(formData: FormData): Promise<void> {
  const member = await requirePlanner();
  const partId = String(formData.get("partId") ?? "");
  await withTenant(member.session.companyId, async (tx) => {
    const part = await tx.part.findFirst({
      where: { id: partId, companyId: member.session.companyId, hiddenAt: null, retiredAt: null },
    });
    if (!part) return;
    const used = await tx.productionOrder.count({ where: { partId: part.id, companyId: member.session.companyId } });
    if (used === 0) return;
    await tx.part.update({ where: { id: part.id }, data: { retiredAt: new Date() } });
  });
  revalidatePath("/dashboard/parts");
  revalidatePath(`/dashboard/parts/${partId}`);
}

export async function hidePart(formData: FormData): Promise<void> {
  const member = await requirePlanner();
  const partId = String(formData.get("partId") ?? "");
  await withTenant(member.session.companyId, async (tx) => {
    const part = await tx.part.findFirst({
      where: { id: partId, companyId: member.session.companyId, hiddenAt: null },
    });
    if (!part) return;
    const used = await tx.productionOrder.count({ where: { partId: part.id, companyId: member.session.companyId } });
    if (used > 0) return;
    await tx.part.update({ where: { id: part.id }, data: { hiddenAt: new Date() } });
  });
  revalidatePath("/dashboard/parts");
  redirect("/dashboard/parts");
}
