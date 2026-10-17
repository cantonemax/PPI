import { evaluateSpc } from "@/lib/ppi-spc-engine";
import { StatisticsEngine } from "@/lib/statistics/statistics-engine";

export type Confidence = "low" | "medium" | "good" | "high";

export type Capability =
  | { status: "indices"; cp: number; cpk: number; confidence: Confidence }
  | { status: "notCalculable" };

export function capability(values: number[], lower: number, upper: number): Capability | null {
  const spc = evaluateSpc({ measurements: values, toleranceMin: lower, toleranceMax: upper, target: (lower + upper) / 2 });
  if (!spc.ready || spc.cp === null || spc.cpk === null) return spc.sigma === 0 ? { status: "notCalculable" } : null;
  const confidence: Confidence = StatisticsEngine.confidence(spc.sampleSize);
  return { status: "indices", cp: spc.cp, cpk: spc.cpk, confidence };
}
