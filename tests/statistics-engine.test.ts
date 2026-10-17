import { describe, expect, it } from "vitest";
import { evaluateSpc } from "@/lib/ppi-spc-engine";
import { PpiSpcEngine } from "@/lib/spc-engine";
import { StatisticsEngine } from "@/lib/statistics/statistics-engine";

const lsl = 19.95;
const usl = 20.05;

const datasets = {
  "SPC-001": {
    values: [20.01, 20.02, 20, 19.99, 20.01, 20.02, 20, 20.01, 19.99, 20],
    mean: 20.005,
    variance: 0.000117,
    standardDeviation: 0.010801,
    cp: 1.543033,
    cpu: 1.38873,
    cpl: 1.697337,
    cpk: 1.38873,
  },
  "SPC-002": {
    values: [20.03, 20.04, 20.05, 20.04, 20.03, 20.05, 20.04, 20.03, 20.04, 20.05],
    mean: 20.04,
    variance: 0.000067,
    standardDeviation: 0.008165,
    cp: 2.041241,
    cpu: 0.408248,
    cpl: 3.674235,
    cpk: 0.408248,
  },
  "SPC-003": {
    values: [19.9, 20.08, 19.94, 20.06, 19.92, 20.07, 19.95, 20.05, 19.91, 20.09],
    mean: 19.997,
    variance: 0.006223,
    standardDeviation: 0.078888,
    cp: 0.21127,
    cpu: 0.223946,
    cpl: 0.198594,
    cpk: 0.198594,
  },
  "SPC-004": {
    values: [20, 20.002, 20.004, 20.006, 20.008, 20.01, 20.012, 20.014, 20.016, 20.018],
    mean: 20.009,
    variance: 0.000037,
    standardDeviation: 0.006055,
    cp: 2.752409,
    cpu: 2.256976,
    cpl: 3.247843,
    cpk: 2.256976,
  },
  "SPC-005": {
    values: [20, 20.001, 20.002, 20.001, 20, 20.001, 20.002, 20.001, 20, 20.08],
    mean: 20.0088,
    variance: 0.000626,
    standardDeviation: 0.025028,
    cp: 0.665921,
    cpu: 0.548719,
    cpl: 0.783123,
    cpk: 0.548719,
  },
} as const;

function legacy(values: number[]) {
  const count = values.length;
  const mean = values.reduce((sum, value) => sum + value, 0) / count;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (count - 1);
  const standardDeviation = Math.sqrt(variance);
  const cp = (usl - lsl) / (6 * standardDeviation);
  const cpu = (usl - mean) / (3 * standardDeviation);
  const cpl = (mean - lsl) / (3 * standardDeviation);
  return { mean, variance, standardDeviation, cp, cpu, cpl, cpk: Math.min(cpu, cpl) };
}

describe("StatisticsEngine baseline", () => {
  it.each(Object.entries(datasets))("%s matches the frozen baseline", (_name, dataset) => {
    const stats = StatisticsEngine.statistics([...dataset.values]);
    const capability = StatisticsEngine.capability([...dataset.values], lsl, usl);
    expect(stats.count).toBe(10);
    expect(stats.mean).toBeCloseTo(dataset.mean, 6);
    expect(stats.variance).toBeCloseTo(dataset.variance, 6);
    expect(stats.standardDeviation).toBeCloseTo(dataset.standardDeviation, 6);
    expect(capability).not.toBeNull();
    expect(capability?.cp).toBeCloseTo(dataset.cp, 6);
    expect(capability?.cpu).toBeCloseTo(dataset.cpu, 6);
    expect(capability?.cpl).toBeCloseTo(dataset.cpl, 6);
    expect(capability?.cpk).toBeCloseTo(dataset.cpk, 6);
  });
});

describe("StatisticsEngine regression", () => {
  it.each(Object.entries(datasets))("%s stays within 0.000001 of the previous formulas", (_name, dataset) => {
    const values = [...dataset.values];
    const previous = legacy(values);
    const stats = StatisticsEngine.statistics(values);
    const capability = StatisticsEngine.capability(values, lsl, usl);
    expect(capability).not.toBeNull();
    for (const key of ["mean", "variance", "standardDeviation"] as const) {
      expect(Math.abs(stats[key] - previous[key])).toBeLessThanOrEqual(0.000001);
    }
    for (const key of ["cp", "cpu", "cpl", "cpk"] as const) {
      expect(Math.abs((capability?.[key] ?? Number.NaN) - previous[key])).toBeLessThanOrEqual(0.000001);
    }
  });

  it("keeps saved limits on sample sigma and page limits on the moving range", () => {
    const values = [...datasets["SPC-001"].values];
    const saved = new PpiSpcEngine().evaluate({ measurements: values, tolerances: { lsl, usl } });
    const page = evaluateSpc({ measurements: values, toleranceMin: lsl, toleranceMax: usl, target: (lsl + usl) / 2 });
    const capability = StatisticsEngine.capability(values, lsl, usl);
    expect(capability).not.toBeNull();
    expect(Math.abs((saved.cp ?? Number.NaN) - (capability?.cp ?? Number.NaN))).toBeLessThanOrEqual(0.000001);
    expect(Math.abs((page.cp ?? Number.NaN) - (capability?.cp ?? Number.NaN))).toBeLessThanOrEqual(0.000001);
    expect(saved.ucl).toBeCloseTo((saved.mean ?? 0) + 3 * (saved.sigma ?? 0), 6);
    expect(saved.lcl).toBeCloseTo((saved.mean ?? 0) - 3 * (saved.sigma ?? 0), 6);
    const ranges: number[] = [];
    for (let index = 1; index < values.length; index += 1) ranges.push(Math.abs(values[index] - values[index - 1]));
    const mrBar = ranges.reduce((sum, value) => sum + value, 0) / ranges.length;
    expect(page.ucl).toBeCloseTo((page.mean ?? 0) + 3 * (mrBar / 1.128), 6);
    expect(page.lcl).toBeCloseTo((page.mean ?? 0) - 3 * (mrBar / 1.128), 6);
    expect(page.mrUcl).toBeCloseTo(3.267 * mrBar, 6);
  });
});
