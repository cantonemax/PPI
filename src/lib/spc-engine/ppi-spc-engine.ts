export const SPC_MIN_SAMPLE = 5;

export type TrendDirection = "up" | "down" | "stable";
export type ProcessState = "stable" | "warning" | "critical";

export type SpcTolerances = {
  lsl: number;
  usl: number;
};

export type SpcInput = {
  measurements: number[];
  tolerances: SpcTolerances;
  orderId?: string;
  feature?: string;
  machineId?: string;
  toolId?: string;
};

export type SpcResult = {
  insufficientData: boolean;
  sampleSize: number;
  mean: number | null;
  median: number | null;
  variance: number | null;
  sigma: number | null;
  min: number | null;
  max: number | null;
  range: number | null;
  coefficientOfVariation: number | null;
  cp: number | null;
  cpk: number | null;
  ucl: number | null;
  lcl: number | null;
  trendSlope: number | null;
  trendDirection: TrendDirection | null;
  processState: ProcessState | null;
};

const emptyStats = {
  mean: null,
  median: null,
  variance: null,
  sigma: null,
  min: null,
  max: null,
  range: null,
  coefficientOfVariation: null,
  cp: null,
  cpk: null,
  ucl: null,
  lcl: null,
  trendSlope: null,
  trendDirection: null,
  processState: null,
} as const;

export class PpiSpcEngine {
  evaluate(input: SpcInput): SpcResult {
    const values = input.measurements.filter((value) => Number.isFinite(value));
    const sampleSize = values.length;
    if (sampleSize < SPC_MIN_SAMPLE) {
      return { insufficientData: true, sampleSize, ...emptyStats };
    }
    const mean = values.reduce((sum, value) => sum + value, 0) / sampleSize;
    const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (sampleSize - 1);
    const sigma = Math.sqrt(variance);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const sorted = [...values].sort((left, right) => left - right);
    const mid = Math.floor(sampleSize / 2);
    const median = sampleSize % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    const coefficientOfVariation = mean === 0 ? null : (sigma / mean) * 100;
    const capable = sigma > 0 && Number.isFinite(input.tolerances.lsl) && Number.isFinite(input.tolerances.usl);
    const cp = capable ? (input.tolerances.usl - input.tolerances.lsl) / (6 * sigma) : null;
    const cpk = capable
      ? Math.min((input.tolerances.usl - mean) / (3 * sigma), (mean - input.tolerances.lsl) / (3 * sigma))
      : null;
    const ucl = mean + 3 * sigma;
    const lcl = mean - 3 * sigma;
    const trendSlope = linearSlope(values);
    const strongTrend = sigma > 0 && Math.abs(trendSlope) * (sampleSize - 1) > sigma;
    const trendDirection: TrendDirection = !strongTrend ? "stable" : trendSlope > 0 ? "up" : "down";
    const outside = values.some((value) => value > ucl || value < lcl);
    const last = values[sampleSize - 1];
    const approaching = !outside && sigma > 0 && (last >= ucl - sigma || last <= lcl + sigma);
    const processState: ProcessState = outside ? "critical" : strongTrend || approaching ? "warning" : "stable";
    return {
      insufficientData: false,
      sampleSize,
      mean,
      median,
      variance,
      sigma,
      min,
      max,
      range: max - min,
      coefficientOfVariation,
      cp,
      cpk,
      ucl,
      lcl,
      trendSlope,
      trendDirection,
      processState,
    };
  }

  evaluateFeatures(features: SpcInput[]): SpcResult[] {
    return features.map((feature) => this.evaluate(feature));
  }
}

function linearSlope(values: number[]) {
  const count = values.length;
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
