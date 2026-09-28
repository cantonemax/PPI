export const toolFamilies = ["drill", "insert", "millingCutter", "reamer", "tap", "die", "boring", "special"] as const;

export type ToolFamily = (typeof toolFamilies)[number];

export function isToolFamily(value: string): value is ToolFamily {
  return (toolFamilies as readonly string[]).includes(value);
}
