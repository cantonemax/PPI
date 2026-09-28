export type ProcessState = "STABLE" | "ATTENTION" | "CRITICAL";

export type ProcessDiagnosis =
  | "PROCESS_STABLE"
  | "TREND_TOWARD_UPPER_LIMIT"
  | "TREND_TOWARD_LOWER_LIMIT"
  | "TOOL_WEAR_SUSPECTED"
  | "THERMAL_DRIFT_DETECTED"
  | "INCREASING_VARIABILITY"
  | "PROCESS_OUT_OF_CONTROL";

export type GaugeInput = {
  measurements: number[];
  toleranceMin: number;
  toleranceMax: number;
  target: number;
  producedQuantity: number;
  toolRemainingLife: number;
  scrapCount: number;
  machineRuntime: number;
  toolChangeEvents: number;
  trendMarker?: number;
};

export type GaugeResult = {
  score: number;
  state: ProcessState;
  diagnosis: ProcessDiagnosis;
  drift: string;
  variability: string;
};

export function evaluateProcessGauge(input: GaugeInput): GaugeResult {
  const band = Math.max(input.toleranceMax - input.toleranceMin, 0.0001);
  const half = band / 2;
  const recent = input.measurements.slice(-10);
  const trend = input.measurements.slice(input.trendMarker ?? 0);
  const outside = recent.some((value) => value < input.toleranceMin || value > input.toleranceMax);
  const position = positionScore(recent, input.target, input.toleranceMin, input.toleranceMax, half);
  const variability = variabilityScore(standardDeviation(recent), half);
  const slope = trend.length >= 2 ? linearSlope(trend) : 0;
  const drift = driftScore(slope, half, Math.max(trend.length, recent.length));
  const tool = toolScore(input.toolRemainingLife);
  const weighted = 0.4 * position + 0.25 * variability + 0.2 * drift + 0.15 * tool;
  const scrapPressure = Math.min(15, input.scrapCount);
  const score = clamp(Math.round(weighted - scrapPressure), 0, 100);
  const increasing = variabilityIncreasing(input.measurements, input.trendMarker ?? 0);
  const drifting = Math.abs(slope) > half / 40;
  const diagnosis = diagnose({
    outside,
    score,
    toolLife: input.toolRemainingLife,
    drifting,
    increasing,
    slope,
    thermal: thermalRun(trend) && input.toolChangeEvents === 0 && input.machineRuntime >= 240,
  });
  const driftText = `${slope >= 0 ? "+" : ""}${slope.toFixed(3)} mm`;
  const variabilityText = `${standardDeviation(recent).toFixed(3)} mm`;
  return { score, state: outside ? "CRITICAL" : stateOf(score), diagnosis, drift: driftText, variability: variabilityText };
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

function stateOf(score: number): ProcessState {
  if (score >= 80) return "STABLE";
  if (score >= 60) return "ATTENTION";
  return "CRITICAL";
}

function positionScore(values: number[], target: number, min: number, max: number, half: number) {
  if (values.length === 0) return 100;
  const marks = values.map((value) => {
    if (value < min || value > max) return 0;
    return clamp(1 - Math.abs(value - target) / half, 0, 1) * 100;
  });
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
