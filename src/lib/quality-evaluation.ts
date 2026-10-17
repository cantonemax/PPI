import { SPCEngine } from "@/lib/spc/spc-engine";
import type { IndividualsChartResult, MovingRangeChartResult, WesternElectricRule } from "@/lib/spc/types";
import { StatisticsEngine } from "@/lib/statistics/statistics-engine";

export type QualityState = "optimal" | "moderate" | "poor" | "critical";

export function warningThreshold(target: number, warningDelta: number) {
  return target - warningDelta;
}

export function criticalThreshold(target: number, criticalDelta: number) {
  return target - criticalDelta;
}

/** Interprets an existing quality percentage. Does not compute the percentage. */
export function interpretQuality(quality: number, target: number, warningDelta: number, criticalDelta: number): QualityState {
  if (quality >= target) return "optimal";
  if (quality >= warningThreshold(target, warningDelta)) return "moderate";
  if (quality >= criticalThreshold(target, criticalDelta)) return "poor";
  return "critical";
}

export function qualityDifference(quality: number, target: number) {
  return quality - target;
}

/** Existing presentation of Cpk. The formula lives on StatisticsEngine. */
export function qualityPercentFromCpk(cpk: number) {
  return StatisticsEngine.qualityScore(cpk);
}

const westernElectricRules = ["RULE_1", "RULE_2", "RULE_3", "RULE_4"] as const;

const westernElectricPolicy: Record<WesternElectricRule, { severity: "high" | "medium"; color: string; actionKey: string }> = {
  RULE_1: { severity: "high", color: "#FF4D4F", actionKey: "quality.we.action.rule1" },
  RULE_2: { severity: "medium", color: "#FF9800", actionKey: "quality.we.action.rule2" },
  RULE_3: { severity: "medium", color: "#FF9800", actionKey: "quality.we.action.rule3" },
  RULE_4: { severity: "medium", color: "#FF9800", actionKey: "quality.we.action.rule4" },
};

export type QualityChartMark = {
  index: number;
  rangeIndex: number | null;
  rule: WesternElectricRule;
  color: string;
  actionKey: string;
};

export type QualityControlReading = {
  latest: number | null;
  partOut: boolean;
  processRisk: "none" | "attention" | "critical" | null;
  rules: { rule: WesternElectricRule; active: boolean; severity: "high" | "medium"; color: string; actionKey: string }[];
  individuals: IndividualsChartResult;
  movingRange: MovingRangeChartResult;
  marks: QualityChartMark[];
  cp: number | null;
  cpk: number | null;
  confidence: "low" | "medium" | "good" | "high" | null;
  qualityScore: number | null;
  outOfToleranceRate: number | null;
};

const ruleRank: Record<WesternElectricRule, number> = { RULE_1: 4, RULE_2: 3, RULE_3: 2, RULE_4: 1 };

export function qualityControlReading(input: { values: readonly number[]; lsl: number; usl: number }): QualityControlReading {
  const values = input.values.filter((value) => Number.isFinite(value));
  const latest = values.at(-1) ?? null;
  const capability = StatisticsEngine.capability(values, input.lsl, input.usl);
  const alerts = SPCEngine.evaluateWesternElectric(values);
  const active = new Set(alerts.map((alert) => alert.rule));
  const limits = SPCEngine.controlLimits(values);
  const marks = new Map<number, QualityChartMark>();
  for (const alert of alerts) {
    const policy = westernElectricPolicy[alert.rule];
    const current = marks.get(alert.index);
    if (current && ruleRank[current.rule] >= ruleRank[alert.rule]) continue;
    marks.set(alert.index, {
      index: alert.index,
      rangeIndex: alert.index > 0 ? alert.index - 1 : null,
      rule: alert.rule,
      color: policy.color,
      actionKey: policy.actionKey,
    });
  }
  return {
    latest,
    partOut: SPCEngine.outOfTolerance(latest, input.lsl, input.usl),
    processRisk: SPCEngine.activeSpcRisk(values, input.lsl, input.usl),
    rules: westernElectricRules.map((rule) => ({ rule, active: active.has(rule), ...westernElectricPolicy[rule] })),
    individuals: limits.individuals,
    movingRange: limits.movingRange,
    marks: [...marks.values()],
    cp: capability?.cp ?? null,
    cpk: capability?.cpk ?? null,
    confidence: capability ? StatisticsEngine.confidence(values.length) : null,
    qualityScore: capability ? StatisticsEngine.qualityScore(capability.cpk) : null,
    outOfToleranceRate: SPCEngine.outOfToleranceRate(values, input.lsl, input.usl),
  };
}
