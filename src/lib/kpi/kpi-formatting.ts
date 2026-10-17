function finite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function formatPercent(value: number | null | undefined): string | null {
  if (!finite(value)) return null;
  return `${value.toFixed(1)}%`;
}

export function formatCapability(value: number | null | undefined): string | null {
  if (!finite(value)) return null;
  return value.toFixed(2);
}

export function formatQualityScore(value: number | null | undefined): string | null {
  if (!finite(value)) return null;
  return String(Math.round(value));
}

export function formatDepartmentScore(value: number | null | undefined): string | null {
  if (!finite(value)) return null;
  return String(Math.round(value));
}

export function formatCount(value: number | null | undefined): string | null {
  if (!finite(value)) return null;
  return String(Math.round(value));
}

export function formatCurrency(value: number | null | undefined): string | null {
  if (!finite(value)) return null;
  const negative = value < 0;
  const [whole, fraction] = Math.abs(value).toFixed(2).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}€ ${grouped}.${fraction}`;
}
