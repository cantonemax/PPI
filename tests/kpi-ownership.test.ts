import { describe, expect, it } from "vitest";
import { productionProgressPercent } from "@/lib/economics";
import { SPCEngine } from "@/lib/spc/spc-engine";
import { StatisticsEngine } from "@/lib/statistics/statistics-engine";
import { qualityPercentFromCpk } from "@/lib/quality-evaluation";

describe("kpi ownership", () => {
  it("measures order progress against the target, not the yield", () => {
    expect(productionProgressPercent(80, 100)).toBe(80);
    expect(productionProgressPercent(0, 100)).toBe(0);
    expect(productionProgressPercent(80, 0)).toBeNull();
    const good = 80;
    const scrap = 20;
    const produced = good + scrap;
    expect(productionProgressPercent(good, 200)).not.toBe((good / produced) * 100);
  });

  it("uses one department score for the same machine gauges", () => {
    const machines = [80, 60, null];
    expect(SPCEngine.departmentScore(machines)).toBe(70);
    expect(SPCEngine.departmentScore(machines)).toBe(SPCEngine.departmentScore([80, 60]));
    expect(SPCEngine.departmentScore([null, undefined])).toBeNull();
  });

  it("flags only the latest measurement as out of tolerance", () => {
    const values = [30, 10];
    expect(SPCEngine.outOfTolerance(values.at(-1), 0, 20)).toBe(false);
    expect(values.slice(-10).some((value) => SPCEngine.outOfTolerance(value, 0, 20))).toBe(true);
    expect(SPCEngine.outOfTolerance(20, 0, 20)).toBe(false);
    expect(SPCEngine.outOfTolerance(20.1, 0, 20)).toBe(true);
    expect(SPCEngine.outOfTolerance(null, 0, 20)).toBe(false);
  });

  it("keeps the out-of-tolerance rate off the operator alarm", () => {
    const values = [30, 10, 11];
    const rate = SPCEngine.outOfToleranceRate(values, 0, 20);
    expect(rate).toBeCloseTo((1 / 3) * 100, 6);
    expect(SPCEngine.outOfTolerance(values.at(-1), 0, 20)).toBe(false);
    expect(SPCEngine.outOfToleranceRate([], 0, 20)).toBeNull();
  });

  it("reads the quality score from the statistics engine", () => {
    expect(StatisticsEngine.qualityScore(1.67)).toBe(100);
    expect(StatisticsEngine.qualityScore(0)).toBe(0);
    expect(StatisticsEngine.qualityScore(3)).toBe(100);
    expect(qualityPercentFromCpk(0.835)).toBe(StatisticsEngine.qualityScore(0.835));
  });
});
