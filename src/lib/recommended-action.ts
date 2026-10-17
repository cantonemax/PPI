import type { ProcessDiagnosis } from "@/lib/process-gauge";
import type { ActionContext } from "@/lib/prediction";

export type RecommendedAction = {
  action: string;
  confidence: number;
  reasons: string[];
};

const actions: Record<ProcessDiagnosis, string> = {
  PROCESS_STABLE: "operations.action.continue",
  TREND_TOWARD_UPPER_LIMIT: "operations.action.extra",
  TREND_TOWARD_LOWER_LIMIT: "operations.action.extra",
  TOOL_WEAR_SUSPECTED: "operations.action.replace",
  THERMAL_DRIFT_DETECTED: "operations.action.temperature",
  INCREASING_VARIABILITY: "operations.action.stability",
  PROCESS_OUT_OF_CONTROL: "operations.action.stop",
};

const fallback: Record<ProcessDiagnosis, string> = {
  PROCESS_STABLE: "operations.reason.stable",
  TREND_TOWARD_UPPER_LIMIT: "operations.reason.upper",
  TREND_TOWARD_LOWER_LIMIT: "operations.reason.lower",
  TOOL_WEAR_SUSPECTED: "operations.reason.tool",
  THERMAL_DRIFT_DETECTED: "operations.reason.thermal",
  INCREASING_VARIABILITY: "operations.reason.variability",
  PROCESS_OUT_OF_CONTROL: "operations.reason.tolerance",
};

export type OperatorDecision = {
  partKey: "operations.part.in" | "operations.part.out" | "spc.insufficient";
  partColor: string;
  processKey: "operations.process.stable" | "operations.process.warning" | "operations.process.unstable" | "spc.insufficient";
  processColor: string;
  toolKey: "operations.tool.ok" | "operations.tool.check" | "operations.tool.replace";
  toolColor: string;
  actionKey: "operations.decision.verify" | "operations.decision.measure" | "operations.decision.replace" | "operations.decision.quality" | "operations.action.continue";
};

const decisionColor = { good: "#00E676", warn: "#FF9800", bad: "#FF4D4F", muted: "#94a3b8" };

export function toolLifeBand(toolLife: number): "replace" | "check" | "ok" {
  if (toolLife <= 20) return "replace";
  if (toolLife <= 40) return "check";
  return "ok";
}

export function operatorDecision(input: {
  hasMeasurement: boolean;
  partOut: boolean;
  processRisk: "none" | "attention" | "critical" | null;
  toolLife: number;
  controlOverdue: boolean;
}): OperatorDecision {
  const tool = toolLifeBand(input.toolLife);
  const actionKey = input.partOut
    ? "operations.decision.verify"
    : input.controlOverdue
      ? "operations.decision.measure"
      : tool === "replace"
        ? "operations.decision.replace"
        : input.processRisk === "critical"
          ? "operations.decision.quality"
          : "operations.action.continue";
  return {
    partKey: !input.hasMeasurement ? "spc.insufficient" : input.partOut ? "operations.part.out" : "operations.part.in",
    partColor: !input.hasMeasurement ? decisionColor.muted : input.partOut ? decisionColor.bad : decisionColor.good,
    processKey: input.processRisk === "critical" ? "operations.process.unstable" : input.processRisk === "attention" ? "operations.process.warning" : input.processRisk === "none" ? "operations.process.stable" : "spc.insufficient",
    processColor: input.processRisk === "critical" ? decisionColor.bad : input.processRisk === "attention" ? decisionColor.warn : input.processRisk === "none" ? decisionColor.good : decisionColor.muted,
    toolKey: tool === "replace" ? "operations.tool.replace" : tool === "check" ? "operations.tool.check" : "operations.tool.ok",
    toolColor: tool === "replace" ? decisionColor.bad : tool === "check" ? decisionColor.warn : decisionColor.good,
    actionKey,
  };
}

export function recommendAction(diagnosis: ProcessDiagnosis, score: number, context: ActionContext): RecommendedAction {
  return {
    action: actions[diagnosis],
    confidence: confidenceOf(diagnosis, score),
    reasons: reasonsFor(diagnosis, score, context),
  };
}

function reasonsFor(diagnosis: ProcessDiagnosis, score: number, context: ActionContext) {
  const drifting = Math.abs(context.slope) >= 0.001;
  const catalog: Record<ProcessDiagnosis, Array<[string, boolean]>> = {
    PROCESS_OUT_OF_CONTROL: [
      ["operations.reason.score", score < 40],
      ["operations.reason.drift", drifting],
      ["operations.reason.tolerance", context.outside || context.nearTolerance],
      ["operations.reason.tool", context.toolLife < 20],
      ["operations.reason.variability", context.variabilityIncreasing],
    ],
    TOOL_WEAR_SUSPECTED: [
      ["operations.reason.tool", context.toolLife < 40],
      ["operations.reason.drift", drifting],
      ["operations.reason.variability", context.variabilityIncreasing],
    ],
    THERMAL_DRIFT_DETECTED: [
      ["operations.reason.thermal", context.thermal || drifting],
      ["operations.reason.drift", drifting],
    ],
    TREND_TOWARD_UPPER_LIMIT: [
      ["operations.reason.upper", true],
      ["operations.reason.drift", drifting],
      ["operations.reason.tolerance", context.nearTolerance],
    ],
    TREND_TOWARD_LOWER_LIMIT: [
      ["operations.reason.lower", true],
      ["operations.reason.drift", drifting],
      ["operations.reason.tolerance", context.nearTolerance],
    ],
    INCREASING_VARIABILITY: [
      ["operations.reason.variability", true],
      ["operations.reason.drift", drifting],
      ["operations.reason.scrap", context.scrapPressure],
    ],
    PROCESS_STABLE: [
      ["operations.reason.stable", true],
    ],
  };
  const reasons = catalog[diagnosis].filter(([, active]) => active).map(([key]) => key).slice(0, 3);
  return reasons.length > 0 ? reasons : [fallback[diagnosis]];
}

function confidenceOf(diagnosis: ProcessDiagnosis, score: number) {
  if (diagnosis === "PROCESS_STABLE") return clamp(score, 50, 99);
  if (diagnosis === "PROCESS_OUT_OF_CONTROL") return clamp(100 - score, 80, 99);
  return clamp(100 - score, 60, 95);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value)));
}
