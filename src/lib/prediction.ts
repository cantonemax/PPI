import type { GaugeInput } from "@/lib/process-gauge";

export type PredictionKind =
  | "STABLE"
  | "OUT_OF_TOLERANCE"
  | "TOOL_REPLACEMENT"
  | "HIGH_SCRAP"
  | "UNSTABLE";

export type Prediction = {
  kind: PredictionKind;
  headline: string;
  detail?: string;
  pieces?: number;
};

export type ActionContext = {
  slope: number;
  outside: boolean;
  nearTolerance: boolean;
  toolLife: number;
  variabilityIncreasing: boolean;
  scrapPressure: boolean;
  thermal: boolean;
};

export type Outlook = {
  prediction: Prediction;
  context: ActionContext;
};

export type PredictionInput = GaugeInput & { checkInterval: number };

export function readOutlook(input: PredictionInput): Outlook {
  const band = Math.max(input.toleranceMax - input.toleranceMin, 0.0001);
  const half = band / 2;
  const recent = input.measurements.slice(-10);
  const trend = input.measurements.slice(input.trendMarker ?? 0);
  const slope = trend.length >= 2 ? linearSlope(trend) : 0;
  const last = recent[recent.length - 1];
  const outside = recent.some((value) => value < input.toleranceMin || value > input.toleranceMax);
  const piecesToLimit = piecesUntilLimit(last, slope, input.toleranceMin, input.toleranceMax, input.checkInterval);
  const piecesToTool = piecesUntilTool(input.toolRemainingLife, input.producedQuantity);
  const increasing = variabilityIncreasing(input.measurements, input.trendMarker ?? 0);
  const nearTolerance = outside || (piecesToLimit !== null && piecesToLimit <= input.checkInterval * 2) || nearEdge(last, input.target, half);
  const scrapPressure = input.scrapCount >= 3;
  const thermal = thermalRun(trend) && input.toolChangeEvents === 0;
  const context: ActionContext = {
    slope,
    outside,
    nearTolerance,
    toolLife: input.toolRemainingLife,
    variabilityIncreasing: increasing,
    scrapPressure,
    thermal,
  };
  return {
    prediction: choosePrediction({
      piecesToLimit,
      piecesToTool,
      toolLife: input.toolRemainingLife,
      scrapPressure,
      increasing,
      slope,
    }),
    context,
  };
}

function choosePrediction(flags: {
  piecesToLimit: number | null;
  piecesToTool: number | null;
  toolLife: number;
  scrapPressure: boolean;
  increasing: boolean;
  slope: number;
}): Prediction {
  const toleranceFirst = flags.piecesToLimit !== null && (flags.piecesToTool === null || flags.piecesToLimit <= flags.piecesToTool);
  if (toleranceFirst && flags.piecesToLimit !== null && flags.piecesToLimit <= 80) {
    return { kind: "OUT_OF_TOLERANCE", headline: "operations.prediction.tolerance", pieces: flags.piecesToLimit };
  }
  if (flags.toolLife < 40 && flags.piecesToTool !== null && (flags.piecesToLimit === null || flags.piecesToTool < flags.piecesToLimit)) {
    return { kind: "TOOL_REPLACEMENT", headline: "operations.prediction.tool", pieces: flags.piecesToTool };
  }
  if (flags.scrapPressure) return { kind: "HIGH_SCRAP", headline: "operations.prediction.scrap" };
  if (flags.increasing) return { kind: "UNSTABLE", headline: "operations.prediction.unstable" };
  return { kind: "STABLE", headline: "operations.prediction.stable", detail: "operations.prediction.none" };
}

function piecesUntilLimit(last: number | undefined, slope: number, min: number, max: number, interval: number) {
  if (last === undefined) return null;
  if (last > max || last < min) return 0;
  if (slope > 0) return Math.ceil(((max - last) / slope) * interval);
  if (slope < 0) return Math.ceil(((last - min) / Math.abs(slope)) * interval);
  return null;
}

function piecesUntilTool(life: number, produced: number) {
  if (life >= 40 || life <= 0 || produced <= 0) return life <= 0 ? 0 : null;
  const worn = Math.max(100 - life, 1);
  return Math.max(0, Math.round(life * (produced / worn)));
}

function nearEdge(last: number | undefined, target: number, half: number) {
  if (last === undefined) return false;
  return Math.abs(last - target) >= half * 0.8;
}

function variabilityIncreasing(values: number[], marker: number) {
  const window = values.slice(marker);
  if (window.length < 6) return false;
  const mid = Math.floor(window.length / 2);
  const previous = standardDeviation(window.slice(0, mid));
  const latest = standardDeviation(window.slice(mid));
  return latest > previous * 1.5 && latest - previous > 0.002;
}

function thermalRun(values: number[]) {
  if (values.length < 5) return false;
  const tail = values.slice(-5);
  const up = tail.every((value, index) => index === 0 || value > tail[index - 1]);
  const down = tail.every((value, index) => index === 0 || value < tail[index - 1]);
  return up || down;
}

function linearSlope(values: number[]) {
  const count = values.length;
  if (count < 2) return 0;
  const meanX = (count - 1) / 2;
  const meanY = values.reduce((sum, value) => sum + value, 0) / count;
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
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}
