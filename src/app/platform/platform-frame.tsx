"use client";

import { useEffect, useState } from "react";
import { DatePill, SessionIdentity } from "@/app/dashboard/session-mark";
import { t } from "@/lib/i18n";
import { signOutPlatform } from "@/server/platform-actions";

const nav = [
  { href: "/platform", key: "platform.nav.companies", icon: "settings", id: "companies" },
  { href: "/platform?new=1", key: "platform.nav.create", icon: "people", id: "create" },
  { href: "/platform?view=revenue", key: "platform.nav.revenue", icon: "chart", id: "revenue" },
  { href: "/platform?archive=1", key: "platform.nav.archive", icon: "archive", id: "archive" },
  { href: "/platform?view=plans", key: "platform.nav.plans", icon: "plans", id: "plans" },
];

export function PlatformFrame({
  title,
  today,
  person,
  children,
}: {
  title: string;
  today: string;
  person: { name: string; role: string };
  children: React.ReactNode;
}) {
  const [current, setCurrent] = useState("companies");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("view") === "revenue") setCurrent("revenue");
    else if (params.get("view") === "plans") setCurrent("plans");
    else if (params.get("archive") === "1") setCurrent("archive");
    else if (params.get("new") === "1") setCurrent("create");
    else setCurrent("companies");
  }, []);

  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-[#040b16] font-sans text-slate-100">
      <span className="pointer-events-none absolute left-[10%] top-0 h-[420px] w-[720px] -translate-y-1/3 rounded-full bg-cyan-300/10 blur-3xl" />
      <aside className="fixed inset-y-0 left-0 z-20 flex w-16 flex-col border-r border-white/[0.06] bg-[#08141f]/75 shadow-[4px_0_28px_rgba(0,0,0,0.18)] backdrop-blur min-[1280px]:w-[300px]">
        <BrandLogo />
        <div className="hidden px-4 pb-3 min-[1280px]:block">
          <SessionIdentity name={person.name} role={person.role} align="center" />
        </div>
        <div className="mx-4 hidden border-t border-white/10 min-[1280px]:block" />
        <nav className="flex flex-col gap-0.5 px-2 pt-3">
          {nav.map((item) => (
            <a key={item.key} href={item.href} title={t(item.key)} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] tracking-wide transition ${item.id === current ? "bg-cyan-400/10 text-white shadow-[inset_0_0_0_1px_rgba(60,240,255,0.25)]" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"}`}>
              <Icon name={item.icon} className="h-10 w-10" />
              <span className="hidden min-[1280px]:inline">{t(item.key)}</span>
            </a>
          ))}
        </nav>
        <div className="mt-auto shrink-0 border-t border-white/10 px-2 py-3">
          <form action={signOutPlatform}>
            <button type="submit" aria-label={t("auth.signOut")} title={t("auth.signOut")} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] tracking-wide text-slate-400 transition hover:bg-white/[0.04] hover:text-slate-100">
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
                <LogoutIcon />
              </span>
              <span className="hidden min-[1280px]:inline">{t("auth.signOut")}</span>
            </button>
          </form>
        </div>
      </aside>
      <div className="pl-16 min-[1280px]:pl-[300px]">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-400/10 px-4 py-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-cyan-300">{t("dashboard.today")}</p>
            <h1 className="text-[26px] font-medium text-white">{title}</h1>
          </div>
          <DatePill today={today} />
        </header>
        {children}
      </div>
    </div>
  );
}

function BrandLogo() {
  return (
    <div className="relative flex h-[152px] items-center justify-center px-4">
      <span className="pointer-events-none absolute inset-x-6 top-6 h-16 rounded-full bg-cyan-300/20 blur-2xl" />
      <img src="/brand/ppi-logo.png" alt={t("product.name")} className="relative z-10 h-auto w-full object-contain mix-blend-screen drop-shadow-[0_0_18px_rgba(60,240,255,0.35)]" />
    </div>
  );
}

function LogoutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

function Icon({ name, className = "h-6 w-6" }: { name: string; className?: string }) {
  const frame = `${className} shrink-0 object-contain`;
  const artwork: Record<string, string> = {
    home: "/brand/nav/dashboard.png",
    settings: "/brand/nav/settings.png",
  };
  if (name === "chart") {
    return (
      <svg viewBox="0 0 24 24" className={frame} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M4 19h16" />
        <path d="M6 16l4-5 3 3 5-7" />
      </svg>
    );
  }
  if (name === "plans") {
    return (
      <svg viewBox="0 0 24 24" className={frame} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M5 6h14M5 12h14M5 18h8" />
      </svg>
    );
  }
  if (name === "archive") {
    return (
      <svg viewBox="0 0 24 24" className={frame} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M4 7h16v12H4z" />
        <path d="M8 7V5h8v2" />
      </svg>
    );
  }
  if (artwork[name]) return <img src={artwork[name]} alt="" className={frame} />;
  return (
    <svg viewBox="0 0 24 24" className={frame} fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12 12 A3 3 0 1 0 12 6 A3 3 0 1 0 12 12 M6 20 C6 16 18 16 18 20" />
    </svg>
  );
}
