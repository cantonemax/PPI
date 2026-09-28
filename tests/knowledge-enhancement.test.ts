import { describe, expect, it } from "vitest";
import { buildPredictionAccuracy, enhanceRecommendation, experienceScore, getDiagnosisReliability, getEnhancedDimensionKnowledge, getEnhancedMachineKnowledge, getEnhancedToolKnowledge, measurePredictionError } from "@/lib/knowledge-enhancement";
import { createProcessMemory, recordPrediction, recordProcessSnapshot, seedProcessMemory } from "@/lib/process-memory";

const history = seedProcessMemory();

function wearHistory() {
  const memory = createProcessMemory();
  for (let index = 0; index < 14; index += 1) {
    const timestamp = `2026-09-24T09:00:${String(index).padStart(2, "0")}Z`;
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
      predictionMessage: index === 13 ? "NO RISK DETECTED" : "TOOL REPLACEMENT EXPECTED",
      confidence: 85,
    });
  }
  for (let index = 0; index < 8; index += 1) {
    memory.measurements.push({
      measurementId: `m-${index}`,
      timestamp: `2026-09-24T08:00:${String(index).padStart(2, "0")}Z`,
      operatorId: "operator-1",
      machineId: "MILL-03",
      orderId: "125",
      jobId: "CM-2026-0145",
      partId: "BULLONE-M12",
      dimensionCode: "OD-10",
      dimensionName: "OUTER DIAMETER",
      target: 10,
      minimumTolerance: 9.95,
      maximumTolerance: 10.05,
      measuredValue: 10.01,
      producedQuantity: 1000 + index,
      piecesSinceLastCheck: 20,
      toolId: "DRILL-10",
    });
  }
  return memory;
}

describe("knowledge enhancement", () => {
  it("raises action confidence with historical success and experience", () => {
    const memory = wearHistory();
    const enhanced = enhanceRecommendation(memory, {
      measurements: [10.02, 10.03],
      drift: 0.004,
      variability: 0.002,
      toolLife: 12,
      diagnosis: "TOOL_WEAR_SUSPECTED",
    }, "REPLACE TOOL", 85);
    expect(enhanced.supportedBy).toBe(14);
    expect(enhanced.historicalSuccessRate).toBe(92);
    expect(enhanced.experienceScore).toBe(92);
    expect(enhanced.confidence).toBe(91);
    expect(enhanced.action).toBe("REPLACE TOOL");
  });

  it("measures diagnosis reliability and prediction error", () => {
    const reliability = getDiagnosisReliability(wearHistory()).find((item) => item.diagnosis === "TOOL_WEAR_SUSPECTED");
    expect(reliability).toMatchObject({ occurrences: 14, successfulPredictions: 13, failedPredictions: 1, accuracy: 92 });
    expect(measurePredictionError(24, 27)).toMatchObject({
      predictionHorizon: 24,
      predictionError: 3,
      actualEvent: "Out of tolerance in 27 pcs",
    });
    const records = buildPredictionAccuracy(history);
    expect(records).toHaveLength(50);
    expect(records.every((item) => item.predictedEvent.length > 0)).toBe(true);
  });

  it("enhances tool, dimension, and machine knowledge from the simulated history", () => {
    const [tool] = getEnhancedToolKnowledge(history);
    expect(tool.toolCode).toBe("DRILL-10");
    expect(tool.medianLife).toBe(12);
    expect(tool.bestLife).toBe(19);
    expect(tool.worstLife).toBe(8);
    expect(tool.wearReplacementRate).toBeCloseTo(0.8);
    expect(tool.breakageRate).toBeCloseTo(0.2);
    expect(tool.predictionAccuracy).toBe(78);
    const [dimension] = getEnhancedDimensionKnowledge(history);
    expect(dimension.dimensionCode).toBe("OD-10");
    expect(dimension.toleranceViolationRate).toBe(0);
    expect(dimension.predictionAccuracy).toBe(78);
    const [machine] = getEnhancedMachineKnowledge(history);
    expect(machine.machineId).toBe("MILL-03");
    expect(machine.mostFrequentDiagnosis).toBe("PROCESS_STABLE");
    expect(machine.stopRate).toBe(0.1);
    expect(machine.scrapRate).toBe(0.01);
    expect(machine.predictionAccuracy).toBe(78);
    expect(experienceScore(14, 92, 28)).toBe(92);
  });
});
