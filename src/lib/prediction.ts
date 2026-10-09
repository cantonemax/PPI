import type { GaugeInput } from "@/lib/process-gauge";
import { evaluateSpc } from "@/lib/ppi-spc-engine";

export type PredictionKind =
  | "STABLE"
  | "OUT_OF_TOLERANCE"
  | "TOOL_REPLACEMENT"
  | "HIGH_SCRAP"
  | "UNSTABLE";

export type Prediction = {
  kind: PredictionKind;
  headline: string;
  detail?: string;
  pieces?: number;
};

export type ActionContext = {
  slope: number;
  outside: boolean;
  nearTolerance: boolean;
  toolLife: number;
  variabilityIncreasing: boolean;
  scrapPressure: boolean;
  thermal: boolean;
};

export type Outlook = {
  prediction: Prediction;
  context: ActionContext;
};

export type PredictionInput = GaugeInput & { checkInterval: number };

export function readOutlook(input: PredictionInput): Outlook {
  const spc = evaluateSpc(input);
  return { prediction: spc.prediction, context: spc.context };
}
