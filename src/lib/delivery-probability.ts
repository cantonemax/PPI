export const PLANNING_SHIFT_HOURS = 8;

export type DeliveryBand = "high" | "moderate" | "low";
export type RiskLevel = "none" | "moderate" | "critical";
export type DeliveryQuality = "optimal" | "moderate" | "poor" | "critical" | null;

export type DeliveryFactors = {
  progress: number;
  efficiencyRatio: number | null;
  qualityState: DeliveryQuality;
  materialRisk: RiskLevel;
  toolRisk: RiskLevel;
  daysRemaining: number;
  estimatedRemainingTime: number;
  timeUnit: "MINUTE" | "HOUR";
};

export function planningDatesValid(start: Date | null, delivery: Date | null) {
  if (start === null && delivery === null) return true;
  if (start === null || delivery === null) return false;
  return delivery.getTime() > start.getTime();
}

export function daysRemaining(now: Date, plannedDelivery: Date) {
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const end = Date.UTC(plannedDelivery.getUTCFullYear(), plannedDelivery.getUTCMonth(), plannedDelivery.getUTCDate());
  return (end - start) / 86_400_000;
}

export function deliveryProbability(input: DeliveryFactors): { percent: number; band: DeliveryBand } {
  const percent = clamp(Math.round(
    scheduleScore(input) * 0.3
    + clamp(input.progress * 100) * 0.2
    + efficiencyScore(input.efficiencyRatio) * 0.15
    + qualityFactor(input.qualityState) * 0.15
    + riskScore(input.materialRisk) * 0.1
    + riskScore(input.toolRisk) * 0.1,
  ));
  return { percent, band: deliveryBand(percent) };
}

export function deliveryBand(percent: number): DeliveryBand {
  if (percent >= 85) return "high";
  if (percent >= 60) return "moderate";
  return "low";
}

function scheduleScore(input: DeliveryFactors) {
  const shift = input.timeUnit === "HOUR" ? PLANNING_SHIFT_HOURS : PLANNING_SHIFT_HOURS * 60;
  if (input.estimatedRemainingTime <= 0) return 100;
  if (input.daysRemaining < 0) return 0;
  const capacity = input.daysRemaining * shift;
  if (capacity <= 0) return 10;
  const load = input.estimatedRemainingTime / capacity;
  if (load <= 1) return 100;
  if (load <= 1.25) return 70;
  if (load <= 1.5) return 45;
  return 15;
}

function efficiencyScore(ratio: number | null) {
  if (ratio === null) return 50;
  if (ratio <= 1.1) return 100;
  if (ratio <= 1.5) return 70;
  if (ratio <= 2) return 45;
  return 20;
}

function qualityFactor(state: DeliveryQuality) {
  if (state === "optimal") return 100;
  if (state === "moderate") return 75;
  if (state === "poor") return 40;
  if (state === "critical") return 15;
  return 50;
}

function riskScore(risk: RiskLevel) {
  if (risk === "critical") return 20;
  if (risk === "moderate") return 60;
  return 100;
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}
