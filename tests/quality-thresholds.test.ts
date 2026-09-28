import { describe, expect, it } from "vitest";
import { interpretQuality } from "@/lib/quality-evaluation";
import { canManageQualityThresholds, companyQualityDefaults, resolveQualityThresholds } from "@/lib/quality-thresholds";

const company = {
  companyTarget: companyQualityDefaults.target,
  companyWarningDelta: companyQualityDefaults.warningDelta,
  companyCriticalDelta: companyQualityDefaults.criticalDelta,
};

describe("quality threshold governance", () => {
  it("applies the tenant defaults when the order keeps company values", () => {
    expect(resolveQualityThresholds({
      useCompanyDefaults: true,
      target: null,
      warningDelta: null,
      criticalDelta: null,
      ...company,
    })).toEqual({ target: 90, warningDelta: 2, criticalDelta: 5 });
  });

  it("lets a custom order override the company defaults", () => {
    expect(resolveQualityThresholds({
      useCompanyDefaults: false,
      target: 98,
      warningDelta: 2,
      criticalDelta: 4,
      ...company,
    })).toEqual({ target: 98, warningDelta: 2, criticalDelta: 4 });
  });

  it("allows owners, plant managers, quality managers, and explicitly authorized users", () => {
    expect(canManageQualityThresholds([{ role: "OWNER" }])).toBe(true);
    expect(canManageQualityThresholds([{ role: "PRODUCTION_MANAGER" }])).toBe(true);
    expect(canManageQualityThresholds([{ role: "QUALITY_MANAGER" }])).toBe(true);
    expect(canManageQualityThresholds([{ role: "OPERATOR", qualityThresholdAuthority: true }])).toBe(true);
  });

  it("denies operators and other roles without authority", () => {
    expect(canManageQualityThresholds([{ role: "OPERATOR" }])).toBe(false);
    expect(canManageQualityThresholds([{ role: "OPERATOR", qualityThresholdAuthority: false }])).toBe(false);
    expect(canManageQualityThresholds([])).toBe(false);
  });

  it("moves through optimal, moderate, poor, and critical against the defaults", () => {
    const thresholds = resolveQualityThresholds({
      useCompanyDefaults: true,
      target: null,
      warningDelta: null,
      criticalDelta: null,
      ...company,
    })!;
    expect(interpretQuality(90, thresholds.target, thresholds.warningDelta, thresholds.criticalDelta)).toBe("optimal");
    expect(interpretQuality(88, thresholds.target, thresholds.warningDelta, thresholds.criticalDelta)).toBe("moderate");
    expect(interpretQuality(86, thresholds.target, thresholds.warningDelta, thresholds.criticalDelta)).toBe("poor");
    expect(interpretQuality(84, thresholds.target, thresholds.warningDelta, thresholds.criticalDelta)).toBe("critical");
  });
});
