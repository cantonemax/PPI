import { efficiencyPercent, productionProgressPercent, scrapPercent } from "@/lib/economics";
import { toolLifeBand } from "@/lib/recommended-action";
import { SPCEngine } from "@/lib/spc/spc-engine";

export const SCRAP_ACTION_PERCENT = 5;

export type DeskSeverity = "critical" | "high" | "medium" | "low";

export type DeskReason =
  | "stopped"
  | "toolReplace"
  | "scrap"
  | "unstable"
  | "overdue"
  | "attention"
  | "toolCheck"
  | "late"
  | "atRisk";

export type ProductionMachine = {
  id: string;
  name: string;
  orderId: string;
  part: string;
  stopped: boolean;
  processRisk: "none" | "attention" | "critical" | null;
  controlOverdue: boolean;
  toolLife: number;
  toolId: string;
  toolName: string;
  scrapPercent: number | null;
  good: number;
  target: number;
  scrapPieces: number;
  actualTime: number;
  estimatedTime: number | null;
};

export type ProductionDeliveryOrder = {
  id: string;
  part: string;
  machineName: string;
  daysRemaining: number | null;
  band: "high" | "moderate" | "low" | null;
};

export type DeskAlert = {
  severity: DeskSeverity;
  code: DeskReason;
  labelKey: string;
  subject: string;
  machineId: string;
  orderId: string;
};

export type RankedMachine = ProductionMachine & {
  severity: DeskSeverity | null;
  reason: DeskReason | null;
  labelKey: string | null;
};

const severityRank: Record<DeskSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

const reasonMeta: Record<DeskReason, { severity: DeskSeverity; labelKey: string; rank: number }> = {
  stopped: { severity: "critical", labelKey: "process.desk.stopped", rank: 0 },
  late: { severity: "critical", labelKey: "process.desk.late", rank: 1 },
  toolReplace: { severity: "high", labelKey: "process.desk.toolReplace", rank: 2 },
  scrap: { severity: "high", labelKey: "process.desk.scrap", rank: 3 },
  unstable: { severity: "high", labelKey: "process.desk.unstable", rank: 4 },
  overdue: { severity: "medium", labelKey: "process.desk.overdue", rank: 5 },
  atRisk: { severity: "medium", labelKey: "process.desk.atRisk", rank: 6 },
  attention: { severity: "medium", labelKey: "process.desk.attention", rank: 7 },
  toolCheck: { severity: "low", labelKey: "process.desk.toolCheck", rank: 8 },
};

export function controlIsOverdue(produced: number, controls: { frequency: number; measurements: number }[]) {
  return controls.some((control) => control.frequency > 0 && produced >= (control.measurements + 1) * control.frequency);
}

export function machineReasons(machine: ProductionMachine): DeskReason[] {
  const reasons: DeskReason[] = [];
  if (machine.stopped) reasons.push("stopped");
  if (toolLifeBand(machine.toolLife) === "replace") reasons.push("toolReplace");
  if (machine.scrapPercent !== null && machine.scrapPercent >= SCRAP_ACTION_PERCENT) reasons.push("scrap");
  if (machine.processRisk === "critical") reasons.push("unstable");
  if (machine.controlOverdue) reasons.push("overdue");
  if (machine.processRisk === "attention") reasons.push("attention");
  if (toolLifeBand(machine.toolLife) === "check") reasons.push("toolCheck");
  return reasons.sort((left, right) => reasonMeta[left].rank - reasonMeta[right].rank);
}

function deliveryBucket(order: ProductionDeliveryOrder): "late" | "atRisk" | "onSchedule" | null {
  if (order.daysRemaining === null && order.band === null) return null;
  if (order.daysRemaining !== null && order.daysRemaining < 0) return "late";
  if (order.band === "low" || order.band === "moderate") return "atRisk";
  return "onSchedule";
}

export function productionDesk(input: {
  machines: ProductionMachine[];
  orders: ProductionDeliveryOrder[];
  departmentScores: readonly (number | null | undefined)[];
}) {
  const ranked = input.machines.map((machine) => {
    const reasons = machineReasons(machine);
    const reason = reasons[0] ?? null;
    return {
      ...machine,
      severity: reason ? reasonMeta[reason].severity : null,
      reason,
      labelKey: reason ? reasonMeta[reason].labelKey : null,
    };
  });
  ranked.sort((left, right) => {
    const leftRank = left.severity ? severityRank[left.severity] : 4;
    const rightRank = right.severity ? severityRank[right.severity] : 4;
    if (leftRank !== rightRank) return leftRank - rightRank;
    return left.name.localeCompare(right.name, "it");
  });

  const alerts: Record<DeskSeverity, DeskAlert[]> = { critical: [], high: [], medium: [], low: [] };
  for (const machine of input.machines) {
    for (const reason of machineReasons(machine)) {
      const meta = reasonMeta[reason];
      alerts[meta.severity].push({
        severity: meta.severity,
        code: reason,
        labelKey: meta.labelKey,
        subject: machine.name,
        machineId: machine.id,
        orderId: machine.orderId,
      });
    }
  }

  const delivery = { onSchedule: [] as ProductionDeliveryOrder[], atRisk: [] as ProductionDeliveryOrder[], late: [] as ProductionDeliveryOrder[] };
  for (const order of input.orders) {
    const bucket = deliveryBucket(order);
    if (!bucket) continue;
    delivery[bucket].push(order);
    if (bucket === "onSchedule") continue;
    const reason: DeskReason = bucket === "late" ? "late" : "atRisk";
    const meta = reasonMeta[reason];
    alerts[meta.severity].push({
      severity: meta.severity,
      code: reason,
      labelKey: meta.labelKey,
      subject: order.part,
      machineId: "",
      orderId: order.id,
    });
  }
  for (const severity of Object.keys(alerts) as DeskSeverity[]) {
    alerts[severity].sort((left, right) => reasonMeta[left.code].rank - reasonMeta[right.code].rank || left.subject.localeCompare(right.subject, "it"));
  }

  const loads = new Map<string, ProductionMachine>();
  for (const machine of input.machines) {
    const key = machine.orderId || machine.id;
    if (!loads.has(key)) loads.set(key, machine);
  }
  const good = [...loads.values()].reduce((sum, machine) => sum + machine.good, 0);
  const target = [...loads.values()].reduce((sum, machine) => sum + machine.target, 0);
  const scrapPieces = [...loads.values()].reduce((sum, machine) => sum + machine.scrapPieces, 0);
  const actualTime = [...loads.values()].reduce((sum, machine) => sum + machine.actualTime, 0);
  const estimatedTime = [...loads.values()].reduce((sum, machine) => sum + (machine.estimatedTime ?? 0), 0);
  const toolRank = { replace: 0, check: 1, ok: 2 };

  return {
    alerts,
    actionMachines: ranked.filter((machine) => machine.reason !== null),
    machines: ranked,
    status: {
      progress: productionProgressPercent(good, target),
      efficiency: efficiencyPercent(actualTime, estimatedTime > 0 ? estimatedTime : null),
      scrap: scrapPercent(scrapPieces, good + scrapPieces),
      departmentScore: SPCEngine.departmentScore(input.departmentScores),
    },
    tools: [...input.machines]
      .map((machine) => ({
        machineId: machine.id,
        machineName: machine.name,
        toolId: machine.toolId,
        toolName: machine.toolName,
        life: machine.toolLife,
        band: toolLifeBand(machine.toolLife),
      }))
      .sort((left, right) => toolRank[left.band] - toolRank[right.band] || left.life - right.life || left.machineName.localeCompare(right.machineName, "it")),
    delivery,
  };
}
