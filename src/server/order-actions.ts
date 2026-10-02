"use server";

import { AuditAction, AuditSubjectType, OrderPhase, Prisma, RoleName } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordAudit } from "@/lib/audit";
import { objectKey, readObject, writeObject } from "@/lib/object-storage";
import { planningDatesValid } from "@/lib/delivery-probability";
import { decimalText } from "@/lib/decimal-input";
import { fitDeviations, isToleranceKind } from "@/lib/tolerance";
import { qualityThresholdsValid } from "@/lib/quality-thresholds";
import { parseRomeDateTime } from "@/lib/rome-time";
import { activateDraft, promoteDueOrders } from "@/server/order-activation";
import { canSeeEconomics, hasRole, requireMember } from "@/lib/access";
import { withTenant } from "@/lib/prisma";

async function requirePlanner() {
  const member = await requireMember();
  if (!hasRole(member.activeRoles, RoleName.OWNER) && !hasRole(member.activeRoles, RoleName.PRODUCTION_MANAGER)) {
    redirect("/dashboard");
  }
  return member;
}

function calendarDate(value: FormDataEntryValue | null): Date | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function percentOrNull(value: FormDataEntryValue | null): Prisma.Decimal | null {
  const text = String(value ?? "").trim().replace("%", "");
  if (!text) return null;
  const parsed = Number(text);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) return null;
  return new Prisma.Decimal(parsed);
}

function decimalOrNull(value: FormDataEntryValue | null): Prisma.Decimal | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const parsed = Number(text);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return new Prisma.Decimal(text);
}

function lines(formData: FormData, idName: string, quantityName: string) {
  const ids = formData.getAll(idName).map(String);
  const quantities = formData.getAll(quantityName).map(String);
  const seen = new Set<string>();
  const result: { id: string; quantity: Prisma.Decimal }[] = [];
  ids.forEach((id, index) => {
    if (!id || seen.has(id)) return;
    const quantity = decimalOrNull(quantities[index] ?? null);
    if (!quantity || quantity.lte(0)) return;
    seen.add(id);
    result.push({ id, quantity });
  });
  return result;
}

async function loadDraftInput(companyId: string, formData: FormData, tx: Parameters<Parameters<typeof withTenant>[1]>[0]) {
  const partId = String(formData.get("partId") ?? "");
  const targetQuantity = Number(formData.get("targetQuantity"));
  const part = await tx.part.findFirst({
    where: { id: partId, companyId, hiddenAt: null, retiredAt: null },
  });
  if (!part || !Number.isInteger(targetQuantity) || targetQuantity < 1) return null;

  const machineId = String(formData.get("machineId") ?? "");
  const machine = machineId
    ? await tx.machine.findFirst({ where: { id: machineId, companyId, hiddenAt: null } })
    : null;
  if (machineId && !machine) return null;

  const toolLines = lines(formData, "toolId", "toolQuantity");
  const materialLines = lines(formData, "materialId", "materialQuantity");
  const tools = toolLines.length
    ? await tx.tool.findMany({ where: { companyId, id: { in: toolLines.map((line) => line.id) }, hiddenAt: null } })
    : [];
  const materials = materialLines.length
    ? await tx.material.findMany({ where: { companyId, id: { in: materialLines.map((line) => line.id) }, hiddenAt: null } })
    : [];
  if (tools.length !== toolLines.length || materials.length !== materialLines.length) return null;

  const useCompanyQualityDefaults = formData.get("useCompanyDefaults") === "on";
  const qualityTargetPercent = useCompanyQualityDefaults ? null : percentOrNull(formData.get("qualityTarget"));
  const warningDeltaPercent = useCompanyQualityDefaults ? null : percentOrNull(formData.get("warningDelta"));
  const criticalDeltaPercent = useCompanyQualityDefaults ? null : percentOrNull(formData.get("criticalDelta"));
  const targetNumber = qualityTargetPercent === null ? null : Number(qualityTargetPercent);
  const warningNumber = warningDeltaPercent === null ? null : Number(warningDeltaPercent);
  const deltaNumber = criticalDeltaPercent === null ? null : Number(criticalDeltaPercent);
  if (!useCompanyQualityDefaults && (targetNumber === null || warningNumber === null || deltaNumber === null || !(warningNumber > 0 && warningNumber < deltaNumber && deltaNumber < targetNumber))) return null;

  const plannedStartAt = calendarDate(formData.get("plannedStart"));
  const plannedDeliveryAt = calendarDate(formData.get("plannedDelivery"));
  if (!planningDatesValid(plannedStartAt, plannedDeliveryAt)) return null;

  return {
    partId,
    targetQuantity,
    plannedStartAt,
    plannedDeliveryAt,
    timePerPiece: decimalOrNull(formData.get("timePerPiece")),
    expectedScrap: decimalOrNull(formData.get("expectedScrap")),
    qualityTargetPercent,
    warningDeltaPercent,
    criticalDeltaPercent,
    useCompanyQualityDefaults,
    machineId: machine?.id ?? null,
    otherOperationalCost: decimalOrNull(formData.get("otherOperationalCost")),
    agreedOperationalValue: decimalOrNull(formData.get("agreedOperationalValue")),
    toolLines: toolLines.map((line) => ({
      ...line,
      unitCost: tools.find((tool) => tool.id === line.id)!.unitCost,
    })),
    materialLines: materialLines.map((line) => ({
      ...line,
      unitCost: materials.find((material) => material.id === line.id)!.unitCost,
    })),
  };
}

export async function createDraftOrder(_state: string | null, formData: FormData): Promise<string | null> {
  const member = await requirePlanner();
  let orderId = "";
  const failed = await withTenant(member.session.companyId, async (tx) => {
    const code = String(formData.get("code") ?? "").trim();
    const partId = String(formData.get("partId") ?? "");
    const plannedStartAt = calendarDate(formData.get("plannedStart"));
    const plannedDeliveryAt = calendarDate(formData.get("plannedDelivery"));
    const part = await tx.part.findFirst({ where: { id: partId, companyId: member.session.companyId, hiddenAt: null, retiredAt: null } });
    const duplicate = code ? await tx.productionOrder.findFirst({ where: { companyId: member.session.companyId, code, hiddenAt: null } }) : null;
    const targetQuantity = Number(formData.get("targetQuantity"));
    if (!code || !part || duplicate || !planningDatesValid(plannedStartAt, plannedDeliveryAt) || !Number.isInteger(targetQuantity) || targetQuantity < 1) return true;
    const order = await tx.productionOrder.create({
      data: {
        companyId: member.session.companyId,
        code,
        partId,
        targetQuantity: Number(formData.get("targetQuantity")),
        plannedStartAt,
        plannedDeliveryAt,
        phase: OrderPhase.DRAFT,
        estimate: {
          create: {
            companyId: member.session.companyId,
            useCompanyQualityDefaults: true,
            timePerPiece: decimalOrNull(formData.get("timePerPiece")),
          },
        },
      },
    });
    orderId = order.id;
    const source = await tx.part.findFirst({
      where: { id: partId, companyId: member.session.companyId },
      select: { drawingKey: true, drawingName: true, dimensions: { where: { enabled: true }, orderBy: { reference: "asc" } } },
    });
    const uploaded = formData.get("drawing");
    if (uploaded instanceof File && uploaded.size > 0 && uploaded.size <= 15 * 1024 * 1024) {
      const extension = uploaded.name.split(".").pop()?.toLowerCase() ?? "";
      if (["pdf", "png", "jpg", "jpeg", "webp"].includes(extension)) {
        const key = objectKey(member.session.companyId, "drawings");
        await writeObject(key, new Uint8Array(await uploaded.arrayBuffer()));
        await tx.drawing.create({
          data: { companyId: member.session.companyId, productionOrderId: order.id, storageKey: key, fileName: uploaded.name || "drawing", addedAt: new Date() },
        });
      }
    } else if (source?.drawingKey) {
      try {
        const bytes = await readObject(source.drawingKey);
        const key = objectKey(member.session.companyId, "drawings");
        await writeObject(key, bytes);
        await tx.drawing.create({
          data: {
            companyId: member.session.companyId,
            productionOrderId: order.id,
            storageKey: key,
            fileName: source.drawingName || "drawing",
            addedAt: new Date(),
          },
        });
      } catch {
        // A missing article file does not block the order snapshot.
      }
    }
    const posted = readControls(formData.get("controls"));
    if (posted.length > 0) {
      await tx.controlPlan.create({
        data: {
          companyId: member.session.companyId,
          productionOrderId: order.id,
          controls: {
            create: posted.map((row) => {
              const nominal = new Prisma.Decimal(decimalText(row.nominal));
              const fit = fitDeviations(Number(nominal), row.toleranceKind);
              const upperDeviation = fit
                ? new Prisma.Decimal(fit.upper)
                : row.toleranceKind === "symmetric"
                  ? new Prisma.Decimal(decimalText(row.tolerance)).abs()
                  : new Prisma.Decimal(decimalText(row.upperDeviation)).abs();
              const lowerDeviation = fit
                ? new Prisma.Decimal(fit.lower)
                : row.toleranceKind === "symmetric"
                  ? upperDeviation.negated()
                  : new Prisma.Decimal(decimalText(row.lowerDeviation)).abs().negated();
              return {
                companyId: member.session.companyId,
                name: `${row.reference} ${row.dimensionName}`,
                nominal,
                toleranceKind: row.toleranceKind,
                upperDeviation,
                lowerDeviation,
                lowerLimit: nominal.plus(lowerDeviation),
                upperLimit: nominal.plus(upperDeviation),
                frequency: row.frequency,
                markerX: row.placed ? row.x : null,
                markerY: row.placed ? row.y : null,
              };
            }),
          },
        },
      });
    } else if (source && source.dimensions.length > 0) {
      await tx.controlPlan.create({
        data: {
          companyId: member.session.companyId,
          productionOrderId: order.id,
          controls: {
            create: source.dimensions.map((row) => ({
              companyId: member.session.companyId,
              name: `${row.reference} ${row.dimensionName}`,
              nominal: row.nominal,
              toleranceKind: row.toleranceKind,
              upperDeviation: row.upperDeviation,
              lowerDeviation: row.lowerDeviation,
              lowerLimit: row.lowerLimit,
              upperLimit: row.upperLimit,
              frequency: row.frequency,
              markerX: row.markerX,
              markerY: row.markerY,
            })),
          },
        },
      });
    }
    await recordAudit(tx, {
      companyId: member.session.companyId,
      actorUserId: member.user.id,
      action: AuditAction.ORDER_CREATED,
      subjectType: AuditSubjectType.PRODUCTION_ORDER,
      subjectId: order.id,
    });
    return false;
  });
  if (failed || !orderId) return "common.required";
  revalidatePath("/dashboard/orders");
  redirect("/dashboard/orders?view=draft");
}

export async function assignOrderDesk(formData: FormData): Promise<void> {
  const member = await requirePlanner();
  const orderId = String(formData.get("orderId") ?? "");
  await withTenant(member.session.companyId, async (tx) => {
    const order = await tx.productionOrder.findFirst({
      where: { id: orderId, companyId: member.session.companyId, phase: OrderPhase.DRAFT, hiddenAt: null },
      include: { estimate: true },
    });
    if (!order?.estimate) return;
    const machineId = String(formData.get("machineId") ?? "");
    const machine = machineId ? await tx.machine.findFirst({ where: { id: machineId, companyId: member.session.companyId, hiddenAt: null } }) : null;
    if (machineId && !machine) return;
    const operatorId = String(formData.get("operatorId") ?? "");
    const operator = operatorId
      ? await tx.user.findFirst({ where: { id: operatorId, companyId: member.session.companyId, revokedAt: null, roleAssignments: { some: { role: RoleName.OPERATOR, revokedAt: null } } } })
      : null;
    if (operatorId && !operator) return;
    await tx.productionOrder.update({ where: { id: order.id }, data: { assignedOperatorId: operator?.id ?? null } });
    await tx.estimate.update({ where: { id: order.estimate.id }, data: { machineId: machine?.id ?? null } });
  });
  revalidatePath(`/dashboard/orders/${orderId}`);
  redirect(`/dashboard/orders/${orderId}`);
}

export async function saveQualityRules(formData: FormData): Promise<void> {
  const member = await requirePlanner();
  const orderId = String(formData.get("orderId") ?? "");
  const invalid = await withTenant(member.session.companyId, async (tx) => {
    const order = await tx.productionOrder.findFirst({
      where: { id: orderId, companyId: member.session.companyId, phase: { in: [OrderPhase.DRAFT, OrderPhase.IN_PRODUCTION] }, hiddenAt: null },
      include: { estimate: true },
    });
    if (!order?.estimate) return true;
    const useCompanyQualityDefaults = formData.get("useCompanyDefaults") === "on";
    const qualityTargetPercent = useCompanyQualityDefaults ? null : percentOrNull(formData.get("qualityTarget"));
    const warningDeltaPercent = useCompanyQualityDefaults ? null : percentOrNull(formData.get("warningDelta"));
    const criticalDeltaPercent = useCompanyQualityDefaults ? null : percentOrNull(formData.get("criticalDelta"));
    const targetNumber = qualityTargetPercent === null ? null : Number(qualityTargetPercent);
    const warningNumber = warningDeltaPercent === null ? null : Number(warningDeltaPercent);
    const deltaNumber = criticalDeltaPercent === null ? null : Number(criticalDeltaPercent);
    if (!useCompanyQualityDefaults && (targetNumber === null || warningNumber === null || deltaNumber === null || !qualityThresholdsValid(targetNumber, warningNumber, deltaNumber))) return true;
    await tx.estimate.update({
      where: { id: order.estimate.id },
      data: { useCompanyQualityDefaults, qualityTargetPercent, warningDeltaPercent, criticalDeltaPercent },
    });
    return false;
  });
  revalidatePath(`/dashboard/orders/${orderId}`);
  redirect(invalid ? `/dashboard/orders/${orderId}?error=order.qualityRulesInvalid` : `/dashboard/orders/${orderId}`);
}

export async function saveOrderSettings(_state: string | null, formData: FormData): Promise<string | null> {
  const member = await requireMember();
  const planner = hasRole(member.activeRoles, RoleName.OWNER) || hasRole(member.activeRoles, RoleName.PRODUCTION_MANAGER);
  if (!planner && !hasRole(member.activeRoles, RoleName.OPERATOR)) redirect("/dashboard");
  const orderId = String(formData.get("orderId") ?? "");
  const failed = await withTenant(member.session.companyId, async (tx) => {
    const order = await tx.productionOrder.findFirst({
      where: { id: orderId, companyId: member.session.companyId, phase: OrderPhase.DRAFT, hiddenAt: null },
      include: { estimate: true, controlPlan: true },
    });
    if (!order?.estimate) return true;
    if (!planner && (!order.operatorCanEdit || order.assignedOperatorId !== member.user.id)) return true;
    const postedQuantity = formData.get("targetQuantity");
    const targetQuantity = postedQuantity == null || String(postedQuantity).trim() === "" ? order.targetQuantity : Number(postedQuantity);
    if (!Number.isInteger(targetQuantity) || targetQuantity < 1) return true;
    const machineId = String(formData.get("machineId") ?? "");
    const machine = machineId ? await tx.machine.findFirst({ where: { id: machineId, companyId: member.session.companyId, hiddenAt: null } }) : null;
    if (machineId && !machine) return true;
    const operatorId = String(formData.get("operatorId") ?? "");
    const operator = operatorId
      ? await tx.user.findFirst({ where: { id: operatorId, companyId: member.session.companyId, revokedAt: null, roleAssignments: { some: { role: RoleName.OPERATOR, revokedAt: null } } } })
      : null;
    if (operatorId && !operator) return true;
    const useCompanyQualityDefaults = formData.get("useCompanyDefaults") === "on";
    const qualityTargetPercent = useCompanyQualityDefaults ? null : percentOrNull(formData.get("qualityTarget"));
    const warningDeltaPercent = useCompanyQualityDefaults ? null : percentOrNull(formData.get("warningDelta"));
    const criticalDeltaPercent = useCompanyQualityDefaults ? null : percentOrNull(formData.get("criticalDelta"));
    const targetNumber = qualityTargetPercent === null ? null : Number(qualityTargetPercent);
    const warningNumber = warningDeltaPercent === null ? null : Number(warningDeltaPercent);
    const deltaNumber = criticalDeltaPercent === null ? null : Number(criticalDeltaPercent);
    if (!useCompanyQualityDefaults && (targetNumber === null || warningNumber === null || deltaNumber === null || !(warningNumber > 0 && warningNumber < deltaNumber && deltaNumber < targetNumber))) return true;
    const toolLines = lines(formData, "toolId", "toolQuantity");
    const tools = toolLines.length
      ? await tx.tool.findMany({ where: { companyId: member.session.companyId, id: { in: toolLines.map((line) => line.id) }, hiddenAt: null } })
      : [];
    if (tools.length !== toolLines.length) return true;
    const controls = readControls(formData.get("controls"));
    await tx.productionOrder.update({
      where: { id: order.id },
      data: {
        targetQuantity,
        assignedOperatorId: operator?.id ?? null,
        ...(planner ? { operatorCanEdit: formData.get("operatorCanEdit") === "on" } : {}),
      },
    });
    await tx.estimateToolUse.deleteMany({ where: { estimateId: order.estimate.id, companyId: member.session.companyId } });
    await tx.estimate.update({
      where: { id: order.estimate.id },
      data: {
        timePerPiece: formData.has("timePerPiece") ? decimalOrNull(formData.get("timePerPiece")) : order.estimate.timePerPiece,
        expectedScrap: formData.has("expectedScrap") ? decimalOrNull(formData.get("expectedScrap")) : order.estimate.expectedScrap,
        qualityTargetPercent,
        warningDeltaPercent,
        criticalDeltaPercent,
        useCompanyQualityDefaults,
        machineId: machine?.id ?? null,
        toolUses: {
          create: toolLines.map((line) => ({
            companyId: member.session.companyId,
            toolId: line.id,
            quantity: line.quantity,
            unitCost: tools.find((tool) => tool.id === line.id)!.unitCost,
          })),
        },
      },
    });
    const plan = order.controlPlan ?? await tx.controlPlan.create({
      data: { companyId: member.session.companyId, productionOrderId: order.id },
    });
    await tx.control.deleteMany({ where: { controlPlanId: plan.id, companyId: member.session.companyId, measurements: { none: {} } } });
    if (controls.length > 0) {
      await tx.control.createMany({
        data: controls.map((row) => {
          const nominal = new Prisma.Decimal(decimalText(row.nominal));
          const fit = fitDeviations(Number(nominal), row.toleranceKind);
          const upperDeviation = fit
            ? new Prisma.Decimal(fit.upper)
            : row.toleranceKind === "symmetric"
              ? new Prisma.Decimal(decimalText(row.tolerance)).abs()
              : new Prisma.Decimal(decimalText(row.upperDeviation)).abs();
          const lowerDeviation = fit
            ? new Prisma.Decimal(fit.lower)
            : row.toleranceKind === "symmetric"
              ? upperDeviation.negated()
              : new Prisma.Decimal(decimalText(row.lowerDeviation)).abs().negated();
          return {
            companyId: member.session.companyId,
            controlPlanId: plan.id,
            name: `${row.reference} ${row.dimensionName}`,
            nominal,
            toleranceKind: row.toleranceKind,
            upperDeviation,
            lowerDeviation,
            lowerLimit: nominal.plus(lowerDeviation),
            upperLimit: nominal.plus(upperDeviation),
            frequency: row.frequency,
            markerX: row.placed ? row.x : null,
            markerY: row.placed ? row.y : null,
          };
        }),
      });
    }
    return false;
  });
  if (failed) return "common.required";
  revalidatePath(`/dashboard/orders/${orderId}`);
  revalidatePath(`/dashboard/orders/${orderId}/settings`);
  redirect(`/dashboard/orders/${orderId}/settings`);
}

function readControls(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.trim() === "") return [];
  try {
    const parsed = JSON.parse(value) as {
      reference?: string;
      dimensionName?: string;
      nominal?: number;
      toleranceKind?: string;
      tolerance?: number;
      upperDeviation?: number;
      lowerDeviation?: number;
      frequency?: number;
        x?: number;
        y?: number;
        placed?: boolean;
    }[];
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((row) => {
      const reference = String(row.reference ?? "");
      if (!["A", "B", "C", "D", "E"].includes(reference)) return [];
      const dimensionName = String(row.dimensionName ?? "").trim();
      if (!dimensionName) return [];
      const rawKind = String(row.toleranceKind ?? "");
      const kind = isToleranceKind(rawKind) ? rawKind : "symmetric";
      return [{
        reference,
        dimensionName,
        nominal: decimalText(row.nominal),
        toleranceKind: kind,
        tolerance: decimalText(row.tolerance).replace(/^-/, ""),
        upperDeviation: decimalText(row.upperDeviation).replace(/^-/, ""),
        lowerDeviation: decimalText(row.lowerDeviation).replace(/^-/, ""),
        frequency: Math.max(0, Math.round(Number(row.frequency) || 0)),
        x: Math.min(98, Math.max(2, Number(row.x) || 50)),
        y: Math.min(98, Math.max(2, Number(row.y) || 50)),
        placed: row.placed === true,
      }];
    });
  } catch {
    return [];
  }
}

export async function attachOrderDrawing(formData: FormData): Promise<{ id: string } | { error: string }> {
  const member = await requirePlanner();
  const orderId = String(formData.get("orderId") ?? "");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > 15 * 1024 * 1024) return { error: "documents.fileRequired" };
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const allowedType = file.type === "application/pdf" || file.type === "image/png" || file.type === "image/jpeg" || file.type === "image/webp" || file.type === "";
  if (!["pdf", "png", "jpg", "jpeg", "webp"].includes(extension) || !allowedType) return { error: "documents.fileRequired" };
  const key = objectKey(member.session.companyId, "drawings");
  await writeObject(key, new Uint8Array(await file.arrayBuffer()));
  const saved = await withTenant(member.session.companyId, async (tx) => {
    const order = await tx.productionOrder.findFirst({ where: { id: orderId, companyId: member.session.companyId, hiddenAt: null } });
    if (!order) return null;
    return tx.drawing.create({
      data: { companyId: member.session.companyId, productionOrderId: order.id, storageKey: key, fileName: file.name || "drawing", addedAt: new Date() },
    });
  });
  if (!saved) return { error: "documents.rejected" };
  return { id: saved.id };
}

export async function saveOrderMarkers(orderId: string, markers: { reference: string; x: number; y: number }[]) {
  const member = await requireMember();
  await withTenant(member.session.companyId, async (tx) => {
    const order = await tx.productionOrder.findFirst({
      where: { id: orderId, companyId: member.session.companyId, hiddenAt: null },
      select: { controlPlan: { select: { controls: { select: { id: true, name: true } } } } },
    });
    for (const marker of markers) {
      const control = order?.controlPlan?.controls.find((row) => row.name.startsWith(`${marker.reference} `));
      if (!control) continue;
      await tx.control.update({ where: { id: control.id }, data: { markerX: marker.x, markerY: marker.y } });
    }
  });
}

export async function updateDraftOrder(_state: string | null, formData: FormData): Promise<string | null> {
  const member = await requirePlanner();
  const orderId = String(formData.get("orderId") ?? "");
  const failed = await withTenant(member.session.companyId, async (tx) => {
    const order = await tx.productionOrder.findFirst({
      where: { id: orderId, companyId: member.session.companyId, phase: OrderPhase.DRAFT, hiddenAt: null },
      include: { estimate: true },
    });
    if (!order?.estimate) return true;
    const input = await loadDraftInput(member.session.companyId, formData, tx);
    if (!input) return true;
    if (!canSeeEconomics(member.activeRoles)) {
      input.otherOperationalCost = order.estimate.otherOperationalCost;
      input.agreedOperationalValue = order.estimate.agreedOperationalValue;
    }
    await tx.productionOrder.update({
      where: { id: order.id },
      data: { partId: input.partId, targetQuantity: input.targetQuantity, plannedStartAt: input.plannedStartAt, plannedDeliveryAt: input.plannedDeliveryAt },
    });
    await tx.estimateToolUse.deleteMany({ where: { estimateId: order.estimate.id, companyId: member.session.companyId } });
    await tx.estimateMaterialUse.deleteMany({ where: { estimateId: order.estimate.id, companyId: member.session.companyId } });
    await tx.estimate.update({
      where: { id: order.estimate.id },
      data: {
        timePerPiece: input.timePerPiece,
        expectedScrap: input.expectedScrap,
        qualityTargetPercent: input.qualityTargetPercent,
        warningDeltaPercent: input.warningDeltaPercent,
        criticalDeltaPercent: input.criticalDeltaPercent,
        useCompanyQualityDefaults: input.useCompanyQualityDefaults,
        machineId: input.machineId,
        hourlyRateSnapshot: null,
        otherOperationalCost: input.otherOperationalCost,
        agreedOperationalValue: input.agreedOperationalValue,
        toolUses: {
          create: input.toolLines.map((line) => ({
            companyId: member.session.companyId,
            toolId: line.id,
            quantity: line.quantity,
            unitCost: line.unitCost,
          })),
        },
        materialUses: {
          create: input.materialLines.map((line) => ({
            companyId: member.session.companyId,
            materialId: line.id,
            quantity: line.quantity,
            unitCost: line.unitCost,
          })),
        },
      },
    });
    return false;
  });
  if (failed) return "common.required";
  revalidatePath(`/dashboard/orders/${orderId}`);
  redirect(`/dashboard/orders/${orderId}`);
}

async function beginOrder(orderId: string, requireTime: boolean) {
  const member = await requirePlanner();
  return withTenant(member.session.companyId, async (tx) => {
    const error = await activateDraft(tx, member.session.companyId, orderId, member.user.id, requireTime);
    if (error) return error;
    const order = await tx.productionOrder.findFirst({
      where: { id: orderId, companyId: member.session.companyId },
      select: { assignedOperatorId: true },
    });
    const deskUserId = order?.assignedOperatorId ?? member.user.id;
    await tx.user.updateMany({
      where: { companyId: member.session.companyId, activeProductionOrderId: orderId, id: { not: deskUserId } },
      data: { activeProductionOrderId: null },
    });
    await tx.user.update({ where: { id: deskUserId }, data: { activeProductionOrderId: orderId } });
    return null;
  });
}

export async function scheduleOrderStart(formData: FormData): Promise<void> {
  const member = await requirePlanner();
  const orderId = String(formData.get("orderId") ?? "");
  const when = parseRomeDateTime(String(formData.get("scheduledStartAt") ?? ""));
  const error = !when
    ? "order.scheduleInvalid"
    : when.getTime() < Date.now() - 60_000
      ? "order.schedulePast"
      : null;
  if (!error && when) {
    const missing = await withTenant(member.session.companyId, async (tx) => {
      const order = await tx.productionOrder.findFirst({
        where: { id: orderId, companyId: member.session.companyId, phase: OrderPhase.DRAFT, hiddenAt: null },
      });
      if (!order) return true;
      await tx.productionOrder.update({
        where: { id: order.id },
        data: { scheduledStartAt: when, scheduledStartByUserId: member.user.id },
      });
      return false;
    });
    if (!missing) await promoteDueOrders(member.session.companyId);
    if (missing) {
      revalidatePath(`/dashboard/orders/${orderId}`);
      redirect(`/dashboard/orders/${orderId}?error=common.required`);
    }
  }
  revalidatePath(`/dashboard/orders/${orderId}`);
  redirect(error ? `/dashboard/orders/${orderId}?error=${error}` : `/dashboard/orders/${orderId}`);
}

export async function clearScheduledStart(formData: FormData): Promise<void> {
  const member = await requirePlanner();
  const orderId = String(formData.get("orderId") ?? "");
  await withTenant(member.session.companyId, async (tx) => {
    const order = await tx.productionOrder.findFirst({
      where: { id: orderId, companyId: member.session.companyId, phase: OrderPhase.DRAFT, hiddenAt: null },
    });
    if (!order) return;
    await tx.productionOrder.update({
      where: { id: order.id },
      data: { scheduledStartAt: null, scheduledStartByUserId: null },
    });
  });
  revalidatePath(`/dashboard/orders/${orderId}`);
  redirect(`/dashboard/orders/${orderId}`);
}

export async function startOrder(formData: FormData): Promise<void> {
  const orderId = String(formData.get("orderId") ?? "");
  const error = await beginOrder(orderId, true);
  revalidatePath(`/dashboard/orders/${orderId}`);
  revalidatePath("/dashboard/operator");
  revalidatePath("/dashboard/floor");
  redirect(error ? `/dashboard/orders/${orderId}?error=${error}` : `/dashboard/orders/${orderId}`);
}

export async function activateDraftOrder(formData: FormData): Promise<void> {
  const orderId = String(formData.get("orderId") ?? "");
  const error = await beginOrder(orderId, false);
  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard");
  redirect(error ? "/dashboard/orders?view=draft&error=order.activateFailed" : "/dashboard/orders?view=draft");
}

export async function cancelStart(formData: FormData): Promise<void> {
  const member = await requirePlanner();
  const orderId = String(formData.get("orderId") ?? "");
  await withTenant(member.session.companyId, async (tx) => {
    const order = await tx.productionOrder.findFirst({
      where: { id: orderId, companyId: member.session.companyId, phase: OrderPhase.IN_PRODUCTION },
      include: { actual: true, estimate: true },
    });
    if (!order?.estimate) return;
    if ((order.actual?.goodQuantity ?? 0) !== 0) return;
    const where = { productionOrderId: order.id, companyId: member.session.companyId };
    const blockers = await Promise.all([
      tx.scrap.count({ where }),
      tx.pause.count({ where }),
      tx.downtime.count({ where }),
      tx.toolChange.count({ where }),
      tx.materialConsumption.count({ where }),
      tx.machineTime.count({ where }),
    ]);
    if (blockers.some((count) => count > 0)) return;
    if (order.actual) await tx.actual.delete({ where: { id: order.actual.id } });
    await tx.estimate.update({ where: { id: order.estimate.id }, data: { hourlyRateSnapshot: null } });
    await tx.productionOrder.update({
      where: { id: order.id },
      data: { phase: OrderPhase.DRAFT, startedAt: null },
    });
    await recordAudit(tx, {
      companyId: member.session.companyId,
      actorUserId: member.user.id,
      action: AuditAction.ORDER_START_UNDONE,
      subjectType: AuditSubjectType.PRODUCTION_ORDER,
      subjectId: order.id,
    });
  });
  revalidatePath(`/dashboard/orders/${orderId}`);
  redirect(`/dashboard/orders/${orderId}`);
}

export async function completeOrder(formData: FormData): Promise<void> {
  const member = await requirePlanner();
  const orderId = String(formData.get("orderId") ?? "");
  const error = await withTenant(member.session.companyId, async (tx) => {
    const order = await tx.productionOrder.findFirst({
      where: { id: orderId, companyId: member.session.companyId, phase: OrderPhase.IN_PRODUCTION },
    });
    if (!order) return "common.required";
    const where = { productionOrderId: order.id, companyId: member.session.companyId, endedAt: null };
    const open = (await tx.pause.count({ where })) + (await tx.downtime.count({ where }));
    if (open > 0) return "order.openInterval";
    await tx.productionOrder.update({
      where: { id: order.id },
      data: { phase: OrderPhase.COMPLETED, completedAt: new Date() },
    });
    await recordAudit(tx, {
      companyId: member.session.companyId,
      actorUserId: member.user.id,
      action: AuditAction.ORDER_COMPLETED,
      subjectType: AuditSubjectType.PRODUCTION_ORDER,
      subjectId: order.id,
    });
    return null;
  });
  revalidatePath(`/dashboard/orders/${orderId}`);
  redirect(error ? `/dashboard/orders/${orderId}?error=${error}` : `/dashboard/orders/${orderId}`);
}

function copyCode(base: string, taken: Set<string>) {
  const stem = `${base} COPIA`;
  if (!taken.has(stem)) return stem;
  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${stem} ${index}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${stem} ${Date.now()}`;
}

export async function duplicateOrder(formData: FormData): Promise<void> {
  const member = await requirePlanner();
  const orderId = String(formData.get("orderId") ?? "");
  let createdId = "";
  const failed = await withTenant(member.session.companyId, async (tx) => {
    const source = await tx.productionOrder.findFirst({
      where: { id: orderId, companyId: member.session.companyId, hiddenAt: null, phase: { in: [OrderPhase.IN_PRODUCTION, OrderPhase.COMPLETED] } },
      include: {
        part: { select: { name: true } },
        assignedOperator: { select: { revokedAt: true } },
        estimate: { include: { toolUses: true, materialUses: true, machine: { select: { hiddenAt: true, retiredAt: true } } } },
        controlPlan: { include: { controls: true } },
        drawings: { orderBy: { addedAt: "asc" } },
      },
    });
    if (!source?.estimate) return true;
    const base = (source.code?.trim() || source.part.name).replace(/ copia(?: \d+)?$/i, "").trim();
    const existing = await tx.productionOrder.findMany({
      where: { companyId: member.session.companyId, code: { startsWith: `${base} COPIA` } },
      select: { code: true },
    });
    const code = copyCode(base, new Set(existing.flatMap((row) => row.code ? [row.code] : [])));
    const machineId = source.estimate.machine && !source.estimate.machine.hiddenAt && !source.estimate.machine.retiredAt ? source.estimate.machineId : null;
    const operatorId = source.assignedOperator && !source.assignedOperator.revokedAt ? source.assignedOperatorId : null;
    const toolIds = source.estimate.toolUses.map((use) => use.toolId);
    const materialIds = source.estimate.materialUses.map((use) => use.materialId);
    const [tools, materials] = await Promise.all([
      toolIds.length ? tx.tool.findMany({ where: { companyId: member.session.companyId, id: { in: toolIds } }, select: { id: true } }) : [],
      materialIds.length ? tx.material.findMany({ where: { companyId: member.session.companyId, id: { in: materialIds } }, select: { id: true } }) : [],
    ]);
    const liveTools = new Set(tools.map((tool) => tool.id));
    const liveMaterials = new Set(materials.map((material) => material.id));
    const order = await tx.productionOrder.create({
      data: {
        companyId: member.session.companyId,
        code,
        partId: source.partId,
        targetQuantity: source.targetQuantity,
        plannedStartAt: source.plannedStartAt,
        plannedDeliveryAt: source.plannedDeliveryAt,
        assignedOperatorId: operatorId,
        phase: OrderPhase.DRAFT,
        estimate: {
          create: {
            companyId: member.session.companyId,
            timePerPiece: source.estimate.timePerPiece,
            expectedScrap: source.estimate.expectedScrap,
            machineId,
            hourlyRateSnapshot: null,
            otherOperationalCost: source.estimate.otherOperationalCost,
            agreedOperationalValue: source.estimate.agreedOperationalValue,
            qualityTargetPercent: source.estimate.qualityTargetPercent,
            warningDeltaPercent: source.estimate.warningDeltaPercent,
            criticalDeltaPercent: source.estimate.criticalDeltaPercent,
            useCompanyQualityDefaults: source.estimate.useCompanyQualityDefaults,
            toolUses: {
              create: source.estimate.toolUses.filter((use) => liveTools.has(use.toolId)).map((use) => ({
                companyId: member.session.companyId,
                toolId: use.toolId,
                quantity: use.quantity,
                unitCost: use.unitCost,
              })),
            },
            materialUses: {
              create: source.estimate.materialUses.filter((use) => liveMaterials.has(use.materialId)).map((use) => ({
                companyId: member.session.companyId,
                materialId: use.materialId,
                quantity: use.quantity,
                unitCost: use.unitCost,
              })),
            },
          },
        },
      },
    });
    createdId = order.id;
    if (source.controlPlan && source.controlPlan.controls.length > 0) {
      await tx.controlPlan.create({
        data: {
          companyId: member.session.companyId,
          productionOrderId: order.id,
          controls: {
            create: source.controlPlan.controls.map((control) => ({
              companyId: member.session.companyId,
              name: control.name,
              nominal: control.nominal,
              toleranceKind: control.toleranceKind,
              upperDeviation: control.upperDeviation,
              lowerDeviation: control.lowerDeviation,
              lowerLimit: control.lowerLimit,
              upperLimit: control.upperLimit,
              frequency: control.frequency,
              markerX: control.markerX,
              markerY: control.markerY,
            })),
          },
        },
      });
    }
    for (const drawing of source.drawings) {
      try {
        const bytes = await readObject(drawing.storageKey);
        const key = objectKey(member.session.companyId, "drawings");
        await writeObject(key, bytes);
        await tx.drawing.create({
          data: {
            companyId: member.session.companyId,
            productionOrderId: order.id,
            storageKey: key,
            fileName: drawing.fileName,
            addedAt: new Date(),
          },
        });
      } catch {
        // A missing source file does not block the draft.
      }
    }
    await recordAudit(tx, {
      companyId: member.session.companyId,
      actorUserId: member.user.id,
      action: AuditAction.ORDER_CREATED,
      subjectType: AuditSubjectType.PRODUCTION_ORDER,
      subjectId: order.id,
    });
    return false;
  });
  revalidatePath("/dashboard/orders");
  if (failed || !createdId) redirect(`/dashboard/orders/${orderId}?error=order.duplicateFailed`);
  redirect(`/dashboard/orders/${createdId}`);
}

export async function reopenOrder(formData: FormData): Promise<void> {
  const member = await requirePlanner();
  const orderId = String(formData.get("orderId") ?? "");
  await withTenant(member.session.companyId, async (tx) => {
    const order = await tx.productionOrder.findFirst({
      where: { id: orderId, companyId: member.session.companyId, phase: OrderPhase.COMPLETED },
    });
    if (!order) return;
    await tx.productionOrder.update({
      where: { id: order.id },
      data: { phase: OrderPhase.IN_PRODUCTION, completedAt: null },
    });
    await recordAudit(tx, {
      companyId: member.session.companyId,
      actorUserId: member.user.id,
      action: AuditAction.ORDER_REOPENED,
      subjectType: AuditSubjectType.PRODUCTION_ORDER,
      subjectId: order.id,
    });
  });
  revalidatePath(`/dashboard/orders/${orderId}`);
  redirect(`/dashboard/orders/${orderId}`);
}

export async function cancelDraft(formData: FormData): Promise<void> {
  const member = await requirePlanner();
  const orderId = String(formData.get("orderId") ?? "");
  await withTenant(member.session.companyId, async (tx) => {
    const order = await tx.productionOrder.findFirst({
      where: { id: orderId, companyId: member.session.companyId, phase: OrderPhase.DRAFT },
    });
    if (!order) return;
    await tx.productionOrder.update({
      where: { id: order.id },
      data: { phase: OrderPhase.CANCELLED },
    });
    await recordAudit(tx, {
      companyId: member.session.companyId,
      actorUserId: member.user.id,
      action: AuditAction.ORDER_CANCELLED,
      subjectType: AuditSubjectType.PRODUCTION_ORDER,
      subjectId: order.id,
    });
  });
  revalidatePath("/dashboard/orders");
  redirect("/dashboard/orders");
}
