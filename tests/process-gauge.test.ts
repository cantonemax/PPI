import { describe, expect, it } from "vitest";
import { evaluateProcessGauge, type GaugeInput } from "@/lib/process-gauge";

const band = { toleranceMin: 9.95, toleranceMax: 10.05, target: 10, producedQuantity: 37260, scrapCount: 0, machineRuntime: 120, toolChangeEvents: 0 };

function gauge(patch: Partial<GaugeInput>) {
  return evaluateProcessGauge({ measurements: [], toolRemainingLife: 80, ...band, ...patch });
}

describe("process gauge engine", () => {
  it("scores a stable process above 85", () => {
    const result = gauge({ measurements: [10, 10.001, 9.999, 10.002, 9.998, 10, 10.001, 9.999, 10, 10.001] });
    expect(result.score).toBeGreaterThan(85);
    expect(result.state).toBe("STABLE");
    expect(result.diagnosis).toBe("PROCESS_STABLE");
  });

  it("suspects tool wear when life is low, drift exists, and variability rises", () => {
    const result = gauge({
      toolRemainingLife: 12,
      measurements: [9.99, 9.991, 9.992, 9.993, 10.0, 10.01, 9.98, 10.03, 9.97, 10.04],
    });
    expect(result.diagnosis).toBe("TOOL_WEAR_SUSPECTED");
  });

  it("detects thermal drift across five rising samples without a tool change", () => {
    const result = gauge({
      toolRemainingLife: 70,
      machineRuntime: 480,
      measurements: [9.99, 9.994, 9.998, 10.002, 10.006, 10.01, 10.014, 10.018, 10.022, 10.026],
    });
    expect(result.diagnosis).toBe("THERMAL_DRIFT_DETECTED");
  });

  it("detects increasing variability", () => {
    const result = gauge({
      toolRemainingLife: 75,
      measurements: [10, 10.001, 9.999, 10, 10.001, 9.97, 10.03, 9.96, 10.04, 9.955],
    });
    expect(result.diagnosis).toBe("INCREASING_VARIABILITY");
  });

  it("marks the process out of control when a measurement leaves the band", () => {
    const result = gauge({ measurements: [10, 10.001, 9.999, 10, 10.001, 10, 10.002, 9.998, 10, 10.08] });
    expect(result.diagnosis).toBe("PROCESS_OUT_OF_CONTROL");
    expect(result.state).toBe("CRITICAL");
  });

  it("returns to stable after a tool replacement clears the trend marker", () => {
    const worn = gauge({
      toolRemainingLife: 12,
      measurements: [9.99, 9.991, 9.992, 9.993, 10.0, 10.01, 9.98, 10.03, 9.97, 10.04],
    });
    expect(worn.diagnosis).toBe("TOOL_WEAR_SUSPECTED");
    const replaced = gauge({
      toolRemainingLife: 100,
      toolChangeEvents: 1,
      trendMarker: 10,
      measurements: [9.99, 9.991, 9.992, 9.993, 10.0, 10.01, 9.98, 10.03, 9.97, 10.04],
    });
    expect(replaced.diagnosis).toBe("PROCESS_STABLE");
  });
});
