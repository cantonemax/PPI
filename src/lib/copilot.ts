import { OrderPhase, TimeUnit } from "@prisma/client";
import { capability } from "@/lib/capability";

export type Severity = "critical" | "warning" | "info";
export type SignalKind = "quality" | "tooling" | "production" | "margin" | "recommendation" | "trend";

export type CopilotSignal = {
  kind: SignalKind;
  severity: Severity;
  orderId: string;
  subject: string;
  code:
    | "outside"
    | "scrapHistory"
    | "cpk"
    | "toolEstimate"
    | "toolHistory"
    | "time"
    | "downtime"
    | "margin"
    | "cost"
    | "timeSuggestion"
    | "scrapSuggestion"
    | "toolSuggestion"
    | "materialSuggestion"
    | "trend";
  value: string;
};

type Line = { id: string; name: string; quantity: number };
type Interval = { machineId: string; machineName: string; startedAt: Date; endedAt: Date | null };
type Measure = { value: number; lower: number; upper: number; recordedAt: Date; name: string };

export type CopilotOrder = {
  id: string;
  phase: OrderPhase;
  partId: string;
  partName: string;
  completedAt: Date | null;
  timePerPiece: number | null;
  good: number;
  scrap: number;
  agreed: number | null;
  estimatedCost: number;
  actualCost: number;
  machineTimes: Interval[];
  downtimes: Interval[];
  estimatedTools: Line[];
  actualTools: Line[];
  estimatedMaterials: Line[];
  actualMaterials: Line[];
  controls: { name: string; lower: number; upper: number; values: number[] }[];
};

const rank: Record<Severity, number> = { critical: 3, warning: 2, info: 1 };

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function duration(interval: Interval, now: Date): number {
  const end = interval.endedAt ?? now;
  return Math.max(0, end.getTime() - interval.startedAt.getTime());
}

function productive(order: CopilotOrder, now: Date): number {
  return order.machineTimes.reduce((sum, interval) => sum + duration(interval, now), 0);
}

function toUnit(milliseconds: number, timeUnit: TimeUnit): number {
  return timeUnit === TimeUnit.HOUR ? milliseconds / 3_600_000 : milliseconds / 60_000;
}

function scrapRate(order: CopilotOrder): number | null {
  const total = order.good + order.scrap;
  if (total <= 0) return null;
  return order.scrap / total;
}

function timePerGood(order: CopilotOrder, timeUnit: TimeUnit, now: Date): number | null {
  if (order.good <= 0) return null;
  return toUnit(productive(order, now), timeUnit) / order.good;
}

function downtimeRatio(order: CopilotOrder, machineId: string, now: Date): number | null {
  const run = order.machineTimes.filter((interval) => interval.machineId === machineId).reduce((sum, interval) => sum + duration(interval, now), 0);
  const stop = order.downtimes.filter((interval) => interval.machineId === machineId).reduce((sum, interval) => sum + duration(interval, now), 0);
  if (run + stop <= 0) return null;
  return stop / (run + stop);
}

function cpkOf(order: CopilotOrder): number | null {
  const values = order.controls
    .map((control) => capability(control.values, control.lower, control.upper))
    .filter((result) => result?.status === "indices")
    .map((result) => (result.status === "indices" ? result.cpk : 0));
  if (values.length === 0) return null;
  return Math.min(...values);
}

function teaching(orders: CopilotOrder[]): CopilotOrder[] {
  return orders
    .filter((order) => order.phase === OrderPhase.COMPLETED && (order.good > 0 || order.scrap > 0))
    .sort((a, b) => (a.completedAt?.getTime() ?? 0) - (b.completedAt?.getTime() ?? 0));
}

function monotonic(values: number[]): "up" | "down" | null {
  if (values.length < 3) return null;
  let up = true;
  let down = true;
  for (let index = 1; index < values.length; index += 1) {
    if (!(values[index] > values[index - 1])) up = false;
    if (!(values[index] < values[index - 1])) down = false;
  }
  if (up) return "up";
  if (down) return "down";
  return null;
}

export function copilotSignals(orders: CopilotOrder[], timeUnit: TimeUnit, now = new Date()): CopilotSignal[] {
  const memory = teaching(orders);
  const signals: CopilotSignal[] = [];

  for (const order of orders.filter((item) => item.phase === OrderPhase.IN_PRODUCTION)) {
    const history = memory.filter((item) => item.partId === order.partId);
    for (const control of order.controls) {
      const latest = control.values.at(-1);
      if (latest !== undefined && (latest < control.lower || latest > control.upper)) {
        signals.push({ kind: "quality", severity: "critical", orderId: order.id, subject: control.name, code: "outside", value: String(latest) });
      }
    }
    const rate = scrapRate(order);
    const pastRate = mean(history.map(scrapRate).filter((value): value is number => value !== null));
    if (rate !== null && pastRate !== null && rate > pastRate) {
      signals.push({ kind: "quality", severity: "warning", orderId: order.id, subject: order.partName, code: "scrapHistory", value: rate.toFixed(2) });
    }
    const currentCpk = cpkOf(order);
    const previous = [...history].reverse().map(cpkOf).find((value) => value !== null);
    if (currentCpk !== null && previous !== undefined && previous !== null && currentCpk < previous) {
      signals.push({ kind: "quality", severity: "critical", orderId: order.id, subject: order.partName, code: "cpk", value: currentCpk.toFixed(2) });
    }

    for (const line of order.actualTools) {
      const estimate = order.estimatedTools.find((item) => item.id === line.id);
      const perGood = order.good > 0 ? line.quantity / order.good : null;
      const past = mean(
        history
          .filter((item) => item.good > 0)
          .map((item) => item.actualTools.filter((tool) => tool.id === line.id).reduce((sum, tool) => sum + tool.quantity, 0) / item.good)
          .filter((value) => value > 0),
      );
      if (estimate && line.quantity > estimate.quantity) {
        signals.push({ kind: "tooling", severity: "critical", orderId: order.id, subject: line.name, code: "toolEstimate", value: String(line.quantity) });
      } else if (perGood !== null && past !== null && perGood > past) {
        signals.push({ kind: "tooling", severity: "warning", orderId: order.id, subject: line.name, code: "toolHistory", value: perGood.toFixed(2) });
      }
    }

    const actualTime = timePerGood(order, timeUnit, now);
    if (actualTime !== null && order.timePerPiece !== null && actualTime > order.timePerPiece) {
      signals.push({ kind: "production", severity: "critical", orderId: order.id, subject: order.partName, code: "time", value: actualTime.toFixed(2) });
    }
    const machines = new Set([...order.machineTimes.map((interval) => interval.machineId), ...order.downtimes.map((interval) => interval.machineId)]);
    for (const machineId of machines) {
      const ratio = downtimeRatio(order, machineId, now);
      const past = mean(
        memory
          .map((item) => downtimeRatio(item, machineId, now))
          .filter((value): value is number => value !== null),
      );
      if (ratio !== null && past !== null && ratio > past && !(actualTime !== null && order.timePerPiece !== null && actualTime > order.timePerPiece)) {
        const name = [...order.machineTimes, ...order.downtimes].find((interval) => interval.machineId === machineId)?.machineName ?? machineId;
        signals.push({ kind: "production", severity: "warning", orderId: order.id, subject: name, code: "downtime", value: ratio.toFixed(2) });
      }
    }

    if (order.agreed !== null) {
      const expectedMargin = order.agreed - order.estimatedCost;
      const actualMargin = order.agreed - order.actualCost;
      if (actualMargin < expectedMargin) {
        signals.push({ kind: "margin", severity: "critical", orderId: order.id, subject: order.partName, code: "margin", value: actualMargin.toFixed(2) });
      } else if (order.actualCost > order.estimatedCost) {
        signals.push({ kind: "margin", severity: "critical", orderId: order.id, subject: order.partName, code: "cost", value: order.actualCost.toFixed(2) });
      }
    }
  }

  for (const draft of orders.filter((order) => order.phase === OrderPhase.DRAFT)) {
    const history = memory.filter((item) => item.partId === draft.partId);
    const time = mean(history.map((item) => timePerGood(item, timeUnit, now)).filter((value): value is number => value !== null));
    const rate = mean(history.map(scrapRate).filter((value): value is number => value !== null));
    if (time !== null) signals.push({ kind: "recommendation", severity: "info", orderId: draft.id, subject: draft.partName, code: "timeSuggestion", value: time.toFixed(2) });
    if (rate !== null) signals.push({ kind: "recommendation", severity: "info", orderId: draft.id, subject: draft.partName, code: "scrapSuggestion", value: rate.toFixed(2) });
    const toolIds = new Set(history.flatMap((item) => item.actualTools.map((line) => line.id)));
    for (const toolId of toolIds) {
      const ratio = mean(
        history.filter((item) => item.good > 0).map((item) => item.actualTools.filter((line) => line.id === toolId).reduce((sum, line) => sum + line.quantity, 0) / item.good),
      );
      const name = history.flatMap((item) => item.actualTools).find((line) => line.id === toolId)?.name ?? toolId;
      if (ratio !== null) signals.push({ kind: "recommendation", severity: "info", orderId: draft.id, subject: name, code: "toolSuggestion", value: ratio.toFixed(2) });
    }
    const materialIds = new Set(history.flatMap((item) => item.actualMaterials.map((line) => line.id)));
    for (const materialId of materialIds) {
      const ratio = mean(
        history.filter((item) => item.good > 0).map((item) => item.actualMaterials.filter((line) => line.id === materialId).reduce((sum, line) => sum + line.quantity, 0) / item.good),
      );
      const name = history.flatMap((item) => item.actualMaterials).find((line) => line.id === materialId)?.name ?? materialId;
      if (ratio !== null) signals.push({ kind: "recommendation", severity: "info", orderId: draft.id, subject: name, code: "materialSuggestion", value: ratio.toFixed(2) });
    }
  }

  const byPart = new Map<string, CopilotOrder[]>();
  for (const order of memory) {
    const group = byPart.get(order.partId) ?? [];
    group.push(order);
    byPart.set(order.partId, group);
  }
  for (const group of byPart.values()) {
    const values = group.map((order) => timePerGood(order, timeUnit, now)).filter((value): value is number => value !== null);
    if (values.length >= 3 && monotonic(values)) {
      signals.push({ kind: "trend", severity: "info", orderId: group[group.length - 1].id, subject: group[0].partName, code: "trend", value: values.at(-1)!.toFixed(2) });
    }
  }

  const machineIds = new Set(memory.flatMap((order) => [...order.machineTimes, ...order.downtimes].map((interval) => interval.machineId)));
  for (const machineId of machineIds) {
    const series = memory
      .map((order) => ({ order, ratio: downtimeRatio(order, machineId, now) }))
      .filter((item): item is { order: CopilotOrder; ratio: number } => item.ratio !== null);
    if (series.length >= 3 && monotonic(series.map((item) => item.ratio))) {
      const name = series.flatMap((item) => [...item.order.machineTimes, ...item.order.downtimes]).find((interval) => interval.machineId === machineId)?.machineName ?? machineId;
      signals.push({ kind: "trend", severity: "info", orderId: series[series.length - 1].order.id, subject: name, code: "trend", value: series.at(-1)!.ratio.toFixed(2) });
    }
  }
  trendLines(memory, "tool", signals);
  trendLines(memory, "material", signals);

  return signals.sort((a, b) => rank[b.severity] - rank[a.severity]);
}

function trendLines(memory: CopilotOrder[], kind: "tool" | "material", signals: CopilotSignal[]) {
  const ids = new Set(memory.flatMap((order) => (kind === "tool" ? order.actualTools : order.actualMaterials).map((line) => line.id)));
  for (const id of ids) {
    const series = memory
      .filter((order) => order.good > 0)
      .map((order) => {
        const lines = kind === "tool" ? order.actualTools : order.actualMaterials;
        return { order, ratio: lines.filter((line) => line.id === id).reduce((sum, line) => sum + line.quantity, 0) / order.good };
      })
      .filter((item) => item.ratio > 0);
    if (series.length >= 3 && monotonic(series.map((item) => item.ratio))) {
      const lines = kind === "tool" ? series[0].order.actualTools : series[0].order.actualMaterials;
      signals.push({ kind: "trend", severity: "info", orderId: series[series.length - 1].order.id, subject: lines.find((line) => line.id === id)?.name ?? id, code: "trend", value: series.at(-1)!.ratio.toFixed(2) });
    }
  }
}

export function ownerOrder(signal: CopilotSignal): number {
  if (signal.severity === "critical" && signal.kind === "margin") return 1;
  if (signal.severity === "critical" && signal.kind === "production") return 2;
  if (signal.severity === "critical" && signal.kind === "tooling") return 3;
  if (signal.severity === "critical" && signal.kind === "quality") return 4;
  if (signal.severity === "warning") return 5;
  if (signal.kind === "recommendation") return 6;
  return 7;
}

export function qualityOrder(signal: CopilotSignal): number {
  if (signal.code === "outside") return 1;
  if (signal.code === "cpk") return 2;
  return 3;
}
