import type { ProcessDiagnosis, ProcessState } from "@/lib/process-gauge";
import type { ActionContext, Prediction } from "@/lib/prediction";
import { recommendAction, type RecommendedAction } from "@/lib/recommended-action";

export const SPC_MIN_SAMPLE = 5;
const MR_D2 = 1.128;
const MR_D4 = 3.267;

export type SpcTrend = "stable" | "up" | "down";
export type SpcRisk = "none" | "attention" | "critical";

export type SpcInput = {
  measurements: number[];
  toleranceMin: number;
  toleranceMax: number;
  target: number;
  orderId?: string;
  machineId?: string;
  toolId?: string;
  producedQuantity?: number;
  toolRemainingLife?: number;
  scrapCount?: number;
  machineRuntime?: number;
  toolChangeEvents?: number;
  trendMarker?: number;
  checkInterval?: number;
};

export type ImrPoint = { index: number; value: number; movingRange: number | null };

export type SpcResult = {
  ready: boolean;
  sampleSize: number;
  mean: number | null;
  sigma: number | null;
  variance: number | null;
  range: number | null;
  cp: number | null;
  cpk: number | null;
  trend: SpcTrend | null;
  slope: number | null;
  ucl: number | null;
  lcl: number | null;
  mrUcl: number | null;
  imr: ImrPoint[];
  gauge: { score: number | null; state: ProcessState | "INSUFFICIENT"; diagnosis: ProcessDiagnosis | null };
  prediction: Prediction;
  recommendation: RecommendedAction | null;
  risk: SpcRisk | null;
  context: ActionContext;
};

export function evaluateSpc(input: SpcInput): SpcResult {
  const values = input.measurements.filter((value) => Number.isFinite(value));
  const sampleSize = values.length;
  const context = actionContext(input, values);
  if (sampleSize < SPC_MIN_SAMPLE || !(input.toleranceMax > input.toleranceMin)) {
    return emptyResult(sampleSize, context);
  }
  const mean = average(values);
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (sampleSize - 1);
  const sigma = Math.sqrt(variance);
  const range = Math.max(...values) - Math.min(...values);
  const moving = movingRanges(values);
  const mrBar = moving.length > 0 ? average(moving) : 0;
  const sigmaMr = mrBar / MR_D2;
  const centerSigma = sigmaMr > 0 ? sigmaMr : sigma;
  const ucl = mean + 3 * centerSigma;
  const lcl = mean - 3 * centerSigma;
  const capable = sigma > 0;
  const cp = capable ? (input.toleranceMax - input.toleranceMin) / (6 * sigma) : null;
  const cpk = capable ? Math.min((input.toleranceMax - mean) / (3 * sigma), (mean - input.toleranceMin) / (3 * sigma)) : null;
  const window = values.slice(input.trendMarker ?? 0);
  const slope = window.length >= 2 ? linearSlope(window) : 0;
  const half = (input.toleranceMax - input.toleranceMin) / 2;
  const drifting = Math.abs(slope) > half / 40;
  const trend: SpcTrend = !drifting ? "stable" : slope > 0 ? "up" : "down";
  const recent = values.slice(-10);
  const outside = recent.some((value) => value < input.toleranceMin || value > input.toleranceMax);
  const position = positionScore(recent, input.target, input.toleranceMin, input.toleranceMax, half);
  const spread = variabilityScore(standardDeviation(recent), half);
  const driftMark = driftScore(slope, half, Math.max(window.length, recent.length));
  const tool = toolScore(input.toolRemainingLife ?? 100);
  const legacy = clamp(Math.round(0.4 * position + 0.25 * spread + 0.2 * driftMark + 0.15 * tool - Math.min(15, input.scrapCount ?? 0)), 0, 100);
  const capability = cp !== null && cpk !== null ? capabilityScore(cp, cpk) : legacy;
  const score = clamp(Math.round(0.85 * legacy + 0.15 * capability), 0, 100);
  const diagnosis = diagnose({
    outside,
    score,
    toolLife: input.toolRemainingLife ?? 100,
    drifting,
    increasing: context.variabilityIncreasing,
    slope,
    thermal: context.thermal && (input.machineRuntime ?? 0) >= 240,
  });
  const state: ProcessState = outside || diagnosis === "PROCESS_OUT_OF_CONTROL" ? "CRITICAL" : score === null ? "ATTENTION" : score >= 80 ? "STABLE" : score >= 60 ? "ATTENTION" : "CRITICAL";
  const interval = input.checkInterval ?? 20;
  const prediction = predict(input, mean, sigma, slope, interval, context);
  const recommendation = recommendAction(diagnosis, score ?? 0, { ...context, slope, outside });
  const risk: SpcRisk = state === "CRITICAL" || (cpk !== null && cpk < 1) ? "critical" : state === "ATTENTION" || (cpk !== null && cpk < 1.33) ? "attention" : "none";
  return {
    ready: true,
    sampleSize,
    mean,
    sigma,
    variance,
    range,
    cp,
    cpk,
    trend,
    slope,
    ucl,
    lcl,
    mrUcl: moving.length > 0 ? MR_D4 * mrBar : null,
    imr: values.map((value, index) => ({ index, value, movingRange: index === 0 ? null : Math.abs(value - values[index - 1]) })),
    gauge: { score, state, diagnosis },
    prediction,
    recommendation,
    risk,
    context: { ...context, slope, outside },
  };
}

export type DepartmentSpc = {
  gauge: number | null;
  averageCp: number | null;
  averageCpk: number | null;
  criticalOrders: number;
  trend: number[];
  risks: { label: string; cpk: number }[];
};

export function summarizeDepartment(rows: { orderId: string; label: string; spc: SpcResult }[]): DepartmentSpc {
  const ready = rows.filter((row) => row.spc.ready && row.spc.cp !== null && row.spc.cpk !== null && row.spc.gauge.score !== null);
  const byOrder = new Map<string, { label: string; critical: boolean; gauge: number; cpk: number }>();
  for (const row of ready) {
    const current = byOrder.get(row.orderId) ?? { label: row.label, critical: false, gauge: row.spc.gauge.score ?? 0, cpk: row.spc.cpk ?? 0 };
    current.critical = current.critical || row.spc.gauge.state === "CRITICAL" || (row.spc.cpk ?? 0) < 1;
    current.gauge = Math.min(current.gauge, row.spc.gauge.score ?? current.gauge);
    current.cpk = Math.min(current.cpk, row.spc.cpk ?? current.cpk);
    current.label = row.label;
    byOrder.set(row.orderId, current);
  }
  const orders = [...byOrder.values()];
  const meanOf = (pick: (row: (typeof ready)[number]) => number) => ready.length === 0 ? null : ready.reduce((sum, row) => sum + pick(row), 0) / ready.length;
  return {
    gauge: orders.length === 0 ? null : orders.reduce((sum, order) => sum + order.gauge, 0) / orders.length,
    averageCp: meanOf((row) => row.spc.cp ?? 0),
    averageCpk: meanOf((row) => row.spc.cpk ?? 0),
    criticalOrders: orders.filter((order) => order.critical).length,
    trend: orders.map((order) => order.gauge),
    risks: ready
      .map((row) => ({ label: row.label, cpk: row.spc.cpk ?? 0 }))
      .sort((left, right) => left.cpk - right.cpk)
      .slice(0, 3),
  };
}

function emptyResult(sampleSize: number, context: ActionContext): SpcResult {
  return {
    ready: false,
    sampleSize,
    mean: null,
    sigma: null,
    variance: null,
    range: null,
    cp: null,
    cpk: null,
    trend: null,
    slope: null,
    ucl: null,
    lcl: null,
    mrUcl: null,
    imr: [],
    gauge: { score: null, state: "INSUFFICIENT", diagnosis: null },
    prediction: { kind: "STABLE", headline: "spc.insufficient" },
    recommendation: null,
    risk: null,
    context,
  };
}

function predict(input: SpcInput, mean: number, sigma: number, slope: number, interval: number, context: ActionContext): Prediction {
  const last = input.measurements.filter((value) => Number.isFinite(value)).at(-1);
  const piecesToLimit = piecesUntilLimit(mean, sigma, slope, input.toleranceMin, input.toleranceMax, interval, last);
  const life = input.toolRemainingLife ?? 100;
  const piecesToTool = piecesUntilTool(life, input.producedQuantity ?? 0);
  const toleranceFirst = piecesToLimit !== null && (piecesToTool === null || piecesToLimit <= piecesToTool);
  if (toleranceFirst && piecesToLimit !== null && piecesToLimit <= 80) {
    return { kind: "OUT_OF_TOLERANCE", headline: "operations.prediction.tolerance", pieces: piecesToLimit };
  }
  if (life < 40 && piecesToTool !== null && (piecesToLimit === null || piecesToTool < piecesToLimit)) {
    return { kind: "TOOL_REPLACEMENT", headline: "operations.prediction.tool", pieces: piecesToTool };
  }
  if (context.scrapPressure) return { kind: "HIGH_SCRAP", headline: "operations.prediction.scrap" };
  if (context.variabilityIncreasing) return { kind: "UNSTABLE", headline: "operations.prediction.unstable" };
  return { kind: "STABLE", headline: "operations.prediction.stable", detail: "operations.prediction.none" };
}

function piecesUntilLimit(mean: number, sigma: number, slope: number, min: number, max: number, interval: number, last: number | undefined) {
  const fromEdge = horizon(slope > 0 ? mean + sigma : mean - sigma, slope, min, max, interval);
  const fromLast = horizon(last ?? mean, slope, min, max, interval);
  if (fromEdge === null) return fromLast;
  if (fromLast === null) return fromEdge;
  return Math.min(fromEdge, fromLast);
}

function horizon(point: number, slope: number, min: number, max: number, interval: number) {
  if (point > max || point < min) return 0;
  if (slope > 0) return Math.max(0, Math.ceil(((max - point) / slope) * interval));
  if (slope < 0) return Math.max(0, Math.ceil(((point - min) / Math.abs(slope)) * interval));
  return null;
}

function piecesUntilTool(life: number, produced: number) {
  if (life >= 40 || life <= 0 || produced <= 0) return life <= 0 ? 0 : null;
  const worn = Math.max(100 - life, 1);
  return Math.max(0, Math.round(life * (produced / worn)));
}

function actionContext(input: SpcInput, values: number[]): ActionContext {
  const window = values.slice(input.trendMarker ?? 0);
  const recent = values.slice(-10);
  const outside = recent.some((value) => value < input.toleranceMin || value > input.toleranceMax);
  const last = recent[recent.length - 1];
  const half = Math.max(input.toleranceMax - input.toleranceMin, 0.0001) / 2;
  return {
    slope: window.length >= 2 ? linearSlope(window) : 0,
    outside,
    nearTolerance: outside || (last !== undefined && Math.abs(last - input.target) >= half * 0.8),
    toolLife: input.toolRemainingLife ?? 100,
    variabilityIncreasing: variabilityIncreasing(values, input.trendMarker ?? 0),
    scrapPressure: (input.scrapCount ?? 0) >= 3,
    thermal: thermalRun(window) && (input.toolChangeEvents ?? 0) === 0,
  };
}

function capabilityScore(cp: number, cpk: number) {
  const mark = (value: number) => clamp((value / 1.67) * 100, 0, 100);
  return Math.round(0.3 * mark(cp) + 0.7 * mark(cpk));
}

function diagnose(flags: {
  outside: boolean;
  score: number;
  toolLife: number;
  drifting: boolean;
  increasing: boolean;
  slope: number;
  thermal: boolean;
}): ProcessDiagnosis {
  if (flags.outside || flags.score < 40) return "PROCESS_OUT_OF_CONTROL";
  if (flags.toolLife < 20 && flags.drifting && flags.increasing) return "TOOL_WEAR_SUSPECTED";
  if (flags.thermal) return "THERMAL_DRIFT_DETECTED";
  if (flags.increasing) return "INCREASING_VARIABILITY";
  if (flags.slope > 0 && flags.drifting) return "TREND_TOWARD_UPPER_LIMIT";
  if (flags.slope < 0 && flags.drifting) return "TREND_TOWARD_LOWER_LIMIT";
  return "PROCESS_STABLE";
}

function variabilityIncreasing(values: number[], marker: number) {
  const window = values.slice(marker);
  if (window.length < 6) return false;
  const mid = Math.floor(window.length / 2);
  const previous = standardDeviation(window.slice(0, mid));
  const latest = standardDeviation(window.slice(mid));
  return latest > previous * 1.5 && latest - previous > 0.002;
}

function positionScore(values: number[], target: number, min: number, max: number, half: number) {
  if (values.length === 0) return 100;
  const marks = values.map((value) => (value < min || value > max ? 0 : clamp(1 - Math.abs(value - target) / half, 0, 1) * 100));
  return marks.reduce((sum, mark) => sum + mark, 0) / marks.length;
}

function variabilityScore(deviation: number, half: number) {
  return clamp(1 - deviation / (half * 0.35), 0, 1) * 100;
}

function driftScore(slope: number, half: number, count: number) {
  const span = half / Math.max((count - 1) / 2, 1);
  return clamp(1 - Math.abs(slope) / span, 0, 1) * 100;
}

function toolScore(life: number) {
  if (life > 40) return 100;
  if (life >= 20) return 55 + ((life - 20) / 20) * 30;
  return clamp((life / 20) * 35, 0, 35);
}

function thermalRun(values: number[]) {
  if (values.length < 5) return false;
  const tail = values.slice(-5);
  const up = tail.every((value, index) => index === 0 || value > tail[index - 1]);
  const down = tail.every((value, index) => index === 0 || value < tail[index - 1]);
  return up || down;
}

function movingRanges(values: number[]) {
  const ranges: number[] = [];
  for (let index = 1; index < values.length; index += 1) ranges.push(Math.abs(values[index] - values[index - 1]));
  return ranges;
}

function linearSlope(values: number[]) {
  const count = values.length;
  const meanX = (count - 1) / 2;
  const meanY = average(values);
  let numerator = 0;
  let denominator = 0;
  values.forEach((value, index) => {
    numerator += (index - meanX) * (value - meanY);
    denominator += (index - meanX) ** 2;
  });
  return denominator === 0 ? 0 : numerator / denominator;
}

function standardDeviation(values: number[]) {
  if (values.length < 2) return 0;
  const mean = average(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1));
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
