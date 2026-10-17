import { describe, expect, it } from "vitest";
import { t } from "@/lib/i18n";
import { evaluateSpc } from "@/lib/ppi-spc-engine";
import { qualityControlReading } from "@/lib/quality-evaluation";
import { SPCEngine } from "@/lib/spc/spc-engine";
import { StatisticsEngine } from "@/lib/statistics/statistics-engine";
import type { WesternElectricRule } from "@/lib/spc/types";

const band = { lsl: 9.95, usl: 10.05 };

function ruleOf(values: number[], rule: WesternElectricRule) {
  return qualityControlReading({ values, ...band }).rules.find((item) => item.rule === rule);
}

describe("quality desk", () => {
  it("shows rule 1 in red with the stop action", () => {
    const rule = ruleOf([8, 10, 10, 10, 10], "RULE_1");
    expect(rule?.active).toBe(true);
    expect(rule?.color).toBe("#FF4D4F");
    expect(rule?.severity).toBe("high");
    expect(t(rule?.actionKey ?? "")).toBe("Ferma e verifica la misura");
  });

  it("shows rule 2 in amber with the drift action", () => {
    const rule = ruleOf([10, 10.01, 9.99, 10, 10.005, 9.995, 10, 10.002, 10.03, 10.027, 10], "RULE_2");
    expect(rule?.active).toBe(true);
    expect(rule?.color).toBe("#FF9800");
    expect(rule?.severity).toBe("medium");
    expect(t(rule?.actionKey ?? "")).toBe("Verifica una possibile deriva del processo");
  });

  it("shows rule 3 in amber with the trend action", () => {
    const rule = ruleOf([10, 10.01, 10.01, 9.998, 10.01, 10.01, 10, 9.998, 10, 10], "RULE_3");
    expect(rule?.active).toBe(true);
    expect(rule?.color).toBe("#FF9800");
    expect(rule?.severity).toBe("medium");
    expect(t(rule?.actionKey ?? "")).toBe("Indaga la tendenza");
  });

  it("shows rule 4 in amber with the shift action", () => {
    const rule = ruleOf([9.986, 9.998, 10.019, 10.003, 10.011, 9.989, 10.013, 10.009, 10.008, 10.015, 10.01, 10.009, 10.009, 10.014], "RULE_4");
    expect(rule?.active).toBe(true);
    expect(rule?.color).toBe("#FF9800");
    expect(rule?.severity).toBe("medium");
    expect(t(rule?.actionKey ?? "")).toBe("Indaga lo spostamento del processo");
  });

  it("allows a good piece while the process is unstable", () => {
    const reading = qualityControlReading({ values: [8, 10, 10, 10, 10], ...band });
    expect(reading.partOut).toBe(false);
    expect(reading.processRisk).toBe("critical");
  });

  it("allows a bad piece while the process stays stable", () => {
    const values = Array.from({ length: 6 }, () => [9.96, 10.04, 9.97, 10.03]).flat();
    values[values.length - 1] = 10.06;
    const reading = qualityControlReading({ values, ...band });
    expect(reading.partOut).toBe(true);
    expect(reading.processRisk).toBe("none");
  });

  it("allows a bad piece and an unstable process together", () => {
    const reading = qualityControlReading({ values: [10.08, 10.09, 10.1, 10.11, 10.12], ...band });
    expect(reading.partOut).toBe(true);
    expect(reading.processRisk).toBe("critical");
  });

  it("takes Cp, Cpk, confidence and the quality score from StatisticsEngine", () => {
    const values = [10, 10.02, 9.98, 10.01, 9.99, 10.01];
    const reading = qualityControlReading({ values, lsl: 9.9, usl: 10.1 });
    const official = StatisticsEngine.capability(values, 9.9, 10.1);
    expect(official).not.toBeNull();
    expect(reading.cp).toBe(official?.cp);
    expect(reading.cpk).toBe(official?.cpk);
    expect(reading.qualityScore).toBe(StatisticsEngine.qualityScore(official?.cpk ?? 0));
    expect(reading.confidence).toBe(StatisticsEngine.confidence(values.length));
    expect(reading.outOfToleranceRate).toBe(SPCEngine.outOfToleranceRate(values, 9.9, 10.1));
    expect(reading.processRisk).toBe(SPCEngine.activeSpcRisk(values, 9.9, 10.1));
  });

  it("highlights the rule 1 point in red", () => {
    const mark = ruleOf([8, 10, 10, 10, 10], "RULE_1");
    const reading = qualityControlReading({ values: [8, 10, 10, 10, 10], ...band });
    expect(mark?.active).toBe(true);
    expect(reading.marks.some((item) => item.rule === "RULE_1" && item.color === "#FF4D4F")).toBe(true);
  });

  it("highlights the rule 2 point in amber", () => {
    const values = [10, 10.01, 9.99, 10, 10.005, 9.995, 10, 10.002, 10.03, 10.027, 10];
    const reading = qualityControlReading({ values, ...band });
    expect(reading.marks.some((item) => item.rule === "RULE_2" && item.color === "#FF9800")).toBe(true);
  });

  it("highlights the rule 3 point in amber", () => {
    const values = [10, 10.01, 10.01, 9.998, 10.01, 10.01, 10, 9.998, 10, 10];
    const reading = qualityControlReading({ values, ...band });
    expect(reading.marks.some((item) => item.rule === "RULE_3" && item.color === "#FF9800")).toBe(true);
  });

  it("highlights the rule 4 point in amber", () => {
    const values = [9.986, 9.998, 10.019, 10.003, 10.011, 9.989, 10.013, 10.009, 10.008, 10.015, 10.01, 10.009, 10.009, 10.014];
    const reading = qualityControlReading({ values, ...band });
    expect(reading.marks.some((item) => item.rule === "RULE_4" && item.color === "#FF9800")).toBe(true);
  });

  it("highlights nothing when no rule is active", () => {
    const values = [20.01, 20.02, 20, 19.99, 20.01, 20.02, 20, 20.01, 19.99, 20];
    const reading = qualityControlReading({ values, lsl: 19.9, usl: 20.1 });
    expect(reading.marks).toEqual([]);
  });

  it("reads the individuals chart and the moving range from SPCEngine", () => {
    const values = [10, 10.02, 9.98, 10.01, 9.99, 10.01];
    const reading = qualityControlReading({ values, lsl: 9.9, usl: 10.1 });
    expect(reading.individuals).toEqual(SPCEngine.individualsChart(values));
    expect(reading.movingRange).toEqual(SPCEngine.movingRange(values));
  });

  it("keeps the operator risk label unchanged when the process is only on warning", () => {
    const values = [10, 10.01, 10.01, 9.998, 10.01, 10.01, 10, 9.998, 10, 10];
    expect(SPCEngine.activeSpcRisk(values, band.lsl, band.usl)).toBe("attention");
    expect(evaluateSpc({ measurements: values, toleranceMin: band.lsl, toleranceMax: band.usl, target: 10 }).risk).toBe("critical");
  });
});
