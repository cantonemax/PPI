"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FloorClock } from "@/app/dashboard/operator/floor-clock";
import { t } from "@/lib/i18n";
import { isServicePaused } from "@/lib/service-phase";
import { signOut } from "@/server/auth-actions";

export function DashboardChrome({
  companyName,
  appearance,
  brand,
  owner,
  planner,
  floor,
  quality,
  operatorOnly,
  thresholds: _thresholds,
  today,
  personName,
  personRole,
  children,
}: {
  companyName: string;
  appearance: "dark" | "floor";
  brand: React.ReactNode;
  owner: boolean;
  planner: boolean;
  floor: boolean;
  quality: boolean;
  operatorOnly: boolean;
  thresholds: boolean;
  today: string;
  personName: string;
  personRole: string;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const operatorDesk = path.startsWith("/dashboard/operator/orders");
  const floorScreen = path.startsWith("/dashboard/operator") && !operatorDesk;
  const paused = isServicePaused(path);
  const ordersScreen = path === "/dashboard/orders" || path.startsWith("/dashboard/orders/");
  if (operatorDesk || ordersScreen || path.startsWith("/dashboard/company") || path.startsWith("/dashboard/floor") || (!paused && owner && (path === "/dashboard" || path.startsWith("/dashboard/process") || path.startsWith("/dashboard/copilot") || path.startsWith("/dashboard/settings")))) {
    return <div data-appearance={appearance} className="min-h-dvh bg-[var(--ppi-canvas,#040b16)] text-slate-100">{children}</div>;
  }

  if (floorScreen) {
    return (
      <div data-appearance={appearance} className="ppi-screen bg-stone-300 text-stone-950" style={{ ["--ppi-slogan" as string]: "#1e40af" }}>
        <header className="grid h-16 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-stone-500 bg-stone-300 px-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0">{brand}</div>
            <div id="ppi-siren-slot" className="flex min-w-0 flex-1 items-center justify-center" />
          </div>
          <div className="flex items-center gap-3">
            <div id="ppi-report-slot" />
            <FloorClock />
            <div id="ppi-reset-slot" />
          </div>
          <div className="flex items-center justify-end gap-2">
            <p className="rounded-full border border-stone-500 bg-stone-200 px-3 py-1 text-[13px]">{today}</p>
            <Link href="/dashboard/operator/orders" className="rounded-full bg-blue-800 px-4 py-2 text-[13px] font-medium text-white">{t("operator.orders")}</Link>
            <form action={signOut}>
              <button className="px-3 text-[13px]">{t("auth.signOut")}</button>
            </form>
          </div>
        </header>
        <div className="ppi-screen-body px-4 pb-4">{children}</div>
      </div>
    );
  }

  return (
    <div data-appearance={appearance} className="min-h-screen">
      <header className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
        <div>
          <p className="text-sm text-stone-500">{t("product.name")}</p>
          <p className="text-lg">{companyName}</p>
          {brand}
          {personName ? <p className="text-sm">{personName}</p> : null}
          <p className="text-sm text-stone-500">{personRole}</p>
        </div>
        <div className="flex items-center gap-4">
          <p className="rounded-full border border-stone-300 px-3 py-1 text-[13px]">{today}</p>
          <nav className="flex items-center gap-4 text-sm">
          {operatorOnly ? null : <Link href="/dashboard">{t("nav.dashboard")}</Link>}
          {floor ? <Link href="/dashboard/operator">{t("nav.operator")}</Link> : null}
          {planner ? <Link href="/dashboard/parts">{t("nav.parts")}</Link> : null}
          {planner ? <Link href="/dashboard/orders">{t("nav.orders")}</Link> : null}
          {quality ? <Link href="/dashboard/quality">{t("nav.quality")}</Link> : null}
          <form action={signOut}>
            <button className="min-h-12 border border-stone-300 px-3">{t("auth.signOut")}</button>
          </form>
          </nav>
        </div>
      </header>
      <div className="px-6 py-8">{children}</div>
    </div>
  );
}
