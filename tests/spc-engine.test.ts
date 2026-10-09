import { describe, expect, it } from "vitest";
import { PpiSpcEngine } from "@/lib/spc-engine";

const engine = new PpiSpcEngine();
const band = { lsl: 9.9, usl: 10.1 };

describe("PpiSpcEngine", () => {
  it("returns no statistics before five valid measurements", () => {
    const result = engine.evaluate({ measurements: [10, 10, Number.NaN, 10.1], tolerances: band, feature: "A" });
    expect(result.insufficientData).toBe(true);
    expect(result.sampleSize).toBe(3);
    expect(result.mean).toBeNull();
    expect(result.cp).toBeNull();
    expect(result.cpk).toBeNull();
    expect(result.ucl).toBeNull();
    expect(result.lcl).toBeNull();
    expect(result.trendSlope).toBeNull();
    expect(result.processState).toBeNull();
  });

  it("calculates sample statistics, capability, and control limits from one sample", () => {
    const measurements = [10, 10.02, 9.98, 10.01, 9.99];
    const result = engine.evaluate({
      measurements,
      tolerances: band,
      orderId: "order-1",
      feature: "B",
      machineId: "machine-1",
      toolId: "tool-1",
    });
    const mean = 10;
    const variance = measurements.reduce((sum, value) => sum + (value - mean) ** 2, 0) / 4;
    const sigma = Math.sqrt(variance);
    expect(result.insufficientData).toBe(false);
    expect(result.sampleSize).toBe(5);
    expect(result.mean).toBeCloseTo(mean);
    expect(result.median).toBeCloseTo(10);
    expect(result.variance).toBeCloseTo(variance);
    expect(result.sigma).toBeCloseTo(sigma);
    expect(result.min).toBe(9.98);
    expect(result.max).toBe(10.02);
    expect(result.range).toBeCloseTo(0.04);
    expect(result.coefficientOfVariation).toBeCloseTo((sigma / mean) * 100);
    expect(result.cp).toBeCloseTo((band.usl - band.lsl) / (6 * sigma));
    expect(result.cpk).toBeCloseTo(Math.min((band.usl - mean) / (3 * sigma), (mean - band.lsl) / (3 * sigma)));
    expect(result.ucl).toBeCloseTo(mean + 3 * sigma);
    expect(result.lcl).toBeCloseTo(mean - 3 * sigma);
    expect(result.ucl).not.toBe(band.usl);
    expect(result.lcl).not.toBe(band.lsl);
    expect(result.processState).toBe("stable");
    expect(result.trendDirection).toBe("stable");
  });

  it("marks a rising sample as a warning", () => {
    const result = engine.evaluate({
      measurements: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      tolerances: { lsl: -20, usl: 20 },
      feature: "C",
    });
    expect(result.trendDirection).toBe("up");
    expect(result.trendSlope).toBeGreaterThan(0);
    expect(result.processState).toBe("warning");
  });

  it("marks a point outside the control limits as critical", () => {
    const result = engine.evaluate({
      measurements: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 10],
      tolerances: { lsl: -5, usl: 15 },
      feature: "D",
    });
    expect(result.processState).toBe("critical");
    expect(result.max).toBeGreaterThan(result.ucl ?? 0);
  });

  it("does not invent capability when sigma is zero", () => {
    const result = engine.evaluate({ measurements: [10, 10, 10, 10, 10], tolerances: band, feature: "E" });
    expect(result.insufficientData).toBe(false);
    expect(result.sigma).toBe(0);
    expect(result.cp).toBeNull();
    expect(result.cpk).toBeNull();
    expect(result.coefficientOfVariation).toBe(0);
    expect(result.ucl).toBe(10);
    expect(result.lcl).toBe(10);
    expect(result.processState).toBe("stable");
  });

  it("evaluates each feature from the same engine", () => {
    const results = engine.evaluateFeatures(["A", "B", "C", "D", "E"].map((feature) => ({
      measurements: [10, 10.01, 9.99, 10, 10.02],
      tolerances: band,
      feature,
    })));
    expect(results).toHaveLength(5);
    expect(new Set(results.map((result) => result.cp?.toFixed(6))).size).toBe(1);
    expect(results.every((result) => result.insufficientData === false)).toBe(true);
  });
});
