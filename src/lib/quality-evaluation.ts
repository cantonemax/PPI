export type QualityState = "optimal" | "moderate" | "poor" | "critical";

export function warningThreshold(target: number, warningDelta: number) {
  return target - warningDelta;
}

export function criticalThreshold(target: number, criticalDelta: number) {
  return target - criticalDelta;
}

/** Interprets an existing quality percentage. Does not compute the percentage. */
export function interpretQuality(quality: number, target: number, warningDelta: number, criticalDelta: number): QualityState {
  if (quality >= target) return "optimal";
  if (quality >= warningThreshold(target, warningDelta)) return "moderate";
  if (quality >= criticalThreshold(target, criticalDelta)) return "poor";
  return "critical";
}

export function qualityDifference(quality: number, target: number) {
  return quality - target;
}

/** Existing presentation of Cpk. Unchanged: 1.67 is the 100% reference. */
export function qualityPercentFromCpk(cpk: number) {
  return Math.round(Math.min(100, Math.max(0, (cpk / 1.67) * 100)));
}
