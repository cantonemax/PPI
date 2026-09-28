import { describe, expect, it } from "vitest";
import { readOutlook, type PredictionInput } from "@/lib/prediction";

const base: PredictionInput = {
  measurements: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
  toleranceMin: 9.95,
  toleranceMax: 10.05,
  target: 10,
  producedQuantity: 37260,
  toolRemainingLife: 90,
  scrapCount: 0,
  machineRuntime: 120,
  toolChangeEvents: 0,
  trendMarker: 0,
  checkInterval: 20,
};

describe("prediction", () => {
  it("reports no risk when the process is flat and the tool is healthy", () => {
    const outlook = readOutlook(base);
    expect(outlook.prediction.kind).toBe("STABLE");
    expect(outlook.prediction.headline).toBe("operations.prediction.stable");
    expect(outlook.prediction.detail).toBe("operations.prediction.none");
  });

  it("expects the next pieces to leave tolerance when the series climbs", () => {
    const outlook = readOutlook({
      ...base,
      measurements: [9.972, 9.981, 9.99, 9.998, 10.006, 10.012, 10.018, 10.027, 10.034, 10.041],
      toolRemainingLife: 12,
    });
    expect(outlook.prediction.kind).toBe("OUT_OF_TOLERANCE");
    expect(outlook.prediction.pieces).toBeGreaterThan(0);
    expect(outlook.prediction.pieces).toBeLessThanOrEqual(80);
  });

  it("expects a tool replacement when life is low and the series is flat", () => {
    const outlook = readOutlook({ ...base, toolRemainingLife: 12 });
    expect(outlook.prediction.kind).toBe("TOOL_REPLACEMENT");
    expect(outlook.prediction.pieces).toBe(5081);
  });

  it("flags scrap pressure before an unstable trend", () => {
    const outlook = readOutlook({ ...base, scrapCount: 3 });
    expect(outlook.prediction.kind).toBe("HIGH_SCRAP");
  });
});
