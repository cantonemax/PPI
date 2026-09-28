import { OrderPhase, RoleName, type Prisma } from "@prisma/client";
import { type DrawingMarker, type DrawingReference } from "@/lib/drawing-references";
import { evaluateProcessGauge, type GaugeResult } from "@/lib/process-gauge";
import { withTenant } from "@/lib/prisma";
import { personName } from "@/lib/session-identity";

const orderGaugeInclude = {
  scraps: true,
  actual: true,
  estimate: { include: { toolUses: true } },
  toolChanges: { include: { tool: true }, orderBy: { occurredAt: "desc" as const } },
  machineTimes: true,
  controlPlan: { include: { controls: { include: { measurements: { orderBy: { recordedAt: "asc" as const } } } } } },
  part: { include: { dimensions: { where: { enabled: true }, orderBy: { reference: "asc" as const } } } },
} satisfies Prisma.ProductionOrderInclude;

type GaugeOrder = Prisma.ProductionOrderGetPayload<{ include: typeof orderGaugeInclude }>;

export function liveProcessGauge(order: GaugeOrder, runtimeMinutes: number): GaugeResult | null {
  const controls = (order.controlPlan?.controls ?? []).map((control) => ({
    nominal: Number(control.nominal),
    lower: Number(control.lowerLimit),
    upper: Number(control.upperLimit),
    values: [...control.measurements].sort((left, right) => left.recordedAt.getTime() - right.recordedAt.getTime()).map((measurement) => Number(measurement.value)),
  }));
  const control = [...controls].sort((left, right) => right.values.length - left.values.length).find((item) => item.values.length > 0);
  if (!control) return null;
  const scrap = order.scraps.reduce((sum, item) => sum + item.pieceCount, 0);
  const produced = (order.actual?.goodQuantity ?? 0) + scrap;
  const planned = order.estimate?.toolUses.reduce((sum, use) => sum + Number(use.quantity), 0) ?? 0;
  const used = order.toolChanges.reduce((sum, change) => sum + Number(change.quantity), 0);
  const toolLife = planned <= 0 ? 100 : Math.max(0, Math.min(100, Math.round((1 - used / planned) * 100)));
  return evaluateProcessGauge({
    measurements: control.values,
    toleranceMin: control.lower,
    toleranceMax: control.upper,
    target: control.nominal,
    producedQuantity: produced,
    toolRemainingLife: toolLife,
    scrapCount: scrap,
    machineRuntime: runtimeMinutes,
    toolChangeEvents: order.toolChanges.length,
  });
}

function runtimeMinutes(startedAt: Date, now: Date) {
  return Math.max(0, Math.round((now.getTime() - startedAt.getTime()) / 60000));
}

export async function loadDepartmentGauges(companyId: string) {
  const now = new Date();
  return withTenant(companyId, async (tx) => {
    const [running, stopped] = await Promise.all([
      tx.machineTime.findMany({
        where: { companyId, endedAt: null, productionOrder: { phase: OrderPhase.IN_PRODUCTION, hiddenAt: null } },
        include: { machine: true, productionOrder: { include: orderGaugeInclude } },
      }),
      tx.downtime.findMany({
        where: { companyId, endedAt: null, productionOrder: { phase: OrderPhase.IN_PRODUCTION, hiddenAt: null } },
        include: { machine: true, productionOrder: { include: orderGaugeInclude } },
      }),
    ]);
    const stoppedIds = new Set(stopped.map((row) => row.machineId));
    const rows = [
      ...stopped.flatMap((row) => {
        if (!row.productionOrder) return [];
        const gauge = liveProcessGauge(row.productionOrder, runtimeMinutes(row.startedAt, now));
        return [{ id: row.machineId, name: row.machine.name, score: gauge?.score ?? null }];
      }),
      ...running.filter((row) => !stoppedIds.has(row.machineId)).map((row) => {
        const gauge = liveProcessGauge(row.productionOrder, runtimeMinutes(row.startedAt, now));
        return { id: row.machineId, name: row.machine.name, score: gauge?.score ?? null };
      }),
    ];
    return rows;
  });
}

const letters: DrawingReference[] = ["A", "B", "C", "D", "E"];

function measureText(value: { toString(): string }) {
  const text = value.toString();
  if (!text.includes(".")) return text;
  return text.replace(/0+$/, "").replace(/\.$/, "");
}

export type CockpitSnapshot = {
  orderId: string;
  code: string;
  part: string;
  operator: string;
  machine: string;
  quantity: number;
  worked: number;
  produced: number;
  remaining: number;
  scrap: number;
  tool: string;
  life: number;
  runtime: number;
  toolChanges: number;
  measurements: number[];
  target: number;
  min: number;
  max: number;
  controls: { id: string; reference: DrawingReference; callout: string; every: number; nominal: string; lower: string; upper: string; last: number | null; values: number[] }[];
  markers: DrawingMarker[];
  drawing: { url: string; kind: "image" | "pdf" } | null;
};

export type FloorStation = {
  userId: string;
  name: string;
  machine: string;
  orderCode: string;
  part: string;
};

export async function loadFloorStations(companyId: string): Promise<FloorStation[]> {
  return withTenant(companyId, async (tx) => {
    const users = await tx.user.findMany({
      where: {
        companyId,
        revokedAt: null,
        roleAssignments: { some: { role: RoleName.OPERATOR, revokedAt: null } },
      },
      include: {
        activeProductionOrder: {
          include: {
            part: true,
            machineTimes: { where: { endedAt: null }, include: { machine: true }, orderBy: { startedAt: "desc" } },
          },
        },
      },
    });
    return users
      .map((user) => {
        const order = user.activeProductionOrder;
        const live = order && order.companyId === companyId && order.phase === OrderPhase.IN_PRODUCTION ? order : null;
        return {
          userId: user.id,
          name: personName(user),
          machine: live?.machineTimes[0]?.machine.name ?? "",
          orderCode: live ? live.id.slice(-6).toUpperCase() : "",
          part: live?.part.name ?? "",
        };
      })
      .sort((left, right) => Number(Boolean(right.orderCode)) - Number(Boolean(left.orderCode)) || left.name.localeCompare(right.name, "it"));
  });
}

export async function loadCockpitSnapshot(companyId: string, userId: string): Promise<CockpitSnapshot | null> {
  const now = new Date();
  return withTenant(companyId, async (tx) => {
    const user = await tx.user.findFirst({
      where: { id: userId, companyId, revokedAt: null },
      include: {
        activeProductionOrder: {
          include: {
            ...orderGaugeInclude,
            drawings: { orderBy: { addedAt: "desc" }, take: 1 },
            machineTimes: { include: { machine: true }, orderBy: { startedAt: "desc" } },
            estimate: { include: { toolUses: true, machine: true } },
          },
        },
      },
    });
    const order = user?.activeProductionOrder;
    if (!order || order.companyId !== companyId || order.phase !== OrderPhase.IN_PRODUCTION) return null;
    const open = order.machineTimes.find((interval) => interval.endedAt === null);
    const assignedMachine = open?.machine.name || order.machineTimes[0]?.machine.name || order.estimate?.machine?.name || "";
    const scrap = order.scraps.reduce((sum, item) => sum + item.pieceCount, 0);
    const produced = (order.actual?.goodQuantity ?? 0) + scrap;
    const plannedTools = order.estimate?.toolUses.reduce((sum, use) => sum + Number(use.quantity), 0) ?? 0;
    const usedTools = order.toolChanges.reduce((sum, change) => sum + Number(change.quantity), 0);
    const controls = (order.controlPlan?.controls ?? []).flatMap((control) => {
      const reference = letters.find((letter) => control.name.startsWith(`${letter} `));
      if (!reference) return [];
      return [{
        id: control.id,
        reference,
        callout: control.name.slice(reference.length + 1),
        every: control.frequency,
        nominal: measureText(control.nominal),
        lower: measureText(control.lowerLimit),
        upper: measureText(control.upperLimit),
        last: control.measurements.length === 0 ? null : Number(control.measurements[control.measurements.length - 1].value),
        values: control.measurements.map((item) => Number(item.value)),
      }];
    });
    const primaryIndex = [...(order.controlPlan?.controls ?? [])].reduce((best, control, index, list) => control.measurements.length > list[best].measurements.length ? index : best, 0);
    const primary = order.controlPlan?.controls[primaryIndex];
    const worked = (order.controlPlan?.controls ?? []).reduce((sum, control) => {
      const counted = letters.some((letter) => control.name.startsWith(`${letter} `));
      return counted ? sum + control.measurements.length * control.frequency : sum;
    }, 0);
    return {
      orderId: order.id,
      code: order.id.slice(-6).toUpperCase(),
      part: order.part.name,
      operator: user ? personName(user) : "",
      machine: assignedMachine,
      quantity: order.targetQuantity,
      worked,
      produced,
      remaining: Math.max(0, order.targetQuantity - worked),
      scrap,
      tool: order.toolChanges[0]?.tool.name ?? "",
      life: plannedTools <= 0 ? 100 : Math.max(0, Math.min(100, Math.round((1 - usedTools / plannedTools) * 100))),
      runtime: open ? runtimeMinutes(open.startedAt, now) : 0,
      toolChanges: order.toolChanges.length,
      measurements: [...(primary?.measurements ?? [])].sort((left, right) => left.recordedAt.getTime() - right.recordedAt.getTime()).map((item) => Number(item.value)),
      target: primary ? Number(primary.nominal) : 0,
      min: primary ? Number(primary.lowerLimit) : 0,
      max: primary ? Number(primary.upperLimit) : 0,
      controls,
      markers: (order.controlPlan?.controls ?? []).flatMap((row) => {
        const reference = letters.find((letter) => row.name.startsWith(`${letter} `));
        if (!reference || row.markerX === null || row.markerY === null) return [];
        return [{ reference, x: Number(row.markerX), y: Number(row.markerY) }];
      }),
      drawing: order.drawings[0]
        ? { url: `/dashboard/documents/drawing/${order.drawings[0].id}?inline=1`, kind: order.drawings[0].fileName.toLowerCase().endsWith(".pdf") ? "pdf" : "image" }
        : null,
    };
  });
}

export async function loadOrderGauge(companyId: string, orderId: string, machineId: string) {
  const now = new Date();
  return withTenant(companyId, async (tx) => {
    const order = await tx.productionOrder.findFirst({
      where: { id: orderId, companyId, hiddenAt: null },
      include: orderGaugeInclude,
    });
    if (!order) return null;
    const open = order.machineTimes.find((interval) => interval.machineId === machineId && interval.endedAt === null);
    const started = open?.startedAt ?? order.startedAt ?? now;
    return liveProcessGauge(order, runtimeMinutes(started, now));
  });
}
