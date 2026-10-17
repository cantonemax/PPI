import { describe, expect, it } from "vitest";
import { productionProgressPercent } from "@/lib/economics";
import { formatCapability, formatCount, formatCurrency, formatDepartmentScore, formatPercent, formatQualityScore } from "@/lib/kpi/kpi-formatting";
import { evaluateSpc } from "@/lib/ppi-spc-engine";
import { SPCEngine } from "@/lib/spc/spc-engine";
import { StatisticsEngine } from "@/lib/statistics/statistics-engine";

const band = { toleranceMin: 9.95, toleranceMax: 10.05, target: 10 };

describe("kpi display formatting", () => {
  it("prints every percent with one decimal", () => {
    expect(formatPercent(87.36)).toBe("87.4%");
    expect(formatPercent(100)).toBe("100.0%");
    expect(formatPercent(productionProgressPercent(80, 100))).toBe("80.0%");
    expect(formatPercent(null)).toBeNull();
  });

  it("prints capability with two decimals and scores as integers", () => {
    expect(formatCapability(1.674)).toBe("1.67");
    expect(formatCapability(1.5)).toBe("1.50");
    expect(formatQualityScore(StatisticsEngine.qualityScore(1.5))).toBe("90");
    expect(formatDepartmentScore(84.4)).toBe("84");
    expect(formatCount(12.2)).toBe("12");
  });

  it("prints money with the euro sign and two decimals", () => {
    expect(formatCurrency(1250.4)).toBe("€ 1,250.40");
    expect(formatCurrency(48)).toBe("€ 48.00");
    expect(formatCurrency(5.1)).toBe("€ 5.10");
    expect(formatCurrency(-5.1)).toBe("-€ 5.10");
  });
});

describe("piece alarm and process alarm", () => {
  it("allows a good piece while the process is unstable", () => {
    const values = [8, 10, 10, 10, 10];
    const spc = evaluateSpc({ measurements: values, ...band });
    expect(SPCEngine.outOfTolerance(values.at(-1), band.toleranceMin, band.toleranceMax)).toBe(false);
    expect(SPCEngine.activeSpcRisk(values, band.toleranceMin, band.toleranceMax)).toBe("critical");
    expect(spc.risk).toBe("critical");
  });

  it("allows a bad piece while the process stays stable", () => {
    const values = Array.from({ length: 6 }, () => [9.96, 10.04, 9.97, 10.03]).flat();
    values[values.length - 1] = 10.06;
    const spc = evaluateSpc({ measurements: values, ...band });
    expect(SPCEngine.outOfTolerance(values.at(-1), band.toleranceMin, band.toleranceMax)).toBe(true);
    expect(SPCEngine.activeSpcRisk(values, band.toleranceMin, band.toleranceMax)).toBe("none");
    expect(spc.risk).toBe("none");
  });

  it("allows a bad piece and an unstable process together", () => {
    const values = [10.08, 10.09, 10.1, 10.11, 10.12];
    const spc = evaluateSpc({ measurements: values, ...band });
    expect(SPCEngine.outOfTolerance(values.at(-1), band.toleranceMin, band.toleranceMax)).toBe(true);
    expect(SPCEngine.activeSpcRisk(values, band.toleranceMin, band.toleranceMax)).toBe("critical");
    expect(spc.risk).toBe("critical");
  });
});
