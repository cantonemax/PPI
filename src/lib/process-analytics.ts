import type { ProcessDiagnosis } from "@/lib/process-gauge";
import type { ProcessMemory, ScrapReason, StopReason } from "@/lib/process-memory";

export type ToolAnalytics = {
  toolCode: string;
  averageLife: number | null;
  averageProducedPieces: number | null;
  wearReplacements: number;
  breakageReplacements: number;
  averageProcessScoreBeforeReplacement: number | null;
  averageScrapRateBeforeReplacement: number | null;
};

export type DimensionAnalytics = {
  dimensionCode: string;
  dimensionName: string;
  controlsPerformed: number;
  averageValue: number | null;
  averageDrift: number | null;
  averageVariability: number | null;
  toleranceViolations: number;
  scrapRelatedEvents: number;
};

export type MachineAnalytics = {
  machineId: string;
  totalMeasurements: number;
  totalScraps: number;
  totalStops: number;
  averageProcessScore: number | null;
  averageToolLife: number | null;
  breakageCount: number;
  wearReplacementCount: number;
};

export type OrderAnalytics = {
  orderId: string;
  measurements: number;
  toolChanges: number;
  scraps: number;
  stops: number;
  averageGaugeScore: number | null;
  mostFrequentDiagnosis: ProcessDiagnosis | null;
};

export type DiagnosisAnalytics = {
  diagnosis: ProcessDiagnosis;
  occurrences: number;
  averageScore: number | null;
  averageToolLife: number | null;
  averageScrapRate: number | null;
};

export type ScrapReasonShare = {
  reason: ScrapReason;
  count: number;
  share: number;
};

export type ScrapAnalytics = {
  topReasons: ScrapReasonShare[];
  distribution: ScrapReasonShare[];
  ratePerMachine: { machineId: string; rate: number | null }[];
  ratePerTool: { toolCode: string; rate: number | null }[];
  ratePerDimension: { dimensionCode: string; rate: number | null }[];
};

export type StopAnalytics = {
  topReasons: { reason: StopReason; count: number }[];
  averageDurationMinutes: number | null;
  stopsPerMachine: { machineId: string; count: number }[];
  stopsPerOrder: { orderId: string; count: number }[];
};

const diagnoses: ProcessDiagnosis[] = [
  "PROCESS_STABLE",
  "TREND_TOWARD_UPPER_LIMIT",
  "TREND_TOWARD_LOWER_LIMIT",
  "TOOL_WEAR_SUSPECTED",
  "THERMAL_DRIFT_DETECTED",
  "INCREASING_VARIABILITY",
  "PROCESS_OUT_OF_CONTROL",
];

export function getToolAnalytics(memory: ProcessMemory): ToolAnalytics[] {
  const codes = unique(memory.toolEvents.map((event) => event.toolCode));
  return codes.map((toolCode) => {
    const events = memory.toolEvents.filter((event) => event.toolCode === toolCode).sort(byTime);
    const scores = events.map((event) => scoreBefore(memory, event.machineId, event.timestamp)).filter((score): score is number => score !== null);
    const rates = events.map((event, index) => {
      const previous = index === 0 ? "" : events[index - 1].timestamp;
      const quantity = memory.scrapEvents
        .filter((scrap) => scrap.machineId === event.machineId && scrap.timestamp >= previous && scrap.timestamp < event.timestamp)
        .reduce((sum, scrap) => sum + scrap.quantity, 0);
      return event.producedPieces > 0 ? quantity / event.producedPieces : null;
    }).filter((rate): rate is number => rate !== null);
    return {
      toolCode,
      averageLife: mean(events.map((event) => event.lifeBeforeReplacement)),
      averageProducedPieces: mean(events.map((event) => event.producedPieces)),
      wearReplacements: events.filter((event) => event.eventType === "WEAR_REPLACEMENT").length,
      breakageReplacements: events.filter((event) => event.eventType === "BREAKAGE_REPLACEMENT").length,
      averageProcessScoreBeforeReplacement: mean(scores),
      averageScrapRateBeforeReplacement: mean(rates),
    };
  });
}

export function getDimensionAnalytics(memory: ProcessMemory): DimensionAnalytics[] {
  const codes = unique(memory.measurements.map((item) => item.dimensionCode));
  return codes.map((dimensionCode) => {
    const rows = memory.measurements.filter((item) => item.dimensionCode === dimensionCode);
    const values = rows.map((item) => item.measuredValue);
    const drifts = rows.map((item) => item.measuredValue - item.target);
    const violations = rows.filter((item) => item.measuredValue < item.minimumTolerance || item.measuredValue > item.maximumTolerance).length;
    const related = memory.scrapEvents.filter((scrap) => attributedDimension(memory, scrap.machineId, scrap.orderId, scrap.timestamp) === dimensionCode).length;
    return {
      dimensionCode,
      dimensionName: rows[0]?.dimensionName ?? dimensionCode,
      controlsPerformed: rows.length,
      averageValue: mean(values),
      averageDrift: mean(drifts),
      averageVariability: deviation(values),
      toleranceViolations: violations,
      scrapRelatedEvents: related,
    };
  });
}

export function getMachineAnalytics(memory: ProcessMemory): MachineAnalytics[] {
  const machines = unique([
    ...memory.measurements.map((item) => item.machineId),
    ...memory.scrapEvents.map((item) => item.machineId),
    ...memory.stopEvents.map((item) => item.machineId),
    ...memory.snapshots.map((item) => item.machineId),
    ...memory.toolEvents.map((item) => item.machineId),
  ]);
  return machines.map((machineId) => {
    const snapshots = memory.snapshots.filter((item) => item.machineId === machineId);
    const tools = memory.toolEvents.filter((item) => item.machineId === machineId);
    return {
      machineId,
      totalMeasurements: memory.measurements.filter((item) => item.machineId === machineId).length,
      totalScraps: memory.scrapEvents.filter((item) => item.machineId === machineId).reduce((sum, item) => sum + item.quantity, 0),
      totalStops: memory.stopEvents.filter((item) => item.machineId === machineId).length,
      averageProcessScore: mean(snapshots.map((item) => item.processScore)),
      averageToolLife: mean(snapshots.map((item) => item.toolLife)),
      breakageCount: tools.filter((item) => item.eventType === "BREAKAGE_REPLACEMENT").length,
      wearReplacementCount: tools.filter((item) => item.eventType === "WEAR_REPLACEMENT").length,
    };
  });
}

export function getOrderAnalytics(memory: ProcessMemory): OrderAnalytics[] {
  const orders = unique([
    ...memory.measurements.map((item) => item.orderId),
    ...memory.toolEvents.map((item) => item.orderId),
    ...memory.scrapEvents.map((item) => item.orderId),
    ...memory.stopEvents.map((item) => item.orderId),
    ...memory.snapshots.map((item) => item.orderId),
  ]);
  return orders.map((orderId) => {
    const snapshots = memory.snapshots.filter((item) => item.orderId === orderId);
    return {
      orderId,
      measurements: memory.measurements.filter((item) => item.orderId === orderId).length,
      toolChanges: memory.toolEvents.filter((item) => item.orderId === orderId).length,
      scraps: memory.scrapEvents.filter((item) => item.orderId === orderId).reduce((sum, item) => sum + item.quantity, 0),
      stops: memory.stopEvents.filter((item) => item.orderId === orderId).length,
      averageGaugeScore: mean(snapshots.map((item) => item.processScore)),
      mostFrequentDiagnosis: mode(snapshots.map((item) => item.diagnosis)),
    };
  });
}

export function getDiagnosisAnalytics(memory: ProcessMemory): DiagnosisAnalytics[] {
  return diagnoses.map((diagnosis) => {
    const rows = memory.snapshots.filter((item) => item.diagnosis === diagnosis);
    const rates = rows.filter((item) => item.measurementCount > 0).map((item) => item.scrapCount / item.measurementCount);
    return {
      diagnosis,
      occurrences: rows.length,
      averageScore: mean(rows.map((item) => item.processScore)),
      averageToolLife: mean(rows.map((item) => item.toolLife)),
      averageScrapRate: mean(rates),
    };
  });
}

export function getScrapAnalytics(memory: ProcessMemory): ScrapAnalytics {
  const total = memory.scrapEvents.reduce((sum, item) => sum + item.quantity, 0);
  const reasons = unique(memory.scrapEvents.map((item) => item.reason)).map((reason) => {
    const count = memory.scrapEvents.filter((item) => item.reason === reason).reduce((sum, item) => sum + item.quantity, 0);
    return { reason, count, share: total === 0 ? 0 : count / total };
  });
  const ranked = [...reasons].sort((left, right) => right.count - left.count);
  return {
    topReasons: ranked,
    distribution: ranked,
    ratePerMachine: unique(memory.measurements.map((item) => item.machineId)).map((machineId) => ({
      machineId,
      rate: rate(scrapQuantity(memory, (item) => item.machineId === machineId), pieces(memory, (item) => item.machineId === machineId)),
    })),
    ratePerTool: unique(memory.measurements.map((item) => item.toolId)).map((toolCode) => ({
      toolCode,
      rate: rate(attributedScrap(memory, (item) => item.toolId === toolCode), pieces(memory, (item) => item.toolId === toolCode)),
    })),
    ratePerDimension: unique(memory.measurements.map((item) => item.dimensionCode)).map((dimensionCode) => ({
      dimensionCode,
      rate: rate(attributedScrap(memory, (item) => item.dimensionCode === dimensionCode), pieces(memory, (item) => item.dimensionCode === dimensionCode)),
    })),
  };
}

export function getStopAnalytics(memory: ProcessMemory): StopAnalytics {
  const reasons = unique(memory.stopEvents.map((item) => item.reason))
    .map((reason) => ({ reason, count: memory.stopEvents.filter((item) => item.reason === reason).length }))
    .sort((left, right) => right.count - left.count);
  return {
    topReasons: reasons,
    averageDurationMinutes: mean(memory.stopEvents.map((item) => item.durationMinutes)),
    stopsPerMachine: unique(memory.stopEvents.map((item) => item.machineId)).map((machineId) => ({
      machineId,
      count: memory.stopEvents.filter((item) => item.machineId === machineId).length,
    })),
    stopsPerOrder: unique(memory.stopEvents.map((item) => item.orderId)).map((orderId) => ({
      orderId,
      count: memory.stopEvents.filter((item) => item.orderId === orderId).length,
    })),
  };
}

function scoreBefore(memory: ProcessMemory, machineId: string, timestamp: string) {
  const earlier = memory.snapshots
    .filter((item) => item.machineId === machineId && item.timestamp < timestamp)
    .sort(byTime);
  return earlier.length === 0 ? null : earlier[earlier.length - 1].processScore;
}

function attributedDimension(memory: ProcessMemory, machineId: string, orderId: string, timestamp: string) {
  const earlier = memory.measurements
    .filter((item) => item.machineId === machineId && item.orderId === orderId && item.timestamp <= timestamp)
    .sort(byTime);
  return earlier.length === 0 ? null : earlier[earlier.length - 1].dimensionCode;
}

function attributedScrap(memory: ProcessMemory, match: (measurement: ProcessMemory["measurements"][number]) => boolean) {
  return memory.scrapEvents.reduce((sum, scrap) => {
    const earlier = memory.measurements.filter((item) => item.machineId === scrap.machineId && item.orderId === scrap.orderId && item.timestamp <= scrap.timestamp).sort(byTime);
    const source = earlier[earlier.length - 1];
    return source && match(source) ? sum + scrap.quantity : sum;
  }, 0);
}

function scrapQuantity(memory: ProcessMemory, match: (scrap: ProcessMemory["scrapEvents"][number]) => boolean) {
  return memory.scrapEvents.filter(match).reduce((sum, item) => sum + item.quantity, 0);
}

function pieces(memory: ProcessMemory, match: (measurement: ProcessMemory["measurements"][number]) => boolean) {
  return memory.measurements.filter(match).reduce((sum, item) => sum + item.piecesSinceLastCheck, 0);
}

function rate(quantity: number, produced: number) {
  return produced > 0 ? quantity / produced : null;
}

function mode(values: ProcessDiagnosis[]): ProcessDiagnosis | null {
  if (values.length === 0) return null;
  const counts = new Map<ProcessDiagnosis, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0][0];
}

function mean(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function deviation(values: number[]) {
  if (values.length < 2) return values.length === 0 ? null : 0;
  const average = mean(values) ?? 0;
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function byTime<T extends { timestamp: string }>(left: T, right: T) {
  return left.timestamp < right.timestamp ? -1 : left.timestamp > right.timestamp ? 1 : 0;
}
