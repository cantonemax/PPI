import { describe, expect, it } from "vitest";
import { evaluateSpc } from "@/lib/ppi-spc-engine";
import { PpiSpcEngine } from "@/lib/spc-engine";
import { SPCEngine } from "@/lib/spc/spc-engine";
import type { WesternElectricRule } from "@/lib/spc/types";

const datasets = {
  "SPC-001": {
    values: [20.01, 20.02, 20, 19.99, 20.01, 20.02, 20, 20.01, 19.99, 20],
    mean: 20.005,
    mrAverage: 0.014444,
    sigmaEstimate: 0.012805,
    ucl: 20.043422,
    lcl: 19.966578,
    mrUcl: 0.04719,
    rules: [] as WesternElectricRule[],
  },
  "SPC-002": {
    values: [20.03, 20.04, 20.05, 20.04, 20.03, 20.05, 20.04, 20.03, 20.04, 20.05],
    mean: 20.04,
    mrAverage: 0.011111,
    sigmaEstimate: 0.00985,
    ucl: 20.069556,
    lcl: 20.010444,
    mrUcl: 0.0363,
    rules: [] as WesternElectricRule[],
  },
  "SPC-003": {
    values: [19.9, 20.08, 19.94, 20.06, 19.92, 20.07, 19.95, 20.05, 19.91, 20.09],
    mean: 19.997,
    mrAverage: 0.141111,
    sigmaEstimate: 0.125099,
    ucl: 20.372356,
    lcl: 19.621644,
    mrUcl: 0.46101,
    rules: [] as WesternElectricRule[],
  },
  "SPC-004": {
    values: [20, 20.002, 20.004, 20.006, 20.008, 20.01, 20.012, 20.014, 20.016, 20.018],
    mean: 20.009,
    mrAverage: 0.002,
    sigmaEstimate: 0.001773,
    ucl: 20.01432,
    lcl: 20.00368,
    mrUcl: 0.006534,
    rules: ["RULE_1", "RULE_2", "RULE_3"] as WesternElectricRule[],
  },
  "SPC-005": {
    values: [20, 20.001, 20.002, 20.001, 20, 20.001, 20.002, 20.001, 20, 20.08],
    mean: 20.0088,
    mrAverage: 0.009778,
    sigmaEstimate: 0.008668,
    ucl: 20.034809,
    lcl: 19.982791,
    mrUcl: 0.031944,
    rules: ["RULE_1", "RULE_4"] as WesternElectricRule[],
  },
} as const;

function rulesOf(values: number[]) {
  return [...new Set(SPCEngine.evaluateWesternElectric(values).map((alert) => alert.rule))].sort();
}

describe("SPCEngine baseline", () => {
  it.each(Object.entries(datasets))("%s matches the frozen chart baseline", (_name, dataset) => {
    const values = [...dataset.values];
    const individuals = SPCEngine.individualsChart(values);
    const moving = SPCEngine.movingRange(values);
    expect(individuals.mean).toBeCloseTo(dataset.mean, 6);
    expect(individuals.cl).toBeCloseTo(dataset.mean, 6);
    expect(individuals.mrAverage).toBeCloseTo(dataset.mrAverage, 6);
    expect(moving.mrAverage).toBeCloseTo(dataset.mrAverage, 6);
    expect(moving.cl).toBeCloseTo(dataset.mrAverage, 6);
    expect(individuals.sigmaEstimate).toBeCloseTo(dataset.sigmaEstimate, 6);
    expect(individuals.ucl).toBeCloseTo(dataset.ucl, 6);
    expect(individuals.lcl).toBeCloseTo(dataset.lcl, 6);
    expect(moving.ucl).toBeCloseTo(dataset.mrUcl, 6);
    expect(moving.lcl).toBe(0);
    expect(moving.points).toHaveLength(values.length - 1);
    expect(rulesOf(values)).toEqual([...dataset.rules]);
  });

  it("divides the moving range by n-1", () => {
    const moving = SPCEngine.movingRange([1, 2, 4]);
    expect(moving.points).toEqual([1, 2]);
    expect(moving.mrAverage).toBeCloseTo(1.5, 6);
    expect(moving.mrAverage).not.toBeCloseTo(1, 6);
  });
});

describe("production limits stay on their current formulas", () => {
  it("keeps the page chart on 3/1.128 and the saved chart on sample sigma", () => {
    const values = [...datasets["SPC-001"].values];
    const official = SPCEngine.individualsChart(values);
    const page = evaluateSpc({ measurements: values, toleranceMin: 19.95, toleranceMax: 20.05, target: 20 });
    const saved = new PpiSpcEngine().evaluate({ measurements: values, tolerances: { lsl: 19.95, usl: 20.05 } });
    const mrBar = official.mrAverage;
    expect(page.ucl).toBeCloseTo((page.mean ?? 0) + 3 * (mrBar / 1.128), 6);
    expect(page.mrUcl).toBeCloseTo(3.267 * mrBar, 6);
    expect(saved.ucl).toBeCloseTo((saved.mean ?? 0) + 3 * (saved.sigma ?? 0), 6);
    expect(Math.abs((page.ucl ?? 0) - official.ucl)).toBeGreaterThan(0.000001);
  });
});
