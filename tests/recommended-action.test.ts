import { describe, expect, it } from "vitest";
import type { ActionContext } from "@/lib/prediction";
import { recommendAction } from "@/lib/recommended-action";

const calm: ActionContext = {
  slope: 0,
  outside: false,
  nearTolerance: false,
  toolLife: 90,
  variabilityIncreasing: false,
  scrapPressure: false,
  thermal: false,
};

describe("recommended action", () => {
  it("maps each diagnosis to one action", () => {
    expect(recommendAction("PROCESS_STABLE", 92, calm).action).toBe("operations.action.continue");
    expect(recommendAction("TREND_TOWARD_UPPER_LIMIT", 68, calm).action).toBe("operations.action.extra");
    expect(recommendAction("TREND_TOWARD_LOWER_LIMIT", 66, calm).action).toBe("operations.action.extra");
    expect(recommendAction("TOOL_WEAR_SUSPECTED", 62, calm).action).toBe("operations.action.replace");
    expect(recommendAction("THERMAL_DRIFT_DETECTED", 70, calm).action).toBe("operations.action.temperature");
    expect(recommendAction("INCREASING_VARIABILITY", 64, calm).action).toBe("operations.action.stability");
    expect(recommendAction("PROCESS_OUT_OF_CONTROL", 30, calm).action).toBe("operations.action.stop");
  });

  it("shows at most three reasons for an out-of-control stop", () => {
    const action = recommendAction("PROCESS_OUT_OF_CONTROL", 30, {
      ...calm,
      slope: 0.008,
      nearTolerance: true,
      toolLife: 12,
    });
    expect(action.confidence).toBe(80);
    expect(action.reasons).toEqual([
      "operations.reason.score",
      "operations.reason.drift",
      "operations.reason.tolerance",
    ]);
  });
});
