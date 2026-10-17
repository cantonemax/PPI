import { describe, expect, it } from "vitest";
import { ANALYTICS_TEST_MARK, analyticsTestCompanies } from "@/lib/analytics-test-companies";

describe("analytics test companies", () => {
  it("lists twelve realistic companies including MRC PROJECT SRL", () => {
    expect(analyticsTestCompanies).toHaveLength(12);
    expect(analyticsTestCompanies.some((row) => row.name === "MRC PROJECT SRL")).toBe(true);
    expect(new Set(analyticsTestCompanies.map((row) => row.planName))).toEqual(new Set(["FREE", "CORE", "PROFESSIONAL", "ENTERPRISE"]));
    for (const row of analyticsTestCompanies) {
      expect(row.region.trim().length).toBeGreaterThan(0);
      expect(row.province.trim().length).toBeGreaterThan(0);
      expect(row.country.trim().length).toBeGreaterThan(0);
      expect(row.monthlyRevenue).toMatch(/^\d+\.\d{2}$/);
      expect(row.annualRevenue).toMatch(/^\d+\.\d{2}$/);
      expect(row.activatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(row.renewalAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    expect(ANALYTICS_TEST_MARK).toBe("TEST DATA");
  });
});
