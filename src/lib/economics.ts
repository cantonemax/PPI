import { TimeUnit } from "@prisma/client";

export type QuantityLine = { id: string; name: string; quantity: number; unitCost: number };
export type MachineInterval = { hourlyRateSnapshot: number; startedAt: Date; endedAt: Date | null };

export type EconomicsInput = {
  timeUnit: TimeUnit;
  targetQuantity: number;
  timePerPiece: number | null;
  expectedScrap: number | null;
  hourlyRateSnapshot: number | null;
  otherOperationalCost: number | null;
  agreedOperationalValue: number | null;
  estimatedTools: QuantityLine[];
  estimatedMaterials: QuantityLine[];
  machineTimes: MachineInterval[];
  toolChanges: QuantityLine[];
  materialConsumptions: QuantityLine[];
  scrapPieces: number;
  now: Date;
};

export type MoneyComparison = {
  estimated: number;
  actual: number;
  difference: number;
};

export type QuantityComparison = {
  id: string;
  name: string;
  estimated: number | null;
  actual: number | null;
  difference: number | null;
};

export type OrderEconomics = {
  estimatedCost: number;
  actualCost: number;
  costDeviation: number;
  expectedMargin: number | null;
  actualMargin: number | null;
  marginDeviation: number | null;
  time: { estimated: number | null; actual: number; difference: number | null };
  scrap: { estimated: number | null; actual: number; difference: number | null };
  tools: QuantityComparison[];
  materials: QuantityComparison[];
};

function hours(milliseconds: number): number {
  return milliseconds / 3_600_000;
}

function estimatedMachineHours(input: EconomicsInput): number {
  if (input.timePerPiece === null || input.hourlyRateSnapshot === null) return 0;
  const total = input.timePerPiece * input.targetQuantity;
  return input.timeUnit === TimeUnit.HOUR ? total : total / 60;
}

export function orderEconomics(input: EconomicsInput): OrderEconomics {
  const machineEstimate = estimatedMachineHours(input) * (input.hourlyRateSnapshot ?? 0);
  const toolEstimate = input.estimatedTools.reduce((sum, line) => sum + line.quantity * line.unitCost, 0);
  const materialEstimate = input.estimatedMaterials.reduce((sum, line) => sum + line.quantity * line.unitCost, 0);
  const other = input.otherOperationalCost ?? 0;
  const estimatedCost = machineEstimate + toolEstimate + materialEstimate + other;

  const machineActual = input.machineTimes.reduce((sum, interval) => {
    const end = interval.endedAt ?? input.now;
    const elapsed = end.getTime() - interval.startedAt.getTime();
    if (elapsed <= 0) return sum;
    return sum + hours(elapsed) * interval.hourlyRateSnapshot;
  }, 0);
  const toolActual = input.toolChanges.reduce((sum, line) => sum + line.quantity * line.unitCost, 0);
  const materialActual = input.materialConsumptions.reduce((sum, line) => sum + line.quantity * line.unitCost, 0);
  const actualCost = machineActual + toolActual + materialActual + other;

  const agreed = input.agreedOperationalValue;
  const expectedMargin = agreed === null ? null : agreed - estimatedCost;
  const actualMargin = agreed === null ? null : agreed - actualCost;

  const estimatedTime = input.timePerPiece === null ? null : input.timePerPiece * input.targetQuantity;
  const actualMilliseconds = input.machineTimes.reduce((sum, interval) => {
    const end = interval.endedAt ?? input.now;
    return sum + Math.max(0, end.getTime() - interval.startedAt.getTime());
  }, 0);
  const actualTime = input.timeUnit === TimeUnit.HOUR ? hours(actualMilliseconds) : actualMilliseconds / 60_000;

  return {
    estimatedCost,
    actualCost,
    costDeviation: actualCost - estimatedCost,
    expectedMargin,
    actualMargin,
    marginDeviation: expectedMargin === null || actualMargin === null ? null : actualMargin - expectedMargin,
    time: {
      estimated: estimatedTime,
      actual: actualTime,
      difference: estimatedTime === null ? null : actualTime - estimatedTime,
    },
    scrap: {
      estimated: input.expectedScrap,
      actual: input.scrapPieces,
      difference: input.expectedScrap === null ? null : input.scrapPieces - input.expectedScrap,
    },
    tools: compareLines(input.estimatedTools, input.toolChanges),
    materials: compareLines(input.estimatedMaterials, input.materialConsumptions),
  };
}

function compareLines(estimated: QuantityLine[], actual: QuantityLine[]): QuantityComparison[] {
  const ids = new Set([...estimated.map((line) => line.id), ...actual.map((line) => line.id)]);
  return [...ids].map((id) => {
    const estimateLines = estimated.filter((line) => line.id === id);
    const actualLines = actual.filter((line) => line.id === id);
    const estimateQty = estimateLines.reduce((sum, line) => sum + line.quantity, 0);
    const actualQty = actualLines.reduce((sum, line) => sum + line.quantity, 0);
    const hasEstimate = estimateLines.length > 0;
    const hasActual = actualLines.length > 0;
    return {
      id,
      name: estimateLines[0]?.name ?? actualLines[0]?.name ?? id,
      estimated: hasEstimate ? estimateQty : null,
      actual: hasActual ? actualQty : null,
      difference: hasEstimate && hasActual ? actualQty - estimateQty : null,
    };
  });
}
