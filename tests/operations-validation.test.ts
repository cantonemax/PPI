import { describe, expect, it } from "vitest";
import { evaluateProcessGauge, type GaugeInput } from "@/lib/process-gauge";
import { readOutlook } from "@/lib/prediction";
import { recommendAction } from "@/lib/recommended-action";

const band = {
  toleranceMin: 9.95,
  toleranceMax: 10.05,
  target: 10,
  producedQuantity: 37260,
  scrapCount: 0,
  machineRuntime: 120,
  toolChangeEvents: 0,
  trendMarker: 0,
  checkInterval: 20,
};

function run(patch: Partial<GaugeInput> & { checkInterval?: number }) {
  const input = { measurements: [], toolRemainingLife: 80, ...band, ...patch };
  const gauge = evaluateProcessGauge(input);
  const outlook = readOutlook(input);
  const action = recommendAction(gauge.diagnosis, gauge.score, outlook.context);
  return { gauge, outlook, action };
}

describe("operations v1.3 validation", () => {
  it("scenario 1 stable process", () => {
    const { gauge, outlook, action } = run({
      measurements: [10, 10.001, 9.999, 10.002, 10, 10.001, 9.999, 10, 10.001, 10],
    });
    expect(gauge.state).toBe("STABLE");
    expect(gauge.score).toBeGreaterThan(85);
    expect(gauge.diagnosis).toBe("PROCESS_STABLE");
    expect(action.action).toBe("operations.action.continue");
    expect(outlook.prediction.kind).toBe("STABLE");
    expect(outlook.prediction.detail).toBe("operations.prediction.none");
  });

  it("scenario 2 trend toward upper limit", () => {
    const { gauge, outlook, action } = run({
      measurements: [10, 10.004, 10.008, 10.012, 10.016, 10.02, 10.024, 10.028, 10.032, 10.036],
    });
    expect(gauge.state).toBe("ATTENTION");
    expect(gauge.diagnosis).toBe("TREND_TOWARD_UPPER_LIMIT");
    expect(action.action).toBe("operations.action.extra");
    expect(outlook.prediction.kind).toBe("OUT_OF_TOLERANCE");
  });

  it("scenario 3 tool wear then replacement", () => {
    const worn = run({
      toolRemainingLife: 12,
      measurements: [10, 10.003, 10.006, 10.009, 10.012, 10.016, 10.02, 10.025, 10.03, 10.036],
    });
    expect(["ATTENTION", "CRITICAL"]).toContain(worn.gauge.state);
    expect(worn.gauge.diagnosis).toBe("TOOL_WEAR_SUSPECTED");
    expect(worn.action.action).toBe("operations.action.replace");

    const replaced = run({
      toolRemainingLife: 100,
      toolChangeEvents: 1,
      trendMarker: 10,
      measurements: [10, 10.003, 10.006, 10.009, 10.012, 10.016, 10.02, 10.025, 10.03, 10.036],
    });
    expect(replaced.gauge.diagnosis).not.toBe("TOOL_WEAR_SUSPECTED");
  });

  it("scenario 4 thermal drift", () => {
    const { gauge, action } = run({
      machineRuntime: 480,
      toolChangeEvents: 0,
      measurements: [10, 10.002, 10.004, 10.006, 10.008, 10.01, 10.012, 10.014, 10.016, 10.018],
    });
    expect(gauge.diagnosis).toBe("THERMAL_DRIFT_DETECTED");
    expect(action.action).toBe("operations.action.temperature");
  });

  it("scenario 5 process out of control", () => {
    const { gauge, outlook, action } = run({
      measurements: [10.04, 10.045, 10.05, 10.055, 10.06, 10.065, 10.07, 10.075, 10.08, 10.085],
    });
    expect(gauge.state).toBe("CRITICAL");
    expect(gauge.diagnosis).toBe("PROCESS_OUT_OF_CONTROL");
    expect(action.action).toBe("operations.action.stop");
    expect(outlook.prediction.kind).toBe("OUT_OF_TOLERANCE");
    expect(outlook.prediction.pieces).toBeGreaterThanOrEqual(0);
  });

  it("measurement, scrap, and stop change the live reading", () => {
    const before = run({ measurements: [10, 10.001, 9.999, 10.002, 10, 10.001, 9.999, 10, 10.001, 10] });
    const saved = run({ measurements: [10.001, 9.999, 10.002, 10, 10.001, 9.999, 10, 10.001, 10, 10.08] });
    expect(saved.gauge.score).not.toBe(before.gauge.score);
    expect(saved.action.action).not.toBe(before.action.action);
    expect(saved.outlook.prediction.kind).not.toBe(before.outlook.prediction.kind);

    const scrapped = run({
      measurements: [10, 10.001, 9.999, 10.002, 10, 10.001, 9.999, 10, 10.001, 10],
      scrapCount: 3,
    });
    expect(scrapped.gauge.score).toBeLessThan(before.gauge.score);

    const stopped = run({
      measurements: [10, 10.001, 9.999, 10.002, 10, 10.001, 9.999, 10, 10.001, 10],
      machineRuntime: before.gauge ? 135 : 135,
    });
    expect(stopped.gauge.score).toBe(before.gauge.score);
  });
});
