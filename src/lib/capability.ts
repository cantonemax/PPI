export type Confidence = "low" | "medium" | "good" | "high";

export type Capability =
  | { status: "indices"; cp: number; cpk: number; confidence: Confidence }
  | { status: "notCalculable" };

export function capability(values: number[], lower: number, upper: number): Capability | null {
  if (values.length < 5) return null;
  if (!Number.isFinite(lower) || !Number.isFinite(upper) || !(upper > lower)) return null;
  const count = values.length;
  const mean = values.reduce((sum, value) => sum + value, 0) / count;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (count - 1);
  const sigma = Math.sqrt(variance);
  if (sigma === 0) return { status: "notCalculable" };
  const confidence: Confidence = count >= 30 ? "high" : count >= 20 ? "good" : count >= 10 ? "medium" : "low";
  return {
    status: "indices",
    cp: (upper - lower) / (6 * sigma),
    cpk: Math.min((upper - mean) / (3 * sigma), (mean - lower) / (3 * sigma)),
    confidence,
  };
}
