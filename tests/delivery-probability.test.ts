import { describe, expect, it } from "vitest";
import { deliveryBand, deliveryProbability, planningDatesValid, type DeliveryFactors } from "@/lib/delivery-probability";

const ready: DeliveryFactors = {
  progress: 0.8,
  efficiencyRatio: 1,
  qualityState: "optimal",
  materialRisk: "none",
  toolRisk: "none",
  daysRemaining: 5,
  estimatedRemainingTime: 400,
  timeUnit: "MINUTE",
};

describe("planning dates", () => {
  it("requires the delivery date after the start date", () => {
    expect(planningDatesValid(new Date("2026-09-01"), new Date("2026-09-10"))).toBe(true);
    expect(planningDatesValid(new Date("2026-09-10"), new Date("2026-09-01"))).toBe(false);
    expect(planningDatesValid(new Date("2026-09-01"), new Date("2026-09-01"))).toBe(false);
    expect(planningDatesValid(null, new Date("2026-09-10"))).toBe(false);
    expect(planningDatesValid(null, null)).toBe(true);
  });
});

describe("delivery probability", () => {
  it("is high when progress, quality and the plan still fit the shift", () => {
    const result = deliveryProbability(ready);
    expect(result.percent).toBeGreaterThanOrEqual(85);
    expect(result.band).toBe("high");
  });

  it("is moderate inside 60-84", () => {
    const result = deliveryProbability({
      ...ready,
      progress: 0.4,
      efficiencyRatio: 1.4,
      qualityState: "moderate",
      daysRemaining: 2,
      estimatedRemainingTime: 900,
    });
    expect(result.percent).toBeGreaterThanOrEqual(60);
    expect(result.percent).toBeLessThanOrEqual(84);
    expect(result.band).toBe("moderate");
  });

  it("is low when the delivery date has passed and work remains", () => {
    const result = deliveryProbability({
      ...ready,
      progress: 0.2,
      efficiencyRatio: 3,
      qualityState: "critical",
      materialRisk: "critical",
      toolRisk: "critical",
      daysRemaining: -1,
      estimatedRemainingTime: 600,
    });
    expect(result.percent).toBeLessThanOrEqual(59);
    expect(result.band).toBe("low");
  });

  it("drops when efficiency gets worse and every other input stays", () => {
    const onTarget = deliveryProbability(ready);
    const late = deliveryProbability({ ...ready, efficiencyRatio: 3 });
    expect(late.percent).toBeLessThan(onTarget.percent);
  });

  it("bands the published thresholds", () => {
    expect(deliveryBand(100)).toBe("high");
    expect(deliveryBand(85)).toBe("high");
    expect(deliveryBand(84)).toBe("moderate");
    expect(deliveryBand(60)).toBe("moderate");
    expect(deliveryBand(59)).toBe("low");
    expect(deliveryBand(0)).toBe("low");
  });
});
