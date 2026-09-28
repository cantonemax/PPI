export const drawingReferences = ["A", "B", "C", "D", "E"] as const;

export type DrawingReference = (typeof drawingReferences)[number];

export type DrawingMarker = {
  reference: DrawingReference;
  x: number;
  y: number;
};

export const defaultDrawingMarkers: DrawingMarker[] = [
  { reference: "A", x: 58, y: 26 },
  { reference: "B", x: 38, y: 48 },
  { reference: "C", x: 68, y: 48 },
  { reference: "D", x: 32, y: 68 },
  { reference: "E", x: 74, y: 66 },
];

export function loadDrawingMarkers(jobCode: string): DrawingMarker[] | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(storageKey(jobCode));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as DrawingMarker[];
    if (!Array.isArray(parsed)) return null;
    return drawingReferences.map((reference) => {
      const found = parsed.find((item) => item.reference === reference);
      const fallback = defaultDrawingMarkers.find((item) => item.reference === reference)!;
      if (!found || !Number.isFinite(found.x) || !Number.isFinite(found.y)) return fallback;
      return { reference, x: found.x, y: found.y };
    });
  } catch {
    return null;
  }
}

export function saveDrawingMarkers(jobCode: string, markers: DrawingMarker[]) {
  window.localStorage.setItem(storageKey(jobCode), JSON.stringify(markers));
}

function storageKey(jobCode: string) {
  return `ppi.drawing-references.${jobCode}`;
}
