import { describe, expect, it } from "vitest";
import { getDiagnosisAnalytics, getDimensionAnalytics, getMachineAnalytics, getOrderAnalytics, getScrapAnalytics, getStopAnalytics, getToolAnalytics } from "@/lib/process-analytics";
import { seedProcessMemory } from "@/lib/process-memory";

const memory = seedProcessMemory();

describe("historical analytics", () => {
  it("summarizes tool replacements from memory", () => {
    const [tool] = getToolAnalytics(memory);
    expect(tool.toolCode).toBe("DRILL-10");
    expect(tool.wearReplacements).toBe(12);
    expect(tool.breakageReplacements).toBe(3);
    expect(tool.averageLife).toBeCloseTo(12.6);
    expect(tool.averageProducedPieces).toBe(610);
  });

  it("summarizes the machine from measurements, scraps, stops, and snapshots", () => {
    const [machine] = getMachineAnalytics(memory);
    expect(machine).toMatchObject({
      machineId: "MILL-03",
      totalMeasurements: 100,
      totalScraps: 20,
      totalStops: 10,
      breakageCount: 3,
      wearReplacementCount: 12,
    });
    expect(machine.averageProcessScore).toBeCloseTo(80.1);
    expect(machine.averageToolLife).toBeCloseTo(55.5);
  });

  it("summarizes scrap reasons and the rate against checked pieces", () => {
    const scrap = getScrapAnalytics(memory);
    expect(scrap.topReasons[0].count).toBe(3);
    expect(scrap.distribution.reduce((sum, item) => sum + item.share, 0)).toBeCloseTo(1);
    expect(scrap.ratePerMachine[0]).toEqual({ machineId: "MILL-03", rate: 0.01 });
    expect(scrap.ratePerTool[0].rate).toBe(0.01);
    expect(scrap.ratePerDimension[0].rate).toBe(0.01);
  });

  it("counts every diagnosis, including those absent from the history", () => {
    const rows = getDiagnosisAnalytics(memory);
    expect(rows.map((item) => item.diagnosis)).toEqual([
      "PROCESS_STABLE",
      "TREND_TOWARD_UPPER_LIMIT",
      "TREND_TOWARD_LOWER_LIMIT",
      "TOOL_WEAR_SUSPECTED",
      "THERMAL_DRIFT_DETECTED",
      "INCREASING_VARIABILITY",
      "PROCESS_OUT_OF_CONTROL",
    ]);
    expect(rows.find((item) => item.diagnosis === "PROCESS_STABLE")?.occurrences).toBe(34);
    expect(rows.find((item) => item.diagnosis === "TREND_TOWARD_UPPER_LIMIT")?.occurrences).toBe(11);
    expect(rows.find((item) => item.diagnosis === "PROCESS_OUT_OF_CONTROL")?.occurrences).toBe(5);
    expect(rows.find((item) => item.diagnosis === "TOOL_WEAR_SUSPECTED")?.occurrences).toBe(0);
    expect(rows.find((item) => item.diagnosis === "PROCESS_STABLE")?.averageScore).toBe(90);
  });

  it("summarizes the dimension and the order on the same history", () => {
    const [dimension] = getDimensionAnalytics(memory);
    expect(dimension.dimensionCode).toBe("OD-10");
    expect(dimension.controlsPerformed).toBe(100);
    expect(dimension.toleranceViolations).toBe(0);
    expect(dimension.scrapRelatedEvents).toBe(20);
    const [order] = getOrderAnalytics(memory);
    expect(order.orderId).toBe("125");
    expect(order.measurements).toBe(100);
    expect(order.toolChanges).toBe(15);
    expect(order.scraps).toBe(20);
    expect(order.stops).toBe(10);
    expect(order.mostFrequentDiagnosis).toBe("PROCESS_STABLE");
  });

  it("summarizes stop reasons and duration", () => {
    const stops = getStopAnalytics(memory);
    expect(stops.averageDurationMinutes).toBe(15);
    expect(stops.stopsPerMachine).toEqual([{ machineId: "MILL-03", count: 10 }]);
    expect(stops.stopsPerOrder).toEqual([{ orderId: "125", count: 10 }]);
    expect(stops.topReasons[0].count).toBe(2);
  });
});
