import type { ProcessDiagnosis } from "@/lib/process-gauge";
import { findSimilarCases, getDimensionKnowledge, getMachineKnowledge, getToolKnowledge, type ProcessConditions } from "@/lib/historical-intelligence";
import type { ProcessMemory } from "@/lib/process-memory";

export type DiagnosisReliability = {
  diagnosis: ProcessDiagnosis;
  occurrences: number;
  successfulPredictions: number;
  failedPredictions: number;
  accuracy: number | null;
};

export type PredictionAccuracyRecord = {
  predictionId: string;
  predictedEvent: string;
  actualEvent: string | null;
  predictionHorizon: number | null;
  predictionError: number | null;
  successful: boolean;
};

export type EnhancedToolKnowledge = {
  toolCode: string;
  averageLife: number | null;
  medianLife: number | null;
  bestLife: number | null;
  worstLife: number | null;
  wearReplacementRate: number | null;
  breakageRate: number | null;
  predictionAccuracy: number | null;
};

export type EnhancedDimensionKnowledge = {
  dimensionCode: string;
  averageDrift: number | null;
  averageVariability: number | null;
  toleranceViolationRate: number | null;
  predictionAccuracy: number | null;
};

export type EnhancedMachineKnowledge = {
  machineId: string;
  averageScore: number | null;
  scrapRate: number | null;
  stopRate: number | null;
  predictionAccuracy: number | null;
  mostFrequentDiagnosis: ProcessDiagnosis | null;
};

export type EnhancedRecommendation = {
  action: string;
  confidence: number;
  supportedBy: number;
  historicalSuccessRate: number;
  experienceScore: number;
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

export function getDiagnosisReliability(memory: ProcessMemory): DiagnosisReliability[] {
  return diagnoses.map((diagnosis) => {
    const rows = paired(memory).filter((item) => item.diagnosis === diagnosis);
    const successfulPredictions = rows.filter((item) => item.successful).length;
    const failedPredictions = rows.length - successfulPredictions;
    return {
      diagnosis,
      occurrences: rows.length,
      successfulPredictions,
      failedPredictions,
      accuracy: rows.length === 0 ? null : Math.floor((successfulPredictions * 100) / rows.length),
    };
  });
}

export function buildPredictionAccuracy(memory: ProcessMemory): PredictionAccuracyRecord[] {
  return paired(memory).map((item) => ({
    predictionId: item.predictionId,
    predictedEvent: item.predictedEvent,
    actualEvent: item.actualEvent,
    predictionHorizon: horizonOf(item.predictedEvent),
    predictionError: null,
    successful: item.successful,
  }));
}

export function measurePredictionError(predictedPieces: number, actualPieces: number) {
  return {
    predictedEvent: `Out of tolerance in ${predictedPieces} pcs`,
    actualEvent: `Out of tolerance in ${actualPieces} pcs`,
    predictionHorizon: predictedPieces,
    predictionError: Math.abs(actualPieces - predictedPieces),
  };
}

export function getEnhancedToolKnowledge(memory: ProcessMemory): EnhancedToolKnowledge[] {
  const accuracy = accuracyForMachine(memory);
  return getToolKnowledge(memory).map((tool) => {
    const events = memory.toolEvents.filter((event) => event.toolCode === tool.toolCode);
    const total = events.length;
    const wear = events.filter((event) => event.eventType === "WEAR_REPLACEMENT").length;
    const breakage = events.filter((event) => event.eventType === "BREAKAGE_REPLACEMENT").length;
    const machineId = events[0]?.machineId;
    return {
      toolCode: tool.toolCode,
      averageLife: tool.averageLife,
      medianLife: median(events.map((event) => event.lifeBeforeReplacement)),
      bestLife: tool.bestLife,
      worstLife: tool.worstLife,
      wearReplacementRate: total === 0 ? null : wear / total,
      breakageRate: total === 0 ? null : breakage / total,
      predictionAccuracy: machineId ? accuracy.get(machineId) ?? null : null,
    };
  });
}

export function getEnhancedDimensionKnowledge(memory: ProcessMemory): EnhancedDimensionKnowledge[] {
  const accuracy = accuracyForMachine(memory);
  return getDimensionKnowledge(memory).map((dimension) => {
    const rows = memory.measurements.filter((item) => item.dimensionCode === dimension.dimensionCode);
    const machineId = rows[0]?.machineId;
    return {
      dimensionCode: dimension.dimensionCode,
      averageDrift: dimension.averageDrift,
      averageVariability: dimension.averageVariability,
      toleranceViolationRate: rows.length === 0 ? null : dimension.toleranceViolations / rows.length,
      predictionAccuracy: machineId ? accuracy.get(machineId) ?? null : null,
    };
  });
}

export function getEnhancedMachineKnowledge(memory: ProcessMemory): EnhancedMachineKnowledge[] {
  const accuracy = accuracyForMachine(memory);
  return getMachineKnowledge(memory).map((machine) => {
    const measurements = memory.measurements.filter((item) => item.machineId === machine.machineId).length;
    const stops = memory.stopEvents.filter((item) => item.machineId === machine.machineId).length;
    return {
      machineId: machine.machineId,
      averageScore: machine.averageProcessScore,
      scrapRate: machine.averageScrapRate,
      stopRate: measurements === 0 ? null : stops / measurements,
      predictionAccuracy: accuracy.get(machine.machineId) ?? null,
      mostFrequentDiagnosis: machine.mostFrequentDiagnosis,
    };
  });
}

export function experienceScore(cases: number, accuracyPercent: number, dataVolume: number) {
  const caseFactor = Math.min(1, cases / 10);
  const volumeFactor = Math.min(1, dataVolume / 20);
  return clamp(Math.round(accuracyPercent * caseFactor * volumeFactor), 0, 100);
}

export function enhanceRecommendation(memory: ProcessMemory, conditions: ProcessConditions, action: string, confidence: number): EnhancedRecommendation {
  const similarity = findSimilarCases(memory, conditions);
  const reliability = getDiagnosisReliability(memory).find((item) => item.diagnosis === conditions.diagnosis);
  const historicalSuccessRate = reliability?.accuracy ?? 0;
  const volume = memory.measurements.length + memory.snapshots.length + memory.predictions.length + memory.toolEvents.length;
  const experience = experienceScore(similarity.caseCount, historicalSuccessRate, volume);
  const adjusted = experience === 0 ? confidence : Math.round(confidence + (historicalSuccessRate - confidence) * (experience / 100));
  return {
    action,
    confidence: clamp(adjusted, 0, 99),
    supportedBy: similarity.caseCount,
    historicalSuccessRate,
    experienceScore: experience,
  };
}

function paired(memory: ProcessMemory) {
  return memory.predictions.flatMap((prediction) => {
    const snapshot = memory.snapshots.find((item) => item.timestamp === prediction.timestamp && item.machineId === prediction.machineId && item.orderId === prediction.orderId);
    if (!snapshot) return [];
    return [{
      predictionId: prediction.predictionId,
      diagnosis: snapshot.diagnosis,
      machineId: snapshot.machineId,
      predictedEvent: prediction.predictionMessage,
      actualEvent: snapshot.diagnosis,
      successful: predictionMatches(snapshot.diagnosis, prediction.predictionMessage),
    }];
  });
}

function predictionMatches(diagnosis: ProcessDiagnosis, message: string) {
  if (diagnosis === "PROCESS_STABLE") return message === "NO RISK DETECTED";
  if (diagnosis === "PROCESS_OUT_OF_CONTROL") return message.includes("OUT OF TOLERANCE");
  if (diagnosis === "TOOL_WEAR_SUSPECTED") return message.includes("TOOL");
  if (diagnosis === "TREND_TOWARD_UPPER_LIMIT" || diagnosis === "TREND_TOWARD_LOWER_LIMIT") return message.includes("TOLERANCE");
  if (diagnosis === "THERMAL_DRIFT_DETECTED") return message.includes("TEMPERATURE") || message.includes("DRIFT");
  if (diagnosis === "INCREASING_VARIABILITY") return message.includes("STABILITY") || message.includes("VARIABILITY");
  return false;
}

function accuracyForMachine(memory: ProcessMemory) {
  const groups = new Map<string, { success: number; total: number }>();
  paired(memory).forEach((item) => {
    const group = groups.get(item.machineId) ?? { success: 0, total: 0 };
    group.total += 1;
    if (item.successful) group.success += 1;
    groups.set(item.machineId, group);
  });
  return new Map([...groups.entries()].map(([machineId, group]) => [machineId, group.total === 0 ? null : Math.floor((group.success * 100) / group.total)]));
}

function horizonOf(message: string) {
  const match = message.match(/(\d+)\s*pcs/i);
  return match ? Number(match[1]) : null;
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
