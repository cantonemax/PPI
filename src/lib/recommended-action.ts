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
