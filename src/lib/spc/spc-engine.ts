import { StatisticsEngine } from "@/lib/statistics/statistics-engine";
import type { ControlLimitsResult, IndividualsChartResult, MovingRangeChartResult, SpcAlert } from "@/lib/spc/types";

const D2 = 1.128;
const INDIVIDUALS_SPAN = 2.66;
const D4 = 3.267;

function movingRanges(values: number[]) {
  const points: number[] = [];
  for (let index = 1; index < values.length; index += 1) points.push(Math.abs(values[index] - values[index - 1]));
  const mrAverage = points.length === 0 ? 0 : StatisticsEngine.mean(points);
  return { points, mrAverage };
}

export const SPCEngine = {
  movingRange(values: number[]): MovingRangeChartResult {
    const { points, mrAverage } = movingRanges(values);
    return {
      mrAverage,
      ucl: D4 * mrAverage,
      cl: mrAverage,
      lcl: 0,
      points,
    };
  },

  individualsChart(values: number[]): IndividualsChartResult {
    const mean = values.length === 0 ? 0 : StatisticsEngine.mean(values);
    const { mrAverage } = movingRanges(values);
    const sigmaEstimate = mrAverage / D2;
    return {
      mean,
      sigmaEstimate,
      mrAverage,
      ucl: mean + INDIVIDUALS_SPAN * mrAverage,
      cl: mean,
      lcl: mean - INDIVIDUALS_SPAN * mrAverage,
      points: values,
    };
  },

  controlLimits(values: number[]): ControlLimitsResult {
    return {
      individuals: SPCEngine.individualsChart(values),
      movingRange: SPCEngine.movingRange(values),
    };
  },

  evaluateWesternElectric(values: number[]): SpcAlert[] {
    if (values.length === 0) return [];
    const chart = SPCEngine.individualsChart(values);
    const sigma = chart.sigmaEstimate;
    const mean = chart.mean;
    const alerts: SpcAlert[] = [];
    values.forEach((value, index) => {
      if (Math.abs(value - mean) > 3 * sigma) {
        alerts.push({ rule: "RULE_1", index, value, message: "spc.westernElectric.rule1" });
      }
    });
    for (let start = 0; start <= values.length - 3; start += 1) {
      const window = values.slice(start, start + 3);
      const above = window.filter((value) => value - mean > 2 * sigma).length;
      const below = window.filter((value) => mean - value > 2 * sigma).length;
      if (above >= 2 || below >= 2) {
        const index = start + 2;
        alerts.push({ rule: "RULE_2", index, value: values[index], message: "spc.westernElectric.rule2" });
      }
    }
    for (let start = 0; start <= values.length - 5; start += 1) {
      const window = values.slice(start, start + 5);
      const above = window.filter((value) => value - mean > sigma).length;
      const below = window.filter((value) => mean - value > sigma).length;
      if (above >= 4 || below >= 4) {
        const index = start + 4;
        alerts.push({ rule: "RULE_3", index, value: values[index], message: "spc.westernElectric.rule3" });
      }
    }
    let run = 1;
    for (let index = 1; index < values.length; index += 1) {
      const sameSide = (values[index] - mean) * (values[index - 1] - mean) > 0;
      run = sameSide ? run + 1 : 1;
      if (run >= 8) alerts.push({ rule: "RULE_4", index, value: values[index], message: "spc.westernElectric.rule4" });
    }
    return alerts;
  },

  departmentScore(scores: readonly (number | null | undefined)[]): number | null {
    const active = scores.filter((score): score is number => typeof score === "number" && Number.isFinite(score));
    if (active.length === 0) return null;
    return Math.round(active.reduce((sum, score) => sum + score, 0) / active.length);
  },

  outOfTolerance(measurement: number | null | undefined, lsl: number, usl: number): boolean {
    if (typeof measurement !== "number" || !Number.isFinite(measurement)) return false;
    return measurement < lsl || measurement > usl;
  },

  outOfToleranceRate(measurements: readonly number[], lsl: number, usl: number): number | null {
    if (measurements.length === 0) return null;
    const outside = measurements.filter((value) => SPCEngine.outOfTolerance(value, lsl, usl)).length;
    return (outside / measurements.length) * 100;
  },

  activeSpcRisk(values: readonly number[], lsl: number, usl: number): "none" | "attention" | "critical" | null {
    const sample = values.filter((value) => Number.isFinite(value));
    if (sample.length < 5 || !(usl > lsl)) return null;
    const rules = new Set(SPCEngine.evaluateWesternElectric(sample).map((alert) => alert.rule));
    const half = (usl - lsl) / 2;
    const drifting = Math.abs(sampleSlope(sample)) > half / 40;
    if (rules.has("RULE_1") || drifting) return "critical";
    if (rules.size > 0) return "attention";
    return "none";
  },
};

function sampleSlope(values: readonly number[]) {
  const count = values.length;
  const meanX = (count - 1) / 2;
  const meanY = values.reduce((sum, value) => sum + value, 0) / count;
  let numerator = 0;
  let denominator = 0;
  values.forEach((value, index) => {
    numerator += (index - meanX) * (value - meanY);
    denominator += (index - meanX) ** 2;
  });
  return denominator === 0 ? 0 : numerator / denominator;
}
