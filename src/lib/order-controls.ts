import { drawingReferences } from "@/lib/drawing-references";
import { isToleranceKind, type ToleranceKind } from "@/lib/tolerance";

export type OrderControlRow = {
  reference: string;
  dimensionName: string;
  nominal: string;
  toleranceKind: ToleranceKind;
  tolerance: string;
  upperDeviation: string;
  lowerDeviation: string;
  frequency: number;
  x: number;
  y: number;
  placed: boolean;
};

export function controlsFromSnapshot(rows: { name: string; nominal: { toString(): string }; toleranceKind: string; upperDeviation: { toString(): string } | null; lowerDeviation: { toString(): string } | null; lowerLimit: { toString(): string }; upperLimit: { toString(): string }; frequency: number; markerX: { toString(): string } | null; markerY: { toString(): string } | null }[]): OrderControlRow[] {
  const parsed = rows.flatMap((row) => {
    const reference = row.name.slice(0, 1);
    if (!(drawingReferences as readonly string[]).includes(reference)) return [];
    const kind = isToleranceKind(row.toleranceKind) ? row.toleranceKind : "symmetric";
    const upper = row.upperDeviation?.toString() || bandFromLimits(row.upperLimit.toString(), row.lowerLimit.toString());
    const lower = row.lowerDeviation?.toString() || `-${bandFromLimits(row.upperLimit.toString(), row.lowerLimit.toString())}`;
    const tolerance = kind === "symmetric" ? absoluteText(upper) : "0";
    return [{
      reference,
      dimensionName: row.name.slice(2),
      nominal: row.nominal.toString(),
      toleranceKind: kind,
      tolerance,
      upperDeviation: absoluteText(upper),
      lowerDeviation: absoluteText(lower),
      frequency: row.frequency,
      x: Number(row.markerX?.toString() ?? 50),
      y: Number(row.markerY?.toString() ?? 50),
      placed: row.markerX != null && row.markerY != null,
    }];
  });
  return drawingReferences.map((reference, index) => parsed.find((row) => row.reference === reference) ?? {
    reference,
    dimensionName: reference,
    nominal: "0",
    toleranceKind: "symmetric",
    tolerance: "0",
    upperDeviation: "0",
    lowerDeviation: "0",
    frequency: 0,
    x: 20 + index * 12,
    y: 30,
    placed: false,
  });
}

function bandFromLimits(upper: string, lower: string) {
  const scale = Math.max(upper.split(".")[1]?.length ?? 0, lower.split(".")[1]?.length ?? 0);
  return Math.abs((Number(upper) - Number(lower)) / 2).toFixed(scale);
}

function absoluteText(value: string) {
  const text = value.trim().replace(",", ".").replace(/^-/, "");
  return text === "" || /^-?\d+(\.\d+)?$/.test(value.trim().replace(",", ".")) ? (text || "0") : "0";
}
