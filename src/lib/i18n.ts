import messages from "@/messages/it.json";

const catalog = messages as Record<string, string>;

export function t(key: string): string {
  return catalog[key] ?? key;
}
