import type { ProcessDiagnosis, ProcessState } from "@/lib/process-gauge";

export type ScrapReason =
  | "OUT_OF_TOLERANCE"
  | "TOOL_WEAR"
  | "MATERIAL_DEFECT"
  | "SETUP_ISSUE"
  | "BURR"
  | "VISUAL_DEFECT"
  | "OTHER";

export type StopReason =
  | "TOOL_CHANGE"
  | "QUALITY_CHECK"
  | "SETUP"
  | "MATERIAL_WAIT"
  | "MACHINE_FAILURE"
  | "OTHER";

export type ToolEventType = "WEAR_REPLACEMENT" | "BREAKAGE_REPLACEMENT";

export type MeasurementRecord = {
  measurementId: string;
  timestamp: string;
  operatorId: string;
  machineId: string;
  orderId: string;
  jobId: string;
  partId: string;
  dimensionCode: string;
  dimensionName: string;
  target: number;
  minimumTolerance: number;
  maximumTolerance: number;
  measuredValue: number;
  producedQuantity: number;
  piecesSinceLastCheck: number;
  toolId: string;
};

export type ToolEventRecord = {
  toolEventId: string;
  timestamp: string;
  machineId: string;
  orderId: string;
  toolId: string;
  toolCode: string;
  eventType: ToolEventType;
  lifeBeforeReplacement: number;
  producedPieces: number;
  notes: string;
};

export type ScrapEventRecord = {
  scrapEventId: string;
  timestamp: string;
  machineId: string;
  orderId: string;
  partId: string;
  quantity: number;
  reason: ScrapReason;
};

export type StopEventRecord = {
  stopEventId: string;
  timestamp: string;
  machineId: string;
  orderId: string;
  durationMinutes: number;
  reason: StopReason;
};

export type ProcessSnapshotRecord = {
  snapshotId: string;
  timestamp: string;
  machineId: string;
  orderId: string;
  processScore: number;
  status: ProcessState;
  diagnosis: ProcessDiagnosis;
  measurementCount: number;
  toolLife: number;
  scrapCount: number;
};

export type PredictionHistoryRecord = {
  predictionId: string;
  timestamp: string;
  machineId: string;
  orderId: string;
  diagnosis: ProcessDiagnosis;
  recommendedAction: string;
  predictionMessage: string;
  confidence: number;
};

export type LearningOutcome = "SUCCESS" | "FAILURE" | "PARTIAL";

export type RecommendationOutcome = {
  id: string;
  timestamp: string;
  machineId: string;
  orderId: string;
  diagnosis: string;
  recommendedAction: string;
  confidence: number;
  historicalSupport: number;
  actionExecuted: boolean;
  outcome: LearningOutcome;
  notes: string;
};

export type PredictedEventKind = "OUT_OF_TOLERANCE" | "TOOL_REPLACEMENT" | "SCRAP_LIMIT";

export type PredictionOutcome = {
  id: string;
  predictionDate: string;
  machineId: string;
  orderId: string;
  toolCode: string;
  dimensionCode: string;
  diagnosis: string;
  predictedEvent: PredictedEventKind;
  predictedPieces: number;
  actualPieces: number;
  predictionError: number;
};

export type ToolLifeOutcome = {
  id: string;
  timestamp: string;
  toolCode: string;
  remainingLifePercent: number;
  expectedRemainingPieces: number;
  toolConfidence: number;
};

export type ProcessMemory = {
  measurements: MeasurementRecord[];
  toolEvents: ToolEventRecord[];
  scrapEvents: ScrapEventRecord[];
  stopEvents: StopEventRecord[];
  snapshots: ProcessSnapshotRecord[];
  predictions: PredictionHistoryRecord[];
  recommendationOutcomes: RecommendationOutcome[];
  predictionOutcomes: PredictionOutcome[];
  toolLifeOutcomes: ToolLifeOutcome[];
};

type MeasurementInput = Omit<MeasurementRecord, "measurementId" | "timestamp"> & { timestamp?: string };
type ToolEventInput = Omit<ToolEventRecord, "toolEventId" | "timestamp"> & { timestamp?: string };
type ScrapEventInput = Omit<ScrapEventRecord, "scrapEventId" | "timestamp"> & { timestamp?: string };
type StopEventInput = Omit<StopEventRecord, "stopEventId" | "timestamp"> & { timestamp?: string };
type SnapshotInput = Omit<ProcessSnapshotRecord, "snapshotId" | "timestamp"> & { timestamp?: string };
type PredictionInput = Omit<PredictionHistoryRecord, "predictionId" | "timestamp"> & { timestamp?: string };

export function createProcessMemory(): ProcessMemory {
  return {
    measurements: [],
    toolEvents: [],
    scrapEvents: [],
    stopEvents: [],
    snapshots: [],
    predictions: [],
    recommendationOutcomes: [],
    predictionOutcomes: [],
    toolLifeOutcomes: [],
  };
}

export function recordRecommendationOutcome(memory: ProcessMemory, input: Omit<RecommendationOutcome, "id" | "timestamp"> & { timestamp?: string }): RecommendationOutcome {
  const { timestamp, ...fields } = input;
  const record = { id: nextId("rec"), timestamp: timestamp ?? now(), ...fields };
  memory.recommendationOutcomes.push(record);
  return record;
}

export function recordPredictionOutcome(memory: ProcessMemory, input: Omit<PredictionOutcome, "id" | "predictionDate" | "predictionError"> & { predictionDate?: string }): PredictionOutcome {
  const { predictionDate, ...fields } = input;
  const record = {
    id: nextId("pout"),
    predictionDate: predictionDate ?? now(),
    predictionError: Math.abs(fields.actualPieces - fields.predictedPieces),
    ...fields,
  };
  memory.predictionOutcomes.push(record);
  return record;
}

export function recordToolLifeOutcome(memory: ProcessMemory, input: Omit<ToolLifeOutcome, "id" | "timestamp"> & { timestamp?: string }): ToolLifeOutcome {
  const { timestamp, ...fields } = input;
  const record = { id: nextId("life"), timestamp: timestamp ?? now(), ...fields };
  memory.toolLifeOutcomes.push(record);
  return record;
}

export function recordMeasurement(memory: ProcessMemory, input: MeasurementInput): MeasurementRecord {
  const { timestamp, ...fields } = input;
  const record = { measurementId: nextId("meas"), timestamp: timestamp ?? now(), ...fields };
  memory.measurements.push(record);
  return record;
}

export function recordToolEvent(memory: ProcessMemory, input: ToolEventInput): ToolEventRecord {
  const { timestamp, ...fields } = input;
  const record = { toolEventId: nextId("tool"), timestamp: timestamp ?? now(), ...fields };
  memory.toolEvents.push(record);
  return record;
}

export function recordScrapEvent(memory: ProcessMemory, input: ScrapEventInput): ScrapEventRecord {
  const { timestamp, ...fields } = input;
  const record = { scrapEventId: nextId("scrap"), timestamp: timestamp ?? now(), ...fields };
  memory.scrapEvents.push(record);
  return record;
}

export function recordStopEvent(memory: ProcessMemory, input: StopEventInput): StopEventRecord {
  const { timestamp, ...fields } = input;
  const record = { stopEventId: nextId("stop"), timestamp: timestamp ?? now(), ...fields };
  memory.stopEvents.push(record);
  return record;
}

export function recordProcessSnapshot(memory: ProcessMemory, input: SnapshotInput): ProcessSnapshotRecord {
  const { timestamp, ...fields } = input;
  const record = { snapshotId: nextId("snap"), timestamp: timestamp ?? now(), ...fields };
  memory.snapshots.push(record);
  return record;
}

export function recordPrediction(memory: ProcessMemory, input: PredictionInput): PredictionHistoryRecord {
  const { timestamp, ...fields } = input;
  const record = { predictionId: nextId("pred"), timestamp: timestamp ?? now(), ...fields };
  memory.predictions.push(record);
  return record;
}

const context = {
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
  toolCode: "DRILL-10",
};

const scrapReasons: ScrapReason[] = ["OUT_OF_TOLERANCE", "TOOL_WEAR", "MATERIAL_DEFECT", "SETUP_ISSUE", "BURR", "VISUAL_DEFECT", "OTHER"];
const stopReasons: StopReason[] = ["TOOL_CHANGE", "QUALITY_CHECK", "SETUP", "MATERIAL_WAIT", "MACHINE_FAILURE", "OTHER"];

export function seedProcessMemory(memory: ProcessMemory = createProcessMemory()): ProcessMemory {
  for (let index = 0; index < 100; index += 1) {
    recordMeasurement(memory, {
      ...context,
      timestamp: stamp(index),
      measuredValue: Number((10 + Math.sin(index / 8) * 0.012).toFixed(3)),
      producedQuantity: 36000 + index * 20,
      piecesSinceLastCheck: 20,
    });
  }
  for (let index = 0; index < 20; index += 1) {
    recordScrapEvent(memory, {
      timestamp: stamp(100 + index),
      machineId: context.machineId,
      orderId: context.orderId,
      partId: context.partId,
      quantity: 1,
      reason: scrapReasons[index % scrapReasons.length],
    });
  }
  for (let index = 0; index < 10; index += 1) {
    recordStopEvent(memory, {
      timestamp: stamp(120 + index),
      machineId: context.machineId,
      orderId: context.orderId,
      durationMinutes: 15,
      reason: stopReasons[index % stopReasons.length],
    });
  }
  for (let index = 0; index < 15; index += 1) {
    recordToolEvent(memory, {
      timestamp: stamp(130 + index),
      machineId: context.machineId,
      orderId: context.orderId,
      toolId: context.toolId,
      toolCode: context.toolCode,
      eventType: index % 5 === 0 ? "BREAKAGE_REPLACEMENT" : "WEAR_REPLACEMENT",
      lifeBeforeReplacement: 8 + (index % 12),
      producedPieces: 400 + index * 30,
      notes: "",
    });
  }
  for (let index = 0; index < 50; index += 1) {
    const status: ProcessState = index % 11 === 0 ? "CRITICAL" : index % 4 === 0 ? "ATTENTION" : "STABLE";
    recordProcessSnapshot(memory, {
      timestamp: stamp(150 + index),
      machineId: context.machineId,
      orderId: context.orderId,
      processScore: status === "STABLE" ? 90 : status === "ATTENTION" ? 70 : 35,
      status,
      diagnosis: status === "CRITICAL" ? "PROCESS_OUT_OF_CONTROL" : status === "ATTENTION" ? "TREND_TOWARD_UPPER_LIMIT" : "PROCESS_STABLE",
      measurementCount: 10,
      toolLife: 80 - index,
      scrapCount: index % 5,
    });
    recordPrediction(memory, {
      timestamp: stamp(150 + index),
      machineId: context.machineId,
      orderId: context.orderId,
      diagnosis: status === "CRITICAL" ? "PROCESS_OUT_OF_CONTROL" : "PROCESS_STABLE",
      recommendedAction: status === "CRITICAL" ? "STOP PRODUCTION" : "CONTINUE PRODUCTION",
      predictionMessage: status === "CRITICAL" ? "OUT OF TOLERANCE EXPECTED" : "NO RISK DETECTED",
      confidence: status === "CRITICAL" ? 80 : 92,
    });
  }
  return memory;
}

function nextId(prefix: string) {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

function now() {
  return new Date().toISOString();
}

function stamp(step: number) {
  return new Date(Date.UTC(2026, 8, 24, 6, 0, step)).toISOString();
}

let sequence = 0;
