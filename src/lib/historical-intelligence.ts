import type { ProcessDiagnosis } from "@/lib/process-gauge";
import { getDimensionAnalytics, getMachineAnalytics, getOrderAnalytics, getScrapAnalytics, getStopAnalytics, getToolAnalytics } from "@/lib/process-analytics";
import type { ProcessMemory } from "@/lib/process-memory";

export type ProcessConditions = {
  measurements: number[];
  drift: number;
  variability: number;
  toolLife: number;
  diagnosis: ProcessDiagnosis;
};

export type SimilarCase = {
  snapshotId: string;
  diagnosis: ProcessDiagnosis;
  processScore: number;
  toolLife: number;
  outcome: string | null;
};

export type HistoricalSimilarity = {
  cases: SimilarCase[];
  caseCount: number;
  averageOutcome: string | null;
  historicalConfidence: number;
  averageRemainingLife: number | null;
};

export type ToolKnowledge = {
  toolCode: string;
  averageLife: number | null;
  bestLife: number | null;
  worstLife: number | null;
  wearReplacements: number;
  breakageReplacements: number;
  averageScrapRate: number | null;
  averageProcessScoreBeforeReplacement: number | null;
};

export type DimensionKnowledge = {
  dimensionCode: string;
  dimensionName: string;
  controlsPerformed: number;
  averageDrift: number | null;
  averageVariability: number | null;
  averageProcessScore: number | null;
  toleranceViolations: number;
  associatedScrapEvents: number;
};

export type MachineKnowledge = {
  machineId: string;
  averageProcessScore: number | null;
  mostFrequentDiagnosis: ProcessDiagnosis | null;
  mostFrequentStopCause: string | null;
  averageScrapRate: number | null;
  averageToolLife: number | null;
};

export type HistoricalRecommendationSupport = {
  action: string;
  confidence: number;
  supportedBy: number;
};

export type HistoricalPredictionSupport = {
  predictionMessage: string;
  basedOnCases: number;
  predictionConfidence: number;
};

export function createHistoricalRepository(memory: ProcessMemory) {
  return {
    findSimilarCases: (conditions: ProcessConditions) => findSimilarCases(memory, conditions),
    toolKnowledge: () => getToolKnowledge(memory),
    dimensionKnowledge: () => getDimensionKnowledge(memory),
    machineKnowledge: () => getMachineKnowledge(memory),
    supportRecommendation: (conditions: ProcessConditions, action: string, confidence: number) => supportRecommendation(memory, conditions, action, confidence),
    supportPrediction: (conditions: ProcessConditions, predictionMessage: string) => supportPrediction(memory, conditions, predictionMessage),
  };
}

export function findSimilarCases(memory: ProcessMemory, conditions: ProcessConditions): HistoricalSimilarity {
  const matched = memory.snapshots.filter((snapshot) => snapshot.diagnosis === conditions.diagnosis);
  const cases = matched
    .map((snapshot) => ({
      snapshotId: snapshot.snapshotId,
      diagnosis: snapshot.diagnosis,
      processScore: snapshot.processScore,
      toolLife: snapshot.toolLife,
      outcome: outcomeFor(memory, snapshot.timestamp, snapshot.machineId, snapshot.orderId),
      distance: Math.abs(snapshot.toolLife - conditions.toolLife) + Math.abs(conditions.drift) + Math.abs(conditions.variability),
    }))
    .sort((left, right) => left.distance - right.distance)
    .map(({ distance: _distance, ...item }) => item);
  const outcomes = cases.map((item) => item.outcome).filter((item): item is string => item !== null);
  const averageOutcome = dominant(outcomes);
  const agreeing = averageOutcome === null ? 0 : outcomes.filter((item) => item === averageOutcome).length;
  return {
    cases,
    caseCount: cases.length,
    averageOutcome,
    historicalConfidence: outcomes.length === 0 ? 0 : Math.round((100 * agreeing) / outcomes.length),
    averageRemainingLife: average(cases.map((item) => item.toolLife)),
  };
}

export function getToolKnowledge(memory: ProcessMemory): ToolKnowledge[] {
  const analytics = getToolAnalytics(memory);
  const scrap = getScrapAnalytics(memory);
  return analytics.map((tool) => {
    const lives = memory.toolEvents.filter((event) => event.toolCode === tool.toolCode).map((event) => event.lifeBeforeReplacement);
    const scrapRate = scrap.ratePerTool.find((item) => item.toolCode === tool.toolCode)?.rate ?? tool.averageScrapRateBeforeReplacement;
    return {
      toolCode: tool.toolCode,
      averageLife: tool.averageLife,
      bestLife: lives.length === 0 ? null : Math.max(...lives),
      worstLife: lives.length === 0 ? null : Math.min(...lives),
      wearReplacements: tool.wearReplacements,
      breakageReplacements: tool.breakageReplacements,
      averageScrapRate: scrapRate,
      averageProcessScoreBeforeReplacement: tool.averageProcessScoreBeforeReplacement,
    };
  });
}

export function getDimensionKnowledge(memory: ProcessMemory): DimensionKnowledge[] {
  const machines = new Map<string, string[]>();
  memory.measurements.forEach((item) => {
    const current = machines.get(item.dimensionCode) ?? [];
    current.push(item.machineId);
    machines.set(item.dimensionCode, current);
  });
  return getDimensionAnalytics(memory).map((dimension) => {
    const relatedMachines = new Set(machines.get(dimension.dimensionCode) ?? []);
    const scores = memory.snapshots.filter((item) => relatedMachines.has(item.machineId)).map((item) => item.processScore);
    return {
      dimensionCode: dimension.dimensionCode,
      dimensionName: dimension.dimensionName,
      controlsPerformed: dimension.controlsPerformed,
      averageDrift: dimension.averageDrift,
      averageVariability: dimension.averageVariability,
      averageProcessScore: average(scores),
      toleranceViolations: dimension.toleranceViolations,
      associatedScrapEvents: dimension.scrapRelatedEvents,
    };
  });
}

export function getMachineKnowledge(memory: ProcessMemory): MachineKnowledge[] {
  const machines = getMachineAnalytics(memory);
  const orders = getOrderAnalytics(memory);
  const stops = getStopAnalytics(memory);
  const scrap = getScrapAnalytics(memory);
  return machines.map((machine) => {
    const orderIds = new Set(memory.snapshots.filter((item) => item.machineId === machine.machineId).map((item) => item.orderId));
    const diagnoses = orders.filter((order) => orderIds.has(order.orderId)).map((order) => order.mostFrequentDiagnosis).filter((item): item is ProcessDiagnosis => item !== null);
    return {
      machineId: machine.machineId,
      averageProcessScore: machine.averageProcessScore,
      mostFrequentDiagnosis: dominant(diagnoses),
      mostFrequentStopCause: stops.stopsPerMachine.some((item) => item.machineId === machine.machineId) ? stops.topReasons[0]?.reason ?? null : null,
      averageScrapRate: scrap.ratePerMachine.find((item) => item.machineId === machine.machineId)?.rate ?? null,
      averageToolLife: machine.averageToolLife,
    };
  });
}

export function supportRecommendation(memory: ProcessMemory, conditions: ProcessConditions, action: string, confidence: number): HistoricalRecommendationSupport {
  const similarity = findSimilarCases(memory, conditions);
  return { action, confidence, supportedBy: similarity.caseCount };
}

export function supportPrediction(memory: ProcessMemory, conditions: ProcessConditions, predictionMessage: string): HistoricalPredictionSupport {
  const similarity = findSimilarCases(memory, conditions);
  const messages = similarity.cases
    .map((item) => messageFor(memory, item.snapshotId))
    .filter((item): item is string => item !== null);
  const agreeing = messages.filter((item) => item === predictionMessage).length;
  return {
    predictionMessage,
    basedOnCases: similarity.caseCount,
    predictionConfidence: messages.length === 0 ? 0 : Math.round((100 * agreeing) / messages.length),
  };
}

function outcomeFor(memory: ProcessMemory, timestamp: string, machineId: string, orderId: string) {
  return memory.predictions.find((item) => item.timestamp === timestamp && item.machineId === machineId && item.orderId === orderId)?.recommendedAction ?? null;
}

function messageFor(memory: ProcessMemory, snapshotId: string) {
  const snapshot = memory.snapshots.find((item) => item.snapshotId === snapshotId);
  if (!snapshot) return null;
  return memory.predictions.find((item) => item.timestamp === snapshot.timestamp && item.machineId === snapshot.machineId && item.orderId === snapshot.orderId)?.predictionMessage ?? null;
}

function dominant<T>(values: T[]): T | null {
  if (values.length === 0) return null;
  const counts = new Map<T, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0][0];
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
