import { describe, expect, it } from "vitest";
import { createHistoricalRepository, findSimilarCases, getDimensionKnowledge, getMachineKnowledge, getToolKnowledge, supportPrediction, supportRecommendation } from "@/lib/historical-intelligence";
import { createProcessMemory, recordPrediction, recordProcessSnapshot, seedProcessMemory } from "@/lib/process-memory";

const history = seedProcessMemory();
const stable = { measurements: [10, 10.001, 9.999], drift: 0.001, variability: 0.001, toolLife: 70, diagnosis: "PROCESS_STABLE" as const };

describe("historical intelligence", () => {
  it("matches similar historical cases from memory", () => {
    const similarity = findSimilarCases(history, stable);
    expect(similarity.caseCount).toBe(34);
    expect(similarity.averageOutcome).toBe("CONTINUE PRODUCTION");
    expect(similarity.historicalConfidence).toBe(100);
    expect(similarity.averageRemainingLife).not.toBeNull();
  });

  it("returns an empty match when the diagnosis was never stored", () => {
    const similarity = findSimilarCases(history, { ...stable, diagnosis: "TOOL_WEAR_SUSPECTED" });
    expect(similarity.caseCount).toBe(0);
    expect(similarity.averageOutcome).toBeNull();
    expect(similarity.historicalConfidence).toBe(0);
  });

  it("summarizes tool knowledge", () => {
    const [tool] = getToolKnowledge(history);
    expect(tool.toolCode).toBe("DRILL-10");
    expect(tool.averageLife).toBeCloseTo(12.6);
    expect(tool.bestLife).toBe(19);
    expect(tool.worstLife).toBe(8);
    expect(tool.wearReplacements).toBe(12);
    expect(tool.breakageReplacements).toBe(3);
    expect(tool.averageScrapRate).toBe(0.01);
  });

  it("summarizes dimension and machine knowledge", () => {
    const [dimension] = getDimensionKnowledge(history);
    expect(dimension.dimensionCode).toBe("OD-10");
    expect(dimension.controlsPerformed).toBe(100);
    expect(dimension.toleranceViolations).toBe(0);
    expect(dimension.associatedScrapEvents).toBe(20);
    expect(dimension.averageProcessScore).toBeCloseTo(80.1);
    const [machine] = getMachineKnowledge(history);
    expect(machine.machineId).toBe("MILL-03");
    expect(machine.mostFrequentDiagnosis).toBe("PROCESS_STABLE");
    expect(machine.mostFrequentStopCause).toBe("TOOL_CHANGE");
    expect(machine.averageScrapRate).toBe(0.01);
    expect(machine.averageToolLife).toBeCloseTo(55.5);
  });

  it("attaches historical support to a recommendation and a prediction", () => {
    const support = supportRecommendation(history, stable, "CONTINUE PRODUCTION", 92);
    expect(support).toEqual({ action: "CONTINUE PRODUCTION", confidence: 92, supportedBy: 34 });
    const prediction = supportPrediction(history, stable, "NO RISK DETECTED");
    expect(prediction).toEqual({ predictionMessage: "NO RISK DETECTED", basedOnCases: 34, predictionConfidence: 100 });
  });

  it("reports tool-wear cases when that history exists", () => {
    const memory = createProcessMemory();
    for (let index = 0; index < 14; index += 1) {
      const timestamp = `2026-09-24T08:00:${String(index).padStart(2, "0")}Z`;
      recordProcessSnapshot(memory, {
        timestamp,
        machineId: "MILL-03",
        orderId: "125",
        processScore: 62,
        status: "ATTENTION",
        diagnosis: "TOOL_WEAR_SUSPECTED",
        measurementCount: 10,
        toolLife: 31,
        scrapCount: 1,
      });
      recordPrediction(memory, {
        timestamp,
        machineId: "MILL-03",
        orderId: "125",
        diagnosis: "TOOL_WEAR_SUSPECTED",
        recommendedAction: "REPLACE TOOL",
        predictionMessage: "TOOL REPLACEMENT EXPECTED",
        confidence: 85,
      });
    }
    const repository = createHistoricalRepository(memory);
    const similarity = repository.findSimilarCases({ measurements: [10.01, 10.02], drift: 0.004, variability: 0.002, toolLife: 12, diagnosis: "TOOL_WEAR_SUSPECTED" });
    expect(similarity.caseCount).toBe(14);
    expect(similarity.averageOutcome).toBe("REPLACE TOOL");
    expect(similarity.averageRemainingLife).toBe(31);
    const support = repository.supportRecommendation(similarity.cases[0] ? { measurements: [], drift: 0, variability: 0, toolLife: 12, diagnosis: "TOOL_WEAR_SUSPECTED" } : stable, "REPLACE TOOL", 85);
    expect(support.supportedBy).toBe(14);
    expect(support.confidence).toBe(85);
    const prediction = repository.supportPrediction({ measurements: [], drift: 0.004, variability: 0.002, toolLife: 12, diagnosis: "TOOL_WEAR_SUSPECTED" }, "TOOL REPLACEMENT EXPECTED");
    expect(prediction.basedOnCases).toBe(14);
    expect(prediction.predictionConfidence).toBe(100);
  });
});
