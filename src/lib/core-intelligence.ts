import type { LearningOutcome, PredictionOutcome, ProcessMemory, RecommendationOutcome } from "@/lib/process-memory";

export type AccuracyClass = "EXCELLENT" | "GOOD" | "MODERATE" | "POOR";

export type ActionSuccessRate = {
  action: string;
  occurrences: number;
  successes: number;
  failures: number;
  successRate: number | null;
};

export type ToolKnowledge = {
  toolCode: string;
  averagePiecesLife: number | null;
  medianPiecesLife: number | null;
  bestLife: number | null;
  worstLife: number | null;
  wearReplacementRate: number | null;
  breakageRate: number | null;
  averageDriftBeforeReplacement: number | null;
  averageVariabilityBeforeReplacement: number | null;
  predictionAccuracy: number | null;
};

export type ToolLifeEstimate = {
  toolCode: string;
  remainingLifePercent: number;
  expectedRemainingPieces: number;
  toolConfidence: number;
};

export function judgeReplaceTool(input: { scoreBefore: number; scoreAfter: number; driftBefore: number; driftAfter: number; toleranceViolations: number }): LearningOutcome {
  const improved = input.scoreAfter > input.scoreBefore && input.driftAfter < input.driftBefore && input.toleranceViolations === 0;
  if (improved) return "SUCCESS";
  const any = input.scoreAfter > input.scoreBefore || input.driftAfter < input.driftBefore;
  return any && input.toleranceViolations === 0 ? "PARTIAL" : "FAILURE";
}

export function judgeStopProduction(input: { issueExisted: boolean; violationsAvoided: boolean; scrapAvoided: boolean }): LearningOutcome {
  if (!input.issueExisted) return "FAILURE";
  return input.violationsAvoided || input.scrapAvoided ? "SUCCESS" : "FAILURE";
}

export function judgeExtraCheck(input: { issueDetected: boolean }): LearningOutcome {
  return input.issueDetected ? "SUCCESS" : "FAILURE";
}

export function recommendationSuccessRates(memory: ProcessMemory): ActionSuccessRate[] {
  const actions = [...new Set(memory.recommendationOutcomes.map((item) => item.recommendedAction))];
  return actions.map((action) => {
    const rows = memory.recommendationOutcomes.filter((item) => item.recommendedAction === action);
    const successes = rows.filter((item) => item.outcome === "SUCCESS").length;
    const failures = rows.filter((item) => item.outcome === "FAILURE").length;
    return {
      action,
      occurrences: rows.length,
      successes,
      failures,
      successRate: rows.length === 0 ? null : Math.round((successes * 100) / rows.length),
    };
  });
}

export function classifyPredictionError(error: number): AccuracyClass {
  if (error <= 5) return "EXCELLENT";
  if (error <= 15) return "GOOD";
  if (error <= 30) return "MODERATE";
  return "POOR";
}

export function predictionError(predictedPieces: number, actualPieces: number) {
  return Math.abs(actualPieces - predictedPieces);
}

export function averagePredictionError(rows: PredictionOutcome[]) {
  if (rows.length === 0) return null;
  return rows.reduce((sum, item) => sum + item.predictionError, 0) / rows.length;
}

export function predictionReliability(rows: PredictionOutcome[]) {
  if (rows.length === 0) return null;
  const reliable = rows.filter((item) => item.predictionError <= 15).length;
  return Math.round((reliable * 100) / rows.length);
}

export function predictionAccuracyBy(memory: ProcessMemory, key: "machineId" | "toolCode" | "dimensionCode" | "diagnosis") {
  const groups = [...new Set(memory.predictionOutcomes.map((item) => item[key]))];
  return groups.map((name) => {
    const rows = memory.predictionOutcomes.filter((item) => item[key] === name);
    return { name, averageError: averagePredictionError(rows), reliability: predictionReliability(rows), count: rows.length };
  });
}

export function buildToolKnowledge(memory: ProcessMemory): ToolKnowledge[] {
  const codes = [...new Set(memory.toolEvents.map((event) => event.toolCode))];
  return codes.map((toolCode) => {
    const events = memory.toolEvents.filter((event) => event.toolCode === toolCode);
    const lives = events.map((event) => event.producedPieces);
    const wear = events.filter((event) => event.eventType === "WEAR_REPLACEMENT").length;
    const breakage = events.filter((event) => event.eventType === "BREAKAGE_REPLACEMENT").length;
    const predictions = memory.predictionOutcomes.filter((item) => item.toolCode === toolCode);
    return {
      toolCode,
      averagePiecesLife: mean(lives),
      medianPiecesLife: median(lives),
      bestLife: lives.length === 0 ? null : Math.max(...lives),
      worstLife: lives.length === 0 ? null : Math.min(...lives),
      wearReplacementRate: events.length === 0 ? null : wear / events.length,
      breakageRate: events.length === 0 ? null : breakage / events.length,
      averageDriftBeforeReplacement: null,
      averageVariabilityBeforeReplacement: null,
      predictionAccuracy: predictionReliability(predictions),
    };
  });
}

export function estimateToolLife(input: {
  toolCode: string;
  averagePiecesLife: number;
  currentProducedPieces: number;
  driftIncreasing: boolean;
  variabilityIncreasing: boolean;
  scrapRate: number;
  processScore: number;
  replacementCount: number;
}): ToolLifeEstimate {
  const base = input.averagePiecesLife - input.currentProducedPieces;
  const stable = input.processScore >= 80 && !input.driftIncreasing && !input.variabilityIncreasing && input.scrapRate < 0.02;
  const penalty = (input.driftIncreasing ? 0 : 0) + (input.variabilityIncreasing ? 4 : 0) + Math.round(input.scrapRate * 40) - (stable ? 2 : 0);
  const expectedRemainingPieces = Math.max(0, Math.round(base - penalty));
  const remainingLifePercent = input.averagePiecesLife <= 0 ? 0 : Math.round((expectedRemainingPieces / input.averagePiecesLife) * 100);
  const toolConfidence = clamp(70 + Math.min(20, input.replacementCount * 2) - (input.driftIncreasing ? 1 : 0), 0, 99);
  return { toolCode: input.toolCode, remainingLifePercent, expectedRemainingPieces, toolConfidence };
}

export function learnedRecommendation(input: Omit<RecommendationOutcome, "id" | "timestamp" | "outcome"> & { outcome: LearningOutcome }): Omit<RecommendationOutcome, "id" | "timestamp"> {
  return input;
}

function mean(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
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
