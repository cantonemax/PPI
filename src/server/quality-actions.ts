"use server";

import { AuditAction, AuditSubjectType, OrderPhase, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordAudit } from "@/lib/audit";
import { requireMember } from "@/lib/access";
import { withTenant } from "@/lib/prisma";
import { updateOwned } from "@/lib/tenant-write";
import { writeFeatureSpc } from "@/lib/spc-engine";
import { RoleEngine } from "@/lib/auth/role-engine";

async function requireQuality() {
  const member = await requireMember();
  const allowed = RoleEngine.canCertify(member.activeRoles);
  if (!allowed) redirect("/dashboard");
  return member;
}

async function requireMeasure() {
  const member = await requireMember();
  const allowed = RoleEngine.canRecordMeasurement(member.activeRoles);
  if (!allowed) redirect("/dashboard");
  return member;
}

function decimal(value: FormDataEntryValue | null): Prisma.Decimal | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return new Prisma.Decimal(parsed);
}

export async function createControlPlan(formData: FormData): Promise<void> {
  const member = await requireQuality();
  const orderId = String(formData.get("orderId") ?? "");
  await withTenant(member.session.companyId, async (tx) => {
    const order = await tx.productionOrder.findFirst({
      where: { id: orderId, companyId: member.session.companyId, hiddenAt: null },
    });
    if (!order) return;
    const existing = await tx.controlPlan.findFirst({
      where: { productionOrderId: order.id, companyId: member.session.companyId },
    });
    if (existing) return;
    const plan = await tx.controlPlan.create({
      data: { companyId: member.session.companyId, productionOrderId: order.id },
    });
    await recordAudit(tx, {
      companyId: member.session.companyId,
      actorUserId: member.user.id,
      action: AuditAction.CONTROL_CREATED,
      subjectType: AuditSubjectType.PRODUCTION_ORDER,
      subjectId: plan.id,
    });
  });
  revalidatePath("/dashboard/quality");
}

export async function createControl(formData: FormData): Promise<void> {
  const member = await requireQuality();
  const orderId = String(formData.get("orderId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const nominal = decimal(formData.get("nominal"));
  const lowerLimit = decimal(formData.get("lowerLimit"));
  const upperLimit = decimal(formData.get("upperLimit"));
  if (!name || !nominal || !lowerLimit || !upperLimit || !(Number(upperLimit) > Number(lowerLimit))) return;
  await withTenant(member.session.companyId, async (tx) => {
    const plan = await tx.controlPlan.findFirst({
      where: { productionOrderId: orderId, companyId: member.session.companyId },
    });
    if (!plan) return;
    const control = await tx.control.create({
      data: {
        companyId: member.session.companyId,
        controlPlanId: plan.id,
        name,
        nominal,
        lowerLimit,
        upperLimit,
      },
    });
    await recordAudit(tx, {
      companyId: member.session.companyId,
      actorUserId: member.user.id,
      action: AuditAction.CONTROL_CREATED,
      subjectType: AuditSubjectType.PRODUCTION_ORDER,
      subjectId: control.id,
    });
  });
  revalidatePath("/dashboard/quality");
}

export async function updateControl(formData: FormData): Promise<void> {
  const member = await requireQuality();
  const controlId = String(formData.get("controlId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const nominal = decimal(formData.get("nominal"));
  const lowerLimit = decimal(formData.get("lowerLimit"));
  const upperLimit = decimal(formData.get("upperLimit"));
  if (!name || !nominal || !lowerLimit || !upperLimit || !(Number(upperLimit) > Number(lowerLimit))) return;
  await withTenant(member.session.companyId, async (tx) => {
    const control = await tx.control.findFirst({
      where: { id: controlId, companyId: member.session.companyId },
    });
    if (!control) return;
    await updateOwned(tx.control, control.id, member.session.companyId, { name, nominal, lowerLimit, upperLimit });
    await recordAudit(tx, {
      companyId: member.session.companyId,
      actorUserId: member.user.id,
      action: AuditAction.CONTROL_UPDATED,
      subjectType: AuditSubjectType.PRODUCTION_ORDER,
      subjectId: control.id,
    });
  });
  revalidatePath("/dashboard/quality");
}

export async function recordMeasurementForm(formData: FormData): Promise<void> {
  await recordMeasurement(null, formData);
}

export async function recordMeasurement(_state: string | null, formData: FormData): Promise<string | null> {
  const member = await requireMeasure();
  const controlId = String(formData.get("controlId") ?? "");
  const value = decimal(formData.get("value"));
  if (!value) return "quality.valueRequired";
  const failed = await withTenant(member.session.companyId, async (tx) => {
    const control = await tx.control.findFirst({
      where: { id: controlId, companyId: member.session.companyId },
      include: {
        controlPlan: {
          include: {
            productionOrder: {
              include: {
                estimate: { include: { toolUses: { take: 1 } } },
                toolChanges: { orderBy: { occurredAt: "desc" }, take: 1 },
              },
            },
          },
        },
      },
    });
    const order = control?.controlPlan.productionOrder;
    if (!order || order.companyId !== member.session.companyId || order.phase !== OrderPhase.IN_PRODUCTION) return true;
    const quality = RoleEngine.canCertify(member.activeRoles);
    if (!quality) {
      const user = await tx.user.findFirst({ where: { id: member.user.id, companyId: member.session.companyId } });
      const onThisOrder = user?.activeProductionOrderId === order.id || order.assignedOperatorId === member.user.id || order.assignedOperatorId === null;
      if (!user || !onThisOrder) return true;
      if (user.activeProductionOrderId !== order.id) {
        await tx.user.updateMany({
          where: { companyId: member.session.companyId, activeProductionOrderId: order.id, id: { not: user.id } },
          data: { activeProductionOrderId: null },
        });
        await updateOwned(tx.user, user.id, member.session.companyId, { activeProductionOrderId: order.id });
      }
    }
    const created = await tx.measurement.create({
      data: {
        companyId: member.session.companyId,
        productionOrderId: order.id,
        controlId: control.id,
        value,
        recordedAt: new Date(),
      },
    });
    await recordAudit(tx, {
      companyId: member.session.companyId,
      actorUserId: member.user.id,
      action: AuditAction.MEASUREMENT_RECORDED,
      subjectType: AuditSubjectType.PRODUCTION_ORDER,
      subjectId: created.id,
    });
    const history = await tx.measurement.findMany({
      where: { companyId: member.session.companyId, controlId: control.id },
      orderBy: { recordedAt: "asc" },
      select: { value: true },
    });
    await writeFeatureSpc(tx, {
      companyId: member.session.companyId,
      productionOrderId: order.id,
      controlId: control.id,
      orderId: order.id,
      feature: control.name,
      machineId: order.estimate?.machineId ?? undefined,
      toolId: order.toolChanges[0]?.toolId ?? order.estimate?.toolUses[0]?.toolId,
      tolerances: { lsl: Number(control.lowerLimit), usl: Number(control.upperLimit) },
      measurements: history.map((measurement) => Number(measurement.value)),
    });
    return false;
  });
  if (failed) return "quality.notInProduction";
  revalidatePath("/dashboard/quality");
  revalidatePath("/dashboard/operator");
  return null;
}

export async function resetOrderMeasurements(orderId: string): Promise<string | null> {
  const member = await requireMeasure();
  if (!orderId) return "quality.notInProduction";
  const failed = await withTenant(member.session.companyId, async (tx) => {
    const order = await tx.productionOrder.findFirst({
      where: { id: orderId, companyId: member.session.companyId, hiddenAt: null, phase: OrderPhase.IN_PRODUCTION },
    });
    if (!order) return true;
    const quality = RoleEngine.canCertify(member.activeRoles);
    if (!quality) {
      const user = await tx.user.findFirst({ where: { id: member.user.id, companyId: member.session.companyId } });
      const onThisOrder = user?.activeProductionOrderId === order.id || order.assignedOperatorId === member.user.id || order.assignedOperatorId === null;
      if (!user || !onThisOrder) return true;
    }
    await tx.measurement.deleteMany({ where: { companyId: member.session.companyId, productionOrderId: order.id } });
    await tx.featureSpc.deleteMany({ where: { companyId: member.session.companyId, productionOrderId: order.id } });
    return false;
  });
  if (failed) return "quality.notInProduction";
  revalidatePath("/dashboard/quality");
  revalidatePath("/dashboard/operator");
  revalidatePath("/dashboard/floor");
  return null;
}
