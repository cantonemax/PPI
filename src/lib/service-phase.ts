const pausedPrefixes = [
  "/dashboard/copilot",
  "/dashboard/materials",
  "/dashboard/tools",
  "/dashboard/users",
  "/dashboard/settings",
  "/dashboard/quality/certifications",
];

export const timeControlsPaused = true;
export const deliveryPaused = true;
export const comparisonPaused = true;

export function isServicePaused(path: string) {
  return pausedPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}
