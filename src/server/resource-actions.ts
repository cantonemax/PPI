"use server";

import { Prisma, RoleName } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hasRole, requireMember } from "@/lib/access";
import { isToolFamily } from "@/lib/tool-families";
import type { Db } from "@/lib/prisma";
import { withTenant } from "@/lib/prisma";

async function requirePlanner() {
  const member = await requireMember();
  if (!hasRole(member.activeRoles, RoleName.OWNER) && !hasRole(member.activeRoles, RoleName.PRODUCTION_MANAGER)) {
    redirect("/dashboard");
  }
  return member;
}

function money(value: FormDataEntryValue | null): Prisma.Decimal | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const parsed = Number(text);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return new Prisma.Decimal(text);
}

function text(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

async function references(tx: Db, companyId: string, kind: "machine" | "tool" | "material", id: string) {
  if (kind === "machine") {
    const [estimates, times, stops] = await Promise.all([
      tx.estimate.count({ where: { companyId, machineId: id } }),
      tx.machineTime.count({ where: { companyId, machineId: id } }),
      tx.downtime.count({ where: { companyId, machineId: id } }),
    ]);
    return estimates + times + stops;
  }
  if (kind === "tool") {
    const [uses, changes] = await Promise.all([
      tx.estimateToolUse.count({ where: { companyId, toolId: id } }),
      tx.toolChange.count({ where: { companyId, toolId: id } }),
    ]);
    return uses + changes;
  }
  const [uses, consumptions] = await Promise.all([
    tx.estimateMaterialUse.count({ where: { companyId, materialId: id } }),
    tx.materialConsumption.count({ where: { companyId, materialId: id } }),
  ]);
  return uses + consumptions;
}

export async function createMachine(_state: string | null, formData: FormData): Promise<string | null> {
  const member = await requirePlanner();
  const name = text(formData.get("name"));
  const hourlyRate = money(formData.get("hourlyRate"));
  if (!name || !hourlyRate) return "common.required";
  await withTenant(member.session.companyId, (tx) =>
    tx.machine.create({ data: { companyId: member.session.companyId, name, hourlyRate } }),
  );
  revalidatePath("/dashboard/machines");
  redirect("/dashboard/machines");
}

export async function updateMachine(_state: string | null, formData: FormData): Promise<string | null> {
  const member = await requirePlanner();
  const machineId = text(formData.get("machineId"));
  const name = text(formData.get("name"));
  const hourlyRate = money(formData.get("hourlyRate"));
  if (!name || !hourlyRate) return "common.required";
  await withTenant(member.session.companyId, async (tx) => {
    const machine = await tx.machine.findFirst({
      where: { id: machineId, companyId: member.session.companyId, hiddenAt: null },
    });
    if (!machine) return;
    await tx.machine.update({ where: { id: machine.id }, data: { name, hourlyRate } });
  });
  revalidatePath("/dashboard/machines");
  redirect(`/dashboard/machines/${machineId}`);
}

export async function retireMachine(formData: FormData): Promise<void> {
  const member = await requirePlanner();
  const machineId = text(formData.get("machineId"));
  await withTenant(member.session.companyId, async (tx) => {
    const machine = await tx.machine.findFirst({
      where: { id: machineId, companyId: member.session.companyId, hiddenAt: null, retiredAt: null },
    });
    if (!machine) return;
    if ((await references(tx, member.session.companyId, "machine", machine.id)) === 0) return;
    await tx.machine.update({ where: { id: machine.id }, data: { retiredAt: new Date() } });
  });
  revalidatePath(`/dashboard/machines/${machineId}`);
}

export async function hideMachine(formData: FormData): Promise<void> {
  const member = await requirePlanner();
  const machineId = text(formData.get("machineId"));
  await withTenant(member.session.companyId, async (tx) => {
    const machine = await tx.machine.findFirst({
      where: { id: machineId, companyId: member.session.companyId, hiddenAt: null },
    });
    if (!machine) return;
    if ((await references(tx, member.session.companyId, "machine", machine.id)) > 0) return;
    await tx.machine.update({ where: { id: machine.id }, data: { hiddenAt: new Date() } });
  });
  revalidatePath("/dashboard/machines");
  redirect("/dashboard/machines");
}

export async function createToolQuick(formData: FormData): Promise<{ id: string; name: string } | { error: string }> {
  const member = await requirePlanner();
  const name = text(formData.get("code"));
  const description = text(formData.get("description"));
  const toolFamily = text(formData.get("toolFamily"));
  const manufacturer = text(formData.get("manufacturer"));
  const notes = text(formData.get("notes"));
  if (!name || !description || !isToolFamily(toolFamily)) return { error: "common.required" };
  const tool = await withTenant(member.session.companyId, (tx) =>
    tx.tool.create({
      data: { companyId: member.session.companyId, name, description, toolFamily, manufacturer, notes, unit: "pz", unitCost: 0 },
    }),
  );
  revalidatePath("/dashboard/tools");
  revalidatePath("/dashboard/orders/new");
  return { id: tool.id, name: tool.name };
}

export async function updateToolIdentity(formData: FormData): Promise<{ id: string; name: string } | { error: string }> {
  const member = await requirePlanner();
  const toolId = text(formData.get("toolId"));
  const name = text(formData.get("code"));
  const description = text(formData.get("description"));
  const toolFamily = text(formData.get("toolFamily"));
  const manufacturer = text(formData.get("manufacturer"));
  const notes = text(formData.get("notes"));
  if (!toolId || !name || !description || !isToolFamily(toolFamily)) return { error: "common.required" };
  const tool = await withTenant(member.session.companyId, async (tx) => {
    const existing = await tx.tool.findFirst({ where: { id: toolId, companyId: member.session.companyId, hiddenAt: null } });
    if (!existing) return null;
    return tx.tool.update({ where: { id: existing.id }, data: { name, description, toolFamily, manufacturer, notes } });
  });
  if (!tool) return { error: "common.required" };
  revalidatePath("/dashboard/tools");
  return { id: tool.id, name: tool.name };
}

export async function createTool(_state: string | null, formData: FormData): Promise<string | null> {
  const member = await requirePlanner();
  const name = text(formData.get("name"));
  const unit = text(formData.get("unit"));
  const unitCost = money(formData.get("unitCost"));
  if (!name || !unit || !unitCost) return "common.required";
  const description = text(formData.get("description"));
  const toolFamily = text(formData.get("toolFamily"));
  const manufacturer = text(formData.get("manufacturer"));
  const notes = text(formData.get("notes"));
  await withTenant(member.session.companyId, (tx) =>
    tx.tool.create({
      data: {
        companyId: member.session.companyId,
        name,
        unit,
        unitCost,
        description,
        toolFamily: isToolFamily(toolFamily) ? toolFamily : null,
        manufacturer,
        notes,
      },
    }),
  );
  revalidatePath("/dashboard/tools");
  redirect("/dashboard/tools");
}

export async function updateTool(_state: string | null, formData: FormData): Promise<string | null> {
  const member = await requirePlanner();
  const toolId = text(formData.get("toolId"));
  const name = text(formData.get("name"));
  const unit = text(formData.get("unit"));
  const unitCost = money(formData.get("unitCost"));
  if (!name || !unit || !unitCost) return "common.required";
  await withTenant(member.session.companyId, async (tx) => {
    const tool = await tx.tool.findFirst({ where: { id: toolId, companyId: member.session.companyId, hiddenAt: null } });
    if (!tool) return;
    await tx.tool.update({ where: { id: tool.id }, data: { name, unit, unitCost } });
  });
  revalidatePath("/dashboard/tools");
  redirect(`/dashboard/tools/${toolId}`);
}

export async function retireTool(formData: FormData): Promise<void> {
  const member = await requirePlanner();
  const toolId = text(formData.get("toolId"));
  await withTenant(member.session.companyId, async (tx) => {
    const tool = await tx.tool.findFirst({
      where: { id: toolId, companyId: member.session.companyId, hiddenAt: null, retiredAt: null },
    });
    if (!tool) return;
    if ((await references(tx, member.session.companyId, "tool", tool.id)) === 0) return;
    await tx.tool.update({ where: { id: tool.id }, data: { retiredAt: new Date() } });
  });
  revalidatePath(`/dashboard/tools/${toolId}`);
}

export async function hideTool(formData: FormData): Promise<void> {
  const member = await requirePlanner();
  const toolId = text(formData.get("toolId"));
  await withTenant(member.session.companyId, async (tx) => {
    const tool = await tx.tool.findFirst({ where: { id: toolId, companyId: member.session.companyId, hiddenAt: null } });
    if (!tool) return;
    if ((await references(tx, member.session.companyId, "tool", tool.id)) > 0) return;
    await tx.tool.update({ where: { id: tool.id }, data: { hiddenAt: new Date() } });
  });
  revalidatePath("/dashboard/tools");
  redirect("/dashboard/tools");
}

export async function createMaterial(_state: string | null, formData: FormData): Promise<string | null> {
  const member = await requirePlanner();
  const name = text(formData.get("name"));
  const unit = text(formData.get("unit"));
  const unitCost = money(formData.get("unitCost"));
  if (!name || !unit || !unitCost) return "common.required";
  await withTenant(member.session.companyId, (tx) =>
    tx.material.create({ data: { companyId: member.session.companyId, name, unit, unitCost } }),
  );
  revalidatePath("/dashboard/materials");
  redirect("/dashboard/materials");
}

export async function updateMaterial(_state: string | null, formData: FormData): Promise<string | null> {
  const member = await requirePlanner();
  const materialId = text(formData.get("materialId"));
  const name = text(formData.get("name"));
  const unit = text(formData.get("unit"));
  const unitCost = money(formData.get("unitCost"));
  if (!name || !unit || !unitCost) return "common.required";
  await withTenant(member.session.companyId, async (tx) => {
    const material = await tx.material.findFirst({
      where: { id: materialId, companyId: member.session.companyId, hiddenAt: null },
    });
    if (!material) return;
    await tx.material.update({ where: { id: material.id }, data: { name, unit, unitCost } });
  });
  revalidatePath("/dashboard/materials");
  redirect(`/dashboard/materials/${materialId}`);
}

export async function retireMaterial(formData: FormData): Promise<void> {
  const member = await requirePlanner();
  const materialId = text(formData.get("materialId"));
  await withTenant(member.session.companyId, async (tx) => {
    const material = await tx.material.findFirst({
      where: { id: materialId, companyId: member.session.companyId, hiddenAt: null, retiredAt: null },
    });
    if (!material) return;
    if ((await references(tx, member.session.companyId, "material", material.id)) === 0) return;
    await tx.material.update({ where: { id: material.id }, data: { retiredAt: new Date() } });
  });
  revalidatePath(`/dashboard/materials/${materialId}`);
}

export async function hideMaterial(formData: FormData): Promise<void> {
  const member = await requirePlanner();
  const materialId = text(formData.get("materialId"));
  await withTenant(member.session.companyId, async (tx) => {
    const material = await tx.material.findFirst({
      where: { id: materialId, companyId: member.session.companyId, hiddenAt: null },
    });
    if (!material) return;
    if ((await references(tx, member.session.companyId, "material", material.id)) > 0) return;
    await tx.material.update({ where: { id: material.id }, data: { hiddenAt: new Date() } });
  });
  revalidatePath("/dashboard/materials");
  redirect("/dashboard/materials");
}
