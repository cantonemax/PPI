"use server";

import { AuditAction, AuditSubjectType, OrderPhase, Prisma, RoleName } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordAudit } from "@/lib/audit";
import { hasRole, requireMember } from "@/lib/access";
import { withTenant } from "@/lib/prisma";
import { activateDraft } from "@/server/order-activation";

async function requireFloor() {
  const member = await requireMember();
  const allowed = hasRole(member.activeRoles, RoleName.OPERATOR) || hasRole(member.activeRoles, RoleName.OWNER);
  if (!allowed) redirect("/dashboard");
  return member;
}

function positiveInt(value: FormDataEntryValue | null): number | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return null;
  return parsed;
}

async function activeOrder(companyId: string, userId: string, tx: Parameters<Parameters<typeof withTenant>[1]>[0]) {
  const user = await tx.user.findFirst({
    where: { id: userId, companyId, revokedAt: null },
    include: { activeProductionOrder: { include: { actual: true, part: true } } },
  });
  const order = user?.activeProductionOrder;
  if (!order || order.companyId !== companyId || order.phase !== OrderPhase.IN_PRODUCTION || !order.actual) return null;
  return order;
}

export async function setActiveOrder(formData: FormData): Promise<void> {
  const member = await requireFloor();
  const orderId = String(formData.get("orderId") ?? "");
  await withTenant(member.session.companyId, async (tx) => {
    const order = await tx.productionOrder.findFirst({
      where: { id: orderId, companyId: member.session.companyId, phase: OrderPhase.IN_PRODUCTION, hiddenAt: null },
    });
    if (!order) return;
    await tx.user.update({
      where: { id: member.user.id },
      data: { activeProductionOrderId: order.id },
    });
    await recordAudit(tx, {
      companyId: member.session.companyId,
      actorUserId: member.user.id,
      action: AuditAction.ACTIVE_ORDER_CHANGED,
      subjectType: AuditSubjectType.PRODUCTION_ORDER,
      subjectId: order.id,
    });
  });
  revalidatePath("/dashboard/operator");
  redirect("/dashboard/operator");
}

export async function registerGoodParts(_state: string | null, formData: FormData): Promise<string | null> {
  const member = await requireFloor();
  const amount = positiveInt(formData.get("quantity"));
  if (!amount) return "floor.positive";
  const failed = await withTenant(member.session.companyId, async (tx) => {
    const order = await activeOrder(member.session.companyId, member.user.id, tx);
    if (!order?.actual) return true;
    await tx.actual.update({
      where: { id: order.actual.id },
      data: { goodQuantity: { increment: amount } },
    });
    await recordAudit(tx, {
      companyId: member.session.companyId,
      actorUserId: member.user.id,
      action: AuditAction.PRODUCTION_RECORDED,
      subjectType: AuditSubjectType.PRODUCTION_ORDER,
      subjectId: order.id,
    });
    return false;
  });
  if (failed) return "floor.noOrder";
  revalidatePath("/dashboard/operator");
  return null;
}

export async function registerScrap(_state: string | null, formData: FormData): Promise<string | null> {
  const member = await requireFloor();
  const amount = positiveInt(formData.get("quantity"));
  if (!amount) return "floor.positive";
  const failed = await withTenant(member.session.companyId, async (tx) => {
    const order = await activeOrder(member.session.companyId, member.user.id, tx);
    if (!order) return true;
    await tx.scrap.create({
      data: {
        companyId: member.session.companyId,
        productionOrderId: order.id,
        pieceCount: amount,
        occurredAt: new Date(),
      },
    });
    await recordAudit(tx, {
      companyId: member.session.companyId,
      actorUserId: member.user.id,
      action: AuditAction.SCRAP_RECORDED,
      subjectType: AuditSubjectType.PRODUCTION_ORDER,
      subjectId: order.id,
    });
    return false;
  });
  if (failed) return "floor.noOrder";
  revalidatePath("/dashboard/operator");
  return null;
}

export async function startPause(): Promise<void> {
  const member = await requireFloor();
  await withTenant(member.session.companyId, async (tx) => {
    const order = await activeOrder(member.session.companyId, member.user.id, tx);
    if (!order) return;
    const open = await tx.pause.findFirst({
      where: { productionOrderId: order.id, companyId: member.session.companyId, endedAt: null },
    });
    if (open) return;
    await tx.pause.create({
      data: { companyId: member.session.companyId, productionOrderId: order.id, startedAt: new Date() },
    });
    await recordAudit(tx, {
      companyId: member.session.companyId,
      actorUserId: member.user.id,
      action: AuditAction.PAUSE_STARTED,
      subjectType: AuditSubjectType.PRODUCTION_ORDER,
      subjectId: order.id,
    });
  });
  revalidatePath("/dashboard/operator");
}

export async function endPause(): Promise<void> {
  const member = await requireFloor();
  await withTenant(member.session.companyId, async (tx) => {
    const order = await activeOrder(member.session.companyId, member.user.id, tx);
    if (!order) return;
    const open = await tx.pause.findFirst({
      where: { productionOrderId: order.id, companyId: member.session.companyId, endedAt: null },
    });
    if (!open) return;
    await tx.pause.update({ where: { id: open.id }, data: { endedAt: new Date() } });
    await recordAudit(tx, {
      companyId: member.session.companyId,
      actorUserId: member.user.id,
      action: AuditAction.PAUSE_ENDED,
      subjectType: AuditSubjectType.PRODUCTION_ORDER,
      subjectId: order.id,
    });
  });
  revalidatePath("/dashboard/operator");
}

export async function startDowntime(formData: FormData): Promise<void> {
  const member = await requireFloor();
  const machineId = String(formData.get("machineId") ?? "");
  await withTenant(member.session.companyId, async (tx) => {
    const order = await activeOrder(member.session.companyId, member.user.id, tx);
    const machine = await tx.machine.findFirst({
      where: { id: machineId, companyId: member.session.companyId, hiddenAt: null },
    });
    if (!order || !machine) return;
    const open = await tx.downtime.findFirst({
      where: { productionOrderId: order.id, companyId: member.session.companyId, endedAt: null },
    });
    if (open) return;
    await tx.downtime.create({
      data: {
        companyId: member.session.companyId,
        productionOrderId: order.id,
        machineId: machine.id,
        startedAt: new Date(),
      },
    });
    await recordAudit(tx, {
      companyId: member.session.companyId,
      actorUserId: member.user.id,
      action: AuditAction.DOWNTIME_STARTED,
      subjectType: AuditSubjectType.PRODUCTION_ORDER,
      subjectId: order.id,
    });
  });
  revalidatePath("/dashboard/operator");
  redirect("/dashboard/operator");
}

export async function endDowntime(): Promise<void> {
  const member = await requireFloor();
  await withTenant(member.session.companyId, async (tx) => {
    const order = await activeOrder(member.session.companyId, member.user.id, tx);
    if (!order) return;
    const open = await tx.downtime.findFirst({
      where: { productionOrderId: order.id, companyId: member.session.companyId, endedAt: null },
    });
    if (!open) return;
    await tx.downtime.update({ where: { id: open.id }, data: { endedAt: new Date() } });
    await recordAudit(tx, {
      companyId: member.session.companyId,
      actorUserId: member.user.id,
      action: AuditAction.DOWNTIME_ENDED,
      subjectType: AuditSubjectType.PRODUCTION_ORDER,
      subjectId: order.id,
    });
  });
  revalidatePath("/dashboard/operator");
}

function positiveDecimal(value: FormDataEntryValue | null): Prisma.Decimal | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return new Prisma.Decimal(parsed);
}

async function machineRate(
  tx: Parameters<Parameters<typeof withTenant>[1]>[0],
  companyId: string,
  orderId: string,
  machineId: string,
): Promise<Prisma.Decimal | null> {
  const estimate = await tx.estimate.findFirst({
    where: { productionOrderId: orderId, companyId },
  });
  if (estimate?.machineId === machineId && estimate.hourlyRateSnapshot) return estimate.hourlyRateSnapshot;
  const machine = await tx.machine.findFirst({ where: { id: machineId, companyId } });
  return machine ? machine.hourlyRate : null;
}

export async function registerToolChange(_state: string | null, formData: FormData): Promise<string | null> {
  const member = await requireFloor();
  const toolId = String(formData.get("toolId") ?? "");
  const quantity = positiveDecimal(formData.get("quantity"));
  if (!quantity) return "floor.positive";
  const failed = await withTenant(member.session.companyId, async (tx) => {
    const order = await activeOrder(member.session.companyId, member.user.id, tx);
    const tool = await tx.tool.findFirst({ where: { id: toolId, companyId: member.session.companyId, hiddenAt: null } });
    if (!order || !tool) return true;
    const estimated = await tx.estimateToolUse.findFirst({
      where: { companyId: member.session.companyId, toolId: tool.id, estimate: { productionOrderId: order.id } },
    });
    const created = await tx.toolChange.create({
      data: {
        companyId: member.session.companyId,
        productionOrderId: order.id,
        toolId: tool.id,
        quantity,
        unitCost: estimated?.unitCost ?? tool.unitCost,
        occurredAt: new Date(),
      },
    });
    await recordAudit(tx, {
      companyId: member.session.companyId,
      actorUserId: member.user.id,
      action: AuditAction.TOOL_CHANGED,
      subjectType: AuditSubjectType.TOOL,
      subjectId: created.id,
    });
    return false;
  });
  if (failed) return "floor.noOrder";
  revalidatePath("/dashboard/operator");
  return null;
}

export async function registerMaterialConsumption(_state: string | null, formData: FormData): Promise<string | null> {
  const member = await requireFloor();
  const materialId = String(formData.get("materialId") ?? "");
  const quantity = positiveDecimal(formData.get("quantity"));
  if (!quantity) return "floor.positive";
  const failed = await withTenant(member.session.companyId, async (tx) => {
    const order = await activeOrder(member.session.companyId, member.user.id, tx);
    const material = await tx.material.findFirst({
      where: { id: materialId, companyId: member.session.companyId, hiddenAt: null },
    });
    if (!order || !material) return true;
    const estimated = await tx.estimateMaterialUse.findFirst({
      where: { companyId: member.session.companyId, materialId: material.id, estimate: { productionOrderId: order.id } },
    });
    const created = await tx.materialConsumption.create({
      data: {
        companyId: member.session.companyId,
        productionOrderId: order.id,
        materialId: material.id,
        quantity,
        unitCost: estimated?.unitCost ?? material.unitCost,
        occurredAt: new Date(),
      },
    });
    await recordAudit(tx, {
      companyId: member.session.companyId,
      actorUserId: member.user.id,
      action: AuditAction.MATERIAL_CONSUMED,
      subjectType: AuditSubjectType.MATERIAL,
      subjectId: created.id,
    });
    return false;
  });
  if (failed) return "floor.noOrder";
  revalidatePath("/dashboard/operator");
  return null;
}

export async function registerMachineTime(formData: FormData): Promise<void> {
  const member = await requireFloor();
  const minutes = positiveDecimal(formData.get("minutes"));
  if (!minutes) return;
  await withTenant(member.session.companyId, async (tx) => {
    const order = await activeOrder(member.session.companyId, member.user.id, tx);
    if (!order) return;
    const requestedId = String(formData.get("machineId") ?? "");
    const open = await tx.machineTime.findFirst({
      where: { productionOrderId: order.id, companyId: member.session.companyId, endedAt: null },
      orderBy: { startedAt: "desc" },
    });
    const estimate = await tx.estimate.findFirst({
      where: { productionOrderId: order.id, companyId: member.session.companyId },
    });
    const machineId = requestedId || open?.machineId || estimate?.machineId || "";
    const machine = await tx.machine.findFirst({
      where: { id: machineId, companyId: member.session.companyId, hiddenAt: null },
    });
    if (!machine) return;
    const endedAt = new Date();
    const startedAt = new Date(endedAt.getTime() - Number(minutes) * 60_000);
    const rate = await machineRate(tx, member.session.companyId, order.id, machine.id);
    if (!rate) return;
    const created = await tx.machineTime.create({
      data: {
        companyId: member.session.companyId,
        productionOrderId: order.id,
        machineId: machine.id,
        hourlyRateSnapshot: rate,
        startedAt,
        endedAt,
      },
    });
    await recordAudit(tx, {
      companyId: member.session.companyId,
      actorUserId: member.user.id,
      action: AuditAction.MACHINE_TIME_RECORDED,
      subjectType: AuditSubjectType.MACHINE,
      subjectId: created.id,
    });
  });
  revalidatePath("/dashboard/operator");
  redirect("/dashboard/operator");
}

export async function changeProductionMachine(formData: FormData): Promise<void> {
  const member = await requireFloor();
  const machineId = String(formData.get("machineId") ?? "");
  await withTenant(member.session.companyId, async (tx) => {
    const order = await activeOrder(member.session.companyId, member.user.id, tx);
    const machine = await tx.machine.findFirst({
      where: { id: machineId, companyId: member.session.companyId, hiddenAt: null },
    });
    if (!order || !machine) return;
    const open = await tx.machineTime.findMany({
      where: { productionOrderId: order.id, companyId: member.session.companyId, endedAt: null },
    });
    if (open.length === 1 && open[0]?.machineId === machine.id) return;
    if (open.length > 0) {
      await tx.machineTime.updateMany({
        where: { productionOrderId: order.id, companyId: member.session.companyId, endedAt: null },
        data: { endedAt: new Date() },
      });
    }
    const rate = await machineRate(tx, member.session.companyId, order.id, machine.id);
    if (!rate) return;
    await tx.machineTime.create({
      data: {
        companyId: member.session.companyId,
        productionOrderId: order.id,
        machineId: machine.id,
        hourlyRateSnapshot: rate,
        startedAt: new Date(),
      },
    });
    await recordAudit(tx, {
      companyId: member.session.companyId,
      actorUserId: member.user.id,
      action: AuditAction.MACHINE_CHANGED,
      subjectType: AuditSubjectType.MACHINE,
      subjectId: machine.id,
    });
  });
  revalidatePath("/dashboard/operator");
  redirect("/dashboard/operator");
}

export async function operatorCompleteOrder(formData: FormData): Promise<void> {
  const member = await requireFloor();
  const orderId = String(formData.get("orderId") ?? "");
  const error = await withTenant(member.session.companyId, async (tx) => {
    const order = await tx.productionOrder.findFirst({
      where: { id: orderId, companyId: member.session.companyId, phase: OrderPhase.IN_PRODUCTION, hiddenAt: null },
    });
    const mine = order?.assignedOperatorId === member.user.id || member.user.activeProductionOrderId === order?.id;
    if (!order || !mine) return "common.required";
    const where = { productionOrderId: order.id, companyId: member.session.companyId, endedAt: null };
    const open = (await tx.pause.count({ where })) + (await tx.downtime.count({ where }));
    if (open > 0) return "order.openInterval";
    await tx.productionOrder.update({
      where: { id: order.id },
      data: { phase: OrderPhase.COMPLETED, completedAt: new Date() },
    });
    if (member.user.activeProductionOrderId === order.id) {
      await tx.user.update({ where: { id: member.user.id }, data: { activeProductionOrderId: null } });
    }
    await recordAudit(tx, {
      companyId: member.session.companyId,
      actorUserId: member.user.id,
      action: AuditAction.ORDER_COMPLETED,
      subjectType: AuditSubjectType.PRODUCTION_ORDER,
      subjectId: order.id,
    });
    return null;
  });
  revalidatePath("/dashboard/operator");
  revalidatePath("/dashboard/operator/orders");
  redirect(error ? `/dashboard/operator/orders/${orderId}?error=${error}` : "/dashboard/operator/orders");
}

export async function operatorStartOrder(formData: FormData): Promise<void> {
  const member = await requireFloor();
  const orderId = String(formData.get("orderId") ?? "");
  const error = await withTenant(member.session.companyId, async (tx) => {
    const order = await tx.productionOrder.findFirst({
      where: { id: orderId, companyId: member.session.companyId, phase: OrderPhase.DRAFT, hiddenAt: null },
      include: { estimate: true },
    });
    if (!order?.estimate || order.assignedOperatorId !== member.user.id) return "common.required";
    const failed = await activateDraft(tx, member.session.companyId, order.id, member.user.id, false);
    if (failed) return failed;
    await tx.user.update({ where: { id: member.user.id }, data: { activeProductionOrderId: order.id } });
    return null;
  });
  revalidatePath("/dashboard/operator");
  revalidatePath("/dashboard/operator/orders");
  redirect(error ? `/dashboard/operator/orders/${orderId}?error=${error}` : "/dashboard/operator");
}
