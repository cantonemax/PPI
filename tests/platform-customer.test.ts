import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { companyDeleteDecision, companyLifecycle } from "@/lib/platform-customer";

describe("customer console", () => {
  it("deletes only after DELETE and with no active users or orders", () => {
    expect(companyDeleteDecision({ confirmation: "DELETE", activeUsers: 0, activeOrders: 0 })).toBe("ready");
    expect(companyDeleteDecision({ confirmation: "DELETE", activeUsers: 1, activeOrders: 0 })).toBe("blocked");
    expect(companyDeleteDecision({ confirmation: "DELETE", activeUsers: 0, activeOrders: 1 })).toBe("blocked");
    expect(companyDeleteDecision({ confirmation: "delete", activeUsers: 0, activeOrders: 0 })).toBe("unconfirmed");
    expect(companyDeleteDecision({ confirmation: "", activeUsers: 0, activeOrders: 0 })).toBe("unconfirmed");
  });

  it("marks a removed company as deleted before suspended", () => {
    expect(companyLifecycle({ deletedAt: new Date(), closedAt: new Date(), contractStatus: "ACTIVE" })).toBe("deleted");
    expect(companyLifecycle({ deletedAt: null, closedAt: new Date(), contractStatus: "ACTIVE" })).toBe("suspended");
    expect(companyLifecycle({ deletedAt: null, closedAt: null, contractStatus: "TRIAL" })).toBe("trial");
  });

  it("keeps the platform on the existing page", () => {
    const pages = platformPages("src/app/platform");
    expect(pages).toEqual([
      "src/app/platform/login/page.tsx",
      "src/app/platform/logo/[companyId]/route.ts",
      "src/app/platform/page.tsx",
    ]);
    const page = readFileSync("src/app/platform/page.tsx", "utf8");
    expect(page.includes("setup.operatorName")).toBe(false);
    expect(page.includes("platform.ownerName")).toBe(true);
    expect(page.includes("prisma.company.delete")).toBe(false);
    const actions = readFileSync("src/server/platform-actions.ts", "utf8");
    expect(actions.includes("company.delete(")).toBe(false);
    expect(actions.includes("deletedAt: new Date()")).toBe(true);
    expect(actions.includes("deletedAt: archived ? { not: null } : null")).toBe(true);
    const list = readFileSync("src/app/platform/company-list.tsx", "utf8");
    expect(list.includes("restoreCustomerCompany")).toBe(true);
    expect(page.includes("\"history\"")).toBe(true);
    const frame = readFileSync("src/app/platform/platform-frame.tsx", "utf8");
    expect(frame.includes("platform.nav.revenue")).toBe(true);
    expect(frame.includes("platform.nav.archive")).toBe(true);
    expect(frame.includes("signOutPlatform")).toBe(true);
    expect(frame.includes("M16 17l5-5-5-5")).toBe(true);
    expect(frame.includes("mt-auto")).toBe(true);
  });
});

function platformPages(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return platformPages(path);
    return path.endsWith("page.tsx") || path.endsWith("route.ts") ? [path.replaceAll("\\", "/")] : [];
  }).sort();
}
