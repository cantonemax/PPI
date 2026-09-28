import { describe, expect, it } from "vitest";
import { evaluateProcessGauge } from "@/lib/process-gauge";
import { readOutlook } from "@/lib/prediction";
import { recommendAction } from "@/lib/recommended-action";
import {
  createProcessMemory,
  recordMeasurement,
  recordPrediction,
  recordProcessSnapshot,
  recordScrapEvent,
  recordStopEvent,
  recordToolEvent,
  seedProcessMemory,
} from "@/lib/process-memory";

const place = {
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
  toolId: "DRILL-10",
};

describe("process memory", () => {
  it("stores a measurement when a check is saved", () => {
    const memory = createProcessMemory();
    const record = recordMeasurement(memory, {
      ...place,
      measuredValue: 10.001,
      producedQuantity: 37260,
      piecesSinceLastCheck: 8,
    });
    expect(memory.measurements).toHaveLength(1);
    expect(record.measuredValue).toBe(10.001);
    expect(record.machineId).toBe("MILL-03");
    expect(record.toolId).toBe("DRILL-10");
  });

  it("stores a tool replacement", () => {
    const memory = createProcessMemory();
    const record = recordToolEvent(memory, {
      machineId: "MILL-03",
      orderId: "125",
      toolId: "DRILL-10",
      toolCode: "DRILL-10",
      eventType: "WEAR_REPLACEMENT",
      lifeBeforeReplacement: 12,
      producedPieces: 37260,
      notes: "",
    });
    expect(memory.toolEvents).toEqual([record]);
    expect(record.eventType).toBe("WEAR_REPLACEMENT");
  });

  it("stores a scrap registration", () => {
    const memory = createProcessMemory();
    recordScrapEvent(memory, {
      machineId: "MILL-03",
      orderId: "125",
      partId: "BULLONE-M12",
      quantity: 1,
      reason: "OUT_OF_TOLERANCE",
    });
    expect(memory.scrapEvents[0].reason).toBe("OUT_OF_TOLERANCE");
    expect(memory.scrapEvents[0].quantity).toBe(1);
  });

  it("stores a machine stop", () => {
    const memory = createProcessMemory();
    recordStopEvent(memory, {
      machineId: "MILL-03",
      orderId: "125",
      durationMinutes: 15,
      reason: "TOOL_CHANGE",
    });
    expect(memory.stopEvents[0].durationMinutes).toBe(15);
    expect(memory.stopEvents[0].reason).toBe("TOOL_CHANGE");
  });

  it("stores a snapshot when the gauge is recalculated", () => {
    const memory = createProcessMemory();
    const gauge = evaluateProcessGauge({
      measurements: [10, 10.001, 9.999, 10, 10.001, 10, 10.002, 9.998, 10, 10.001],
      toleranceMin: 9.95,
      toleranceMax: 10.05,
      target: 10,
      producedQuantity: 37260,
      toolRemainingLife: 80,
      scrapCount: 2,
      machineRuntime: 120,
      toolChangeEvents: 0,
    });
    recordProcessSnapshot(memory, {
      machineId: "MILL-03",
      orderId: "125",
      processScore: gauge.score,
      status: gauge.state,
      diagnosis: gauge.diagnosis,
      measurementCount: 10,
      toolLife: 80,
      scrapCount: 2,
    });
    expect(memory.snapshots).toHaveLength(1);
    expect(memory.snapshots[0].processScore).toBe(gauge.score);
    expect(memory.snapshots[0].status).toBe(gauge.state);
  });

  it("stores a prediction when one is generated", () => {
    const memory = createProcessMemory();
    const input = {
      measurements: [10, 10.004, 10.008, 10.012, 10.016, 10.02, 10.024, 10.028, 10.032, 10.036],
      toleranceMin: 9.95,
      toleranceMax: 10.05,
      target: 10,
      producedQuantity: 37260,
      toolRemainingLife: 80,
      scrapCount: 0,
      machineRuntime: 120,
      toolChangeEvents: 0,
      checkInterval: 20,
    };
    const gauge = evaluateProcessGauge(input);
    const outlook = readOutlook(input);
    const action = recommendAction(gauge.diagnosis, gauge.score, outlook.context);
    recordPrediction(memory, {
      machineId: "MILL-03",
      orderId: "125",
      diagnosis: gauge.diagnosis,
      recommendedAction: action.action,
      predictionMessage: outlook.prediction.headline,
      confidence: action.confidence,
    });
    expect(memory.predictions).toHaveLength(1);
    expect(memory.predictions[0].confidence).toBe(action.confidence);
    expect(memory.predictions[0].diagnosis).toBe(gauge.diagnosis);
  });

  it("loads a simulated history", () => {
    const memory = seedProcessMemory();
    expect(memory.measurements).toHaveLength(100);
    expect(memory.scrapEvents).toHaveLength(20);
    expect(memory.stopEvents).toHaveLength(10);
    expect(memory.toolEvents).toHaveLength(15);
    expect(memory.snapshots).toHaveLength(50);
    expect(memory.predictions).toHaveLength(50);
  });
});
