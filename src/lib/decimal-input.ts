export function decimalText(value: unknown): string {
  let text = String(value ?? "").trim().replace(",", ".");
  if (text.endsWith(".")) text = text.slice(0, -1);
  if (text === "" || text === "-" || text === ".") return "0";
  return /^-?\d+(\.\d+)?$/.test(text) ? text : "0";
}

export function decimalNumber(value: unknown): number {
  const parsed = Number(decimalText(value));
  return Number.isFinite(parsed) ? parsed : 0;
}
