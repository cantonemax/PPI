import { defaultDrawingMarkers, drawingReferences, type DrawingMarker, type DrawingReference } from "@/lib/drawing-references";
import { isToleranceKind, resolveLimits, type ToleranceKind } from "@/lib/tolerance";

export const partFamilies = ["bolt", "screw", "pin", "bushing", "washer", "shaft", "bracket", "flange", "special"] as const;

export type PartFamily = (typeof partFamilies)[number];

export type TemplateDimension = {
  reference: DrawingReference;
  nameKey: string;
  nominal: number;
  tolerance: number;
  frequency: number;
  x: number;
  y: number;
};

export type ArticleSpecification = {
  reference: DrawingReference;
  dimensionName: string;
  nominal: number;
  tolerance: number;
  toleranceKind: ToleranceKind;
  upperDeviation: number;
  lowerDeviation: number;
  frequency: number;
  x: number;
  y: number;
  enabled: boolean;
};

const templates: Record<Exclude<PartFamily, "special">, TemplateDimension[]> = {
  bolt: rows("bolt", [10, 0.05, 10], [40, 0.2, 20], [6.4, 0.15, 20], [17, 0.2, 50], [0.5, 0.1, 100], ["diameter", "length", "head", "wrench", "radius"]),
  screw: rows("screw", [6, 0.05, 10], [30, 0.2, 20], [4, 0.1, 20], [10, 0.15, 50], [1, 0.05, 100], ["diameter", "length", "head", "wrench", "pitch"], 4, 2),
  pin: rows("pin", [12, 0.02, 10], [80, 0.2, 20], [2, 0.05, 20], [1, 0.1, 50], [8, 0.02, 50], ["diameter", "length", "groove", "chamfer", "secondDiameter"], -3, 4),
  bushing: rows("bushing", [20, 0.02, 10], [14, 0.02, 10], [25, 0.1, 20], [0.5, 0.1, 50], [1.6, 0.4, 100], ["outsideDiameter", "insideDiameter", "length", "chamfer", "roughness"], 2, -4),
  washer: rows("washer", [16, 0.2, 20], [8.4, 0.15, 20], [1.6, 0.1, 10], [0.2, 0.1, 50], [0.3, 0.1, 100], ["outsideDiameter", "insideDiameter", "thickness", "chamfer", "coaxiality"], 6, 0),
  shaft: rows("shaft", [25, 0.01, 5], [120, 0.2, 10], [18, 0.02, 10], [6, 0.02, 20], [0.8, 0.2, 50], ["diameter", "length", "secondDiameter", "fit", "roughness"], -6, 3),
  bracket: rows("bracket", [80, 0.2, 10], [40, 0.15, 10], [25, 0.1, 20], [8, 0.1, 20], [3, 0.2, 50], ["length", "width", "height", "hole", "radius"], 0, 6),
  flange: rows("flange", [100, 0.2, 10], [60, 0.1, 10], [12, 0.15, 20], [9, 0.15, 20], [80, 0.2, 50], ["outsideDiameter", "insideDiameter", "thickness", "hole", "pitch"], 3, -2),
};

export function isPartFamily(value: string): value is PartFamily {
  return (partFamilies as readonly string[]).includes(value);
}

export function familyTemplate(family: PartFamily): TemplateDimension[] | null {
  if (family === "special") return null;
  return templates[family];
}

export function blankSpecification(): ArticleSpecification[] {
  return drawingReferences.map((reference, index) => ({
    reference,
    dimensionName: "",
    nominal: 0,
    tolerance: 0,
    toleranceKind: "symmetric",
    upperDeviation: 0,
    lowerDeviation: 0,
    frequency: 0,
    x: defaultDrawingMarkers[index]?.x ?? 50,
    y: defaultDrawingMarkers[index]?.y ?? 50,
    enabled: false,
  }));
}

export function readSpecifications(value: FormDataEntryValue | null): ArticleSpecification[] {
  if (typeof value !== "string" || value.trim() === "") return [];
  try {
    const parsed = JSON.parse(value) as ArticleSpecification[];
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!(drawingReferences as readonly string[]).includes(item.reference)) return [];
      const nominal = numberOrZero(item.nominal);
      const tolerance = Math.abs(numberOrZero(item.tolerance));
      const kind = isToleranceKind(String(item.toleranceKind ?? "")) ? item.toleranceKind : "symmetric";
      const frequency = Math.max(0, Math.round(numberOrZero(item.frequency)));
      return [{
        reference: item.reference,
        dimensionName: String(item.dimensionName ?? "").trim(),
        nominal,
        tolerance,
        toleranceKind: kind,
        upperDeviation: numberOrZero(item.upperDeviation),
        lowerDeviation: numberOrZero(item.lowerDeviation),
        frequency,
        x: clamp(numberOrZero(item.x)),
        y: clamp(numberOrZero(item.y)),
        enabled: item.enabled !== false && String(item.dimensionName ?? "").trim() !== "",
      }];
    });
  } catch {
    return [];
  }
}

export function limits(nominal: number, tolerance: number) {
  return resolveLimits({ nominal, kind: "symmetric", tolerance, upperDeviation: tolerance, lowerDeviation: -tolerance });
}

function rows(
  family: string,
  a: [number, number, number],
  b: [number, number, number],
  c: [number, number, number],
  d: [number, number, number],
  e: [number, number, number],
  names: string[],
  dx = 0,
  dy = 0,
): TemplateDimension[] {
  const values = [a, b, c, d, e];
  return drawingReferences.map((reference, index) => {
    const marker = defaultDrawingMarkers[index];
    const value = values[index];
    return {
      reference,
      nameKey: `part.dimension.${family}.${names[index]}`,
      nominal: value[0],
      tolerance: value[1],
      frequency: value[2],
      x: clamp((marker?.x ?? 50) + dx),
      y: clamp((marker?.y ?? 50) + dy),
    };
  });
}

function numberOrZero(value: unknown) {
  const text = String(value ?? "").trim().replace(",", ".");
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clamp(value: number) {
  return Math.min(90, Math.max(8, value));
}

export type { DrawingMarker, DrawingReference };
