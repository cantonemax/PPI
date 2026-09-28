"use server";

import { OrderPhase, RoleName } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hasRole, requireMember } from "@/lib/access";
import { objectKey, removeObject, writeObject } from "@/lib/object-storage";
import { withTenant } from "@/lib/prisma";

const documentPhases = new Set<OrderPhase>([OrderPhase.DRAFT, OrderPhase.IN_PRODUCTION, OrderPhase.COMPLETED]);
const certificationPhases = new Set<OrderPhase>([OrderPhase.IN_PRODUCTION, OrderPhase.COMPLETED]);

function planner(roles: { role: RoleName }[]) {
  return hasRole(roles, RoleName.OWNER) || hasRole(roles, RoleName.PRODUCTION_MANAGER);
}

function certifier(roles: { role: RoleName }[]) {
  return hasRole(roles, RoleName.OWNER) || hasRole(roles, RoleName.QUALITY_MANAGER);
}

async function fileBytes(formData: FormData): Promise<{ name: string; bytes: Uint8Array } | null> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > 15 * 1024 * 1024) return null;
  return { name: file.name || "file", bytes: new Uint8Array(await file.arrayBuffer()) };
}

async function uploadFile(
  kind: "drawings" | "technical-documents" | "certifications",
  formData: FormData,
  allowed: (phase: OrderPhase) => boolean,
) {
  const member = await requireMember();
  const orderId = String(formData.get("orderId") ?? "");
  const file = await fileBytes(formData);
  if (!file) redirect(`/dashboard/orders/${orderId}?error=documents.fileRequired`);
  const key = objectKey(member.session.companyId, kind);
  await writeObject(key, file.bytes);
  const saved = await withTenant(member.session.companyId, async (tx) => {
    const order = await tx.productionOrder.findFirst({
      where: { id: orderId, companyId: member.session.companyId, hiddenAt: null },
    });
    if (!order || !allowed(order.phase)) return false;
    const data = {
      companyId: member.session.companyId,
      productionOrderId: order.id,
      storageKey: key,
      fileName: file.name,
      addedAt: new Date(),
    };
    if (kind === "drawings") await tx.drawing.create({ data });
    else if (kind === "technical-documents") await tx.technicalDocument.create({ data });
    else await tx.certification.create({ data });
    return true;
  });
  if (!saved) {
    await removeObject(key);
    redirect(`/dashboard/orders/${orderId}?error=documents.rejected`);
  }
  revalidatePath(`/dashboard/orders/${orderId}`);
  revalidatePath("/dashboard/quality/certifications");
  revalidatePath("/dashboard/operator");
  redirect(`/dashboard/orders/${orderId}`);
}

export async function uploadDrawing(formData: FormData): Promise<void> {
  const member = await requireMember();
  if (!planner(member.activeRoles)) redirect("/dashboard");
  await uploadFile("drawings", formData, (phase) => documentPhases.has(phase));
}

export async function uploadTechnicalDocument(formData: FormData): Promise<void> {
  const member = await requireMember();
  if (!planner(member.activeRoles)) redirect("/dashboard");
  await uploadFile("technical-documents", formData, (phase) => documentPhases.has(phase));
}

export async function addProductionNote(formData: FormData): Promise<void> {
  const member = await requireMember();
  if (!planner(member.activeRoles)) redirect("/dashboard");
  const orderId = String(formData.get("orderId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!body) redirect(`/dashboard/orders/${orderId}?error=documents.noteRequired`);
  const saved = await withTenant(member.session.companyId, async (tx) => {
    const order = await tx.productionOrder.findFirst({
      where: { id: orderId, companyId: member.session.companyId, hiddenAt: null },
    });
    if (!order || !documentPhases.has(order.phase)) return false;
    await tx.productionNote.create({
      data: { companyId: member.session.companyId, productionOrderId: order.id, body, addedAt: new Date() },
    });
    return true;
  });
  if (!saved) redirect(`/dashboard/orders/${orderId}?error=documents.rejected`);
  revalidatePath(`/dashboard/orders/${orderId}`);
  redirect(`/dashboard/orders/${orderId}`);
}

export async function uploadCertification(formData: FormData): Promise<void> {
  const member = await requireMember();
  if (!certifier(member.activeRoles)) redirect("/dashboard");
  await uploadFile("certifications", formData, (phase) => certificationPhases.has(phase));
}
