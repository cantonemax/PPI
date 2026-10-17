export type StatisticsResult = {
  count: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  range: number;
  variance: number;
  standardDeviation: number;
  coefficientOfVariation: number | null;
};

export type CapabilityResult = {
  mean: number;
  sigma: number;
  cp: number;
  cpu: number;
  cpl: number;
  cpk: number;
  lsl: number;
  usl: number;
};

export const StatisticsEngine = {
  mean(values: number[]): number {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  },

  median(values: number[]): number {
    const sorted = [...values].sort((left, right) => left - right);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  },

  variance(values: number[]): number {
    const mean = StatisticsEngine.mean(values);
    return values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  },

  standardDeviation(values: number[]): number {
    return Math.sqrt(StatisticsEngine.variance(values));
  },

  coefficientOfVariation(values: number[]): number | null {
    const mean = StatisticsEngine.mean(values);
    if (mean === 0) return null;
    return (StatisticsEngine.standardDeviation(values) / mean) * 100;
  },

  cp(sigma: number, lsl: number, usl: number): number | null {
    if (!(sigma > 0)) return null;
    return (usl - lsl) / (6 * sigma);
  },

  cpu(mean: number, sigma: number, usl: number): number | null {
    if (!(sigma > 0)) return null;
    return (usl - mean) / (3 * sigma);
  },

  cpl(mean: number, sigma: number, lsl: number): number | null {
    if (!(sigma > 0)) return null;
    return (mean - lsl) / (3 * sigma);
  },

  cpk(mean: number, sigma: number, lsl: number, usl: number): number | null {
    const cpu = StatisticsEngine.cpu(mean, sigma, usl);
    const cpl = StatisticsEngine.cpl(mean, sigma, lsl);
    if (cpu === null || cpl === null) return null;
    return Math.min(cpu, cpl);
  },

  qualityScore(cpk: number): number {
    return Math.round(Math.min(100, Math.max(0, (cpk / 1.67) * 100)));
  },

  confidence(sampleSize: number): "low" | "medium" | "good" | "high" {
    if (sampleSize >= 30) return "high";
    if (sampleSize >= 20) return "good";
    if (sampleSize >= 10) return "medium";
    return "low";
  },

  capability(values: number[], lsl: number, usl: number): CapabilityResult | null {
    if (values.length < 2 || !Number.isFinite(lsl) || !Number.isFinite(usl) || !(usl > lsl)) return null;
    const mean = StatisticsEngine.mean(values);
    const sigma = StatisticsEngine.standardDeviation(values);
    const cp = StatisticsEngine.cp(sigma, lsl, usl);
    const cpu = StatisticsEngine.cpu(mean, sigma, usl);
    const cpl = StatisticsEngine.cpl(mean, sigma, lsl);
    const cpk = StatisticsEngine.cpk(mean, sigma, lsl, usl);
    if (cp === null || cpu === null || cpl === null || cpk === null) return null;
    return { mean, sigma, cp, cpu, cpl, cpk, lsl, usl };
  },

  statistics(values: number[]): StatisticsResult {
    const mean = StatisticsEngine.mean(values);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const standardDeviation = values.length < 2 ? 0 : StatisticsEngine.standardDeviation(values);
    const variance = values.length < 2 ? 0 : StatisticsEngine.variance(values);
    return {
      count: values.length,
      mean,
      median: StatisticsEngine.median(values),
      min,
      max,
      range: max - min,
      variance,
      standardDeviation,
      coefficientOfVariation: mean === 0 ? null : (standardDeviation / mean) * 100,
    };
  },
};
