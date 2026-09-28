export const toleranceKinds = ["symmetric", "bilateral", "H7", "H8", "h7", "js", "custom"] as const;

export type ToleranceKind = (typeof toleranceKinds)[number];

const it7: [number, number][] = [
  [3, 0.01], [6, 0.012], [10, 0.015], [18, 0.018], [30, 0.021], [50, 0.025],
  [80, 0.03], [120, 0.035], [180, 0.04], [250, 0.046], [315, 0.052], [400, 0.057], [500, 0.063],
];

const it8: [number, number][] = [
  [3, 0.014], [6, 0.018], [10, 0.022], [18, 0.027], [30, 0.033], [50, 0.039],
  [80, 0.046], [120, 0.054], [180, 0.063], [250, 0.072], [315, 0.081], [400, 0.089], [500, 0.097],
];

export function isToleranceKind(value: string): value is ToleranceKind {
  return (toleranceKinds as readonly string[]).includes(value);
}

export function fitDeviations(nominal: number, kind: ToleranceKind): { upper: number; lower: number } | null {
  const size = Math.abs(nominal);
  if (kind === "H7" || kind === "h7" || kind === "js") {
    const band = grade(size, it7);
    if (kind === "H7") return { upper: band, lower: 0 };
    if (kind === "h7") return { upper: 0, lower: -band };
    const half = band / 2;
    return { upper: half, lower: -half };
  }
  if (kind === "H8") {
    const band = grade(size, it8);
    return { upper: band, lower: 0 };
  }
  return null;
}

export function resolveLimits(input: {
  nominal: number;
  kind: ToleranceKind;
  tolerance: number;
  upperDeviation: number;
  lowerDeviation: number;
}) {
  const fit = fitDeviations(input.nominal, input.kind);
  if (fit) return { lower: input.nominal + fit.lower, upper: input.nominal + fit.upper, upperDeviation: fit.upper, lowerDeviation: fit.lower };
  if (input.kind === "symmetric") {
    const band = Math.abs(input.tolerance);
    return { lower: input.nominal - band, upper: input.nominal + band, upperDeviation: band, lowerDeviation: -band };
  }
  return {
    lower: input.nominal + input.lowerDeviation,
    upper: input.nominal + input.upperDeviation,
    upperDeviation: input.upperDeviation,
    lowerDeviation: input.lowerDeviation,
  };
}

function grade(size: number, table: [number, number][]) {
  return table.find(([limit]) => size <= limit)?.[1] ?? table[table.length - 1][1];
}
