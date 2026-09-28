import { describe, expect, it } from "vitest";
import { classifyPredictionError, estimateToolLife, judgeReplaceTool, predictionError, recommendationSuccessRates } from "@/lib/core-intelligence";
import { createProcessMemory, recordPredictionOutcome, recordRecommendationOutcome, recordToolLifeOutcome } from "@/lib/process-memory";

describe("core intelligence", () => {
  it("marks a tool replacement as success when the next checks improve", () => {
    const outcome = judgeReplaceTool({ scoreBefore: 62, scoreAfter: 88, driftBefore: 0.008, driftAfter: 0.002, toleranceViolations: 0 });
    expect(outcome).toBe("SUCCESS");
    const memory = createProcessMemory();
    recordRecommendationOutcome(memory, {
      machineId: "MILL-03",
      orderId: "125",
      diagnosis: "TOOL_WEAR_SUSPECTED",
      recommendedAction: "REPLACE TOOL",
      confidence: 85,
      historicalSupport: 14,
      actionExecuted: true,
      outcome,
      notes: "",
    });
    expect(recommendationSuccessRates(memory)[0]).toMatchObject({ action: "REPLACE TOOL", occurrences: 1, successes: 1, successRate: 100 });
  });

  it("classifies a 3 piece prediction error as excellent", () => {
    const error = predictionError(24, 27);
    expect(error).toBe(3);
    expect(classifyPredictionError(error)).toBe("EXCELLENT");
    const memory = createProcessMemory();
    const stored = recordPredictionOutcome(memory, {
      machineId: "MILL-03",
      orderId: "125",
      toolCode: "DRILL-10",
      dimensionCode: "OD-10",
      diagnosis: "TREND_TOWARD_UPPER_LIMIT",
      predictedEvent: "OUT_OF_TOLERANCE",
      predictedPieces: 24,
      actualPieces: 27,
    });
    expect(stored.predictionError).toBe(3);
    expect(memory.predictionOutcomes).toHaveLength(1);
  });

  it("estimates about 31 pieces and 5 percent life when drift is increasing", () => {
    const life = estimateToolLife({
      toolCode: "DRILL-10",
      averagePiecesLife: 620,
      currentProducedPieces: 590,
      driftIncreasing: true,
      variabilityIncreasing: false,
      scrapRate: 0.01,
      processScore: 68,
      replacementCount: 10,
    });
    expect(life.expectedRemainingPieces).toBeGreaterThanOrEqual(25);
    expect(life.expectedRemainingPieces).toBeLessThanOrEqual(35);
    expect(life.remainingLifePercent).toBe(5);
    expect(life.toolConfidence).toBe(89);
    const memory = createProcessMemory();
    recordToolLifeOutcome(memory, life);
    expect(memory.toolLifeOutcomes[0].toolCode).toBe("DRILL-10");
  });
});
