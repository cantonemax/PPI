import { evaluateSpc } from "@/lib/ppi-spc-engine";

export type ProcessState = "STABLE" | "ATTENTION" | "CRITICAL";

export type ProcessDiagnosis =
  | "PROCESS_STABLE"
  | "TREND_TOWARD_UPPER_LIMIT"
  | "TREND_TOWARD_LOWER_LIMIT"
  | "TOOL_WEAR_SUSPECTED"
  | "THERMAL_DRIFT_DETECTED"
  | "INCREASING_VARIABILITY"
  | "PROCESS_OUT_OF_CONTROL";

export type GaugeInput = {
  measurements: number[];
  toleranceMin: number;
  toleranceMax: number;
  target: number;
  producedQuantity: number;
  toolRemainingLife: number;
  scrapCount: number;
  machineRuntime: number;
  toolChangeEvents: number;
  trendMarker?: number;
};

export type GaugeResult = {
  score: number;
  state: ProcessState;
  diagnosis: ProcessDiagnosis;
  drift: string;
  variability: string;
};

export function evaluateProcessGauge(input: GaugeInput): GaugeResult {
  const spc = evaluateSpc(input);
  const slope = spc.slope ?? 0;
  const sigma = spc.sigma ?? 0;
  return {
    score: spc.gauge.score ?? 0,
    state: spc.gauge.state === "INSUFFICIENT" ? "STABLE" : spc.gauge.state,
    diagnosis: spc.gauge.diagnosis ?? "PROCESS_STABLE",
    drift: `${slope >= 0 ? "+" : ""}${slope.toFixed(3)} mm`,
    variability: `${sigma.toFixed(3)} mm`,
  };
}
