"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";
import { companyLifecycle } from "@/lib/platform-customer";
import { createPilotCompany, restoreCustomerCompany, setCompanyActive } from "@/server/platform-actions";

const shell = "rounded-2xl border border-white/10 bg-[#0b1830]/75 shadow-[0_16px_40px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.07),0_0_24px_rgba(60,240,255,0.05)] backdrop-blur";
const field = "mt-1 block w-full rounded-lg border border-white/15 bg-[#040b16] px-3 py-2 text-slate-100";
const action = "rounded-lg bg-cyan-400/15 px-4 py-2 text-[13px] text-cyan-100 shadow-[inset_0_0_0_1px_rgba(60,240,255,0.35)]";
const cardBtn = "inline-flex h-7 w-[100px] shrink-0 items-center justify-center whitespace-nowrap rounded-lg text-[12px]";
const cardOpen = `${cardBtn} bg-cyan-400/15 text-cyan-100 shadow-[inset_0_0_0_1px_rgba(60,240,255,0.45)]`;
const cardEdit = `${cardBtn} border border-white/20 text-slate-100`;
const cardSuspend = `${cardBtn} border border-amber-300/70 text-amber-200`;
const cardDelete = `${cardBtn} border border-[#FF4D4F]/60 text-[#FF4D4F]`;
const planTone: Record<string, string> = {
  FREE: "#2563eb",
  CORE: "#22d3ee",
  PROFESSIONAL: "#7c3aed",
  ENTERPRISE: "#eab308",
};
const statusTone: Record<string, string> = {
  active: "#16a34a",
  trial: "#22d3ee",
  suspended: "#f97316",
  expired: "#dc2626",
  deleted: "#dc2626",
};
const filters = [
  { id: "ALL", label: "platform.filter.all", color: "#16a34a" },
  { id: "FREE", label: "FREE", color: "#2563eb" },
  { id: "CORE", label: "CORE", color: "#22d3ee" },
  { id: "PROFESSIONAL", label: "PROFESSIONAL", color: "#7c3aed" },
  { id: "ENTERPRISE", label: "ENTERPRISE", color: "#eab308" },
] as const;

export type CompanyListItem = {
  id: string;
  name: string;
  plan: string;
  contractStatus: "TRIAL" | "ACTIVE" | "SUSPENDED" | "EXPIRED";
  closedAt: string | null;
  deletedAt: string | null;
  activatedAt: string | null;
  renewalAt: string | null;
  ownerNames: string;
};

function planColor(name: string) {
  return planTone[name.trim().toUpperCase()] ?? "#94a3b8";
}

function filterInk(color: string) {
  return color === "#eab308" || color === "#22d3ee" ? "#041018" : "#f8fafc";
}

function dateLabel(value: string | null) {
  if (!value) return t("platform.usage.unavailable");
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}

export function CompanyList({ companies, archived, creating, error }: { companies: CompanyListItem[]; archived: boolean; creating: boolean; error?: string }) {
  const [plan, setPlan] = useState<(typeof filters)[number]["id"] | null>(null);
  const visible = !plan || plan === "ALL" ? companies : companies.filter((company) => company.plan.trim().toUpperCase() === plan);
  return (
    <div className="grid gap-3 px-3 py-3">
      <div className="flex min-w-0 items-center gap-2">
        <h2 className="shrink-0 text-[12px] uppercase tracking-[0.16em] text-slate-400">{t(archived ? "platform.archive.title" : "platform.nav.companies")}</h2>
        <div className="flex min-w-0 flex-1 flex-nowrap gap-1.5 overflow-x-auto py-0.5">
          {filters.map((item) => {
            const selected = plan === item.id;
            const count = item.id === "ALL" ? companies.length : companies.filter((company) => company.plan.trim().toUpperCase() === item.id).length;
            const label = item.id === "ALL" ? t(item.label) : item.label;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setPlan(item.id)}
                className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.08em] ${selected ? "border-2" : "border"}`}
                style={selected
                  ? { backgroundColor: item.color, color: filterInk(item.color), borderColor: item.color, boxShadow: `0 0 14px ${item.color}73` }
                  : { backgroundColor: "transparent", color: item.color, borderColor: item.color, boxShadow: "none" }}
              >
                {`${label} ${count}`}
              </button>
            );
          })}
        </div>
        {archived ? null : <a href="/platform?new=1" className={`${action} shrink-0`}>{`+ ${t("platform.newCompany")}`}</a>}
      </div>
      {creating ? (
        <section className={`${shell} p-3`}>
          <h2 className="text-[12px] uppercase tracking-[0.16em] text-slate-400">{t("platform.create")}</h2>
          <form action={createPilotCompany} className="mt-3 grid gap-3 min-[800px]:grid-cols-[minmax(0,1fr)_auto] min-[800px]:items-end">
            <label className="text-[12px] uppercase tracking-[0.12em] text-slate-400">{t("platform.name")}<input name="name" required className={field} /></label>
            <button className={action}>{t("platform.create")}</button>
          </form>
        </section>
      ) : null}
      {error ? <p className="text-[13px] text-[#FF4D4F]">{t(error)}</p> : null}
      {companies.length === 0 ? <p className={`${shell} px-3 py-8 text-center text-[13px] text-slate-400`}>{t(archived ? "platform.archive.empty" : "platform.empty")}</p> : null}
      {companies.length > 0 && visible.length === 0 ? <p className={`${shell} px-3 py-8 text-center text-[13px] text-slate-400`}>{t("platform.filter.empty")}</p> : null}
      <section className="grid grid-cols-1 gap-3 min-[760px]:grid-cols-2">
        {visible.map((company) => <CompanyCard key={company.id} company={company} archived={archived} />)}
      </section>
    </div>
  );
}

function CompanyCard({ company, archived = false }: { company: CompanyListItem; archived?: boolean }) {
  const status = companyLifecycle({
    deletedAt: company.deletedAt ? new Date(company.deletedAt) : null,
    closedAt: company.closedAt ? new Date(company.closedAt) : null,
    contractStatus: company.contractStatus,
  });
  const tone = planColor(company.plan);
  const ink = tone === "#eab308" || tone === "#22d3ee" ? "#041018" : "#f8fafc";
  return (
    <article className={`${shell} flex min-w-0 flex-col gap-3 border-l-4 p-3 min-[760px]:flex-row min-[760px]:items-stretch min-[760px]:gap-5`} style={{ borderLeftColor: tone }}>
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <p className="truncate text-[18px] font-medium text-white">{company.name}</p>
        <dl className="mt-2 grid grid-cols-[max-content_minmax(0,1fr)] items-baseline gap-x-3 gap-y-[11px] text-[13px] text-slate-300">
          <dt className="whitespace-nowrap text-[11px] uppercase tracking-[0.08em] text-slate-500">{t("platform.owner")}</dt>
          <dd className="truncate">{company.ownerNames || t("platform.ownerMissing")}</dd>
          <dt className="whitespace-nowrap text-[11px] uppercase tracking-[0.08em] text-slate-500">{t("platform.field.activation")}</dt>
          <dd className="truncate">{dateLabel(company.activatedAt)}</dd>
          <dt className="whitespace-nowrap text-[11px] uppercase tracking-[0.08em] text-slate-500">{t("platform.field.renewal")}</dt>
          <dd className="truncate">{dateLabel(company.renewalAt)}</dd>
        </dl>
      </div>
      <div className="flex w-[132px] shrink-0 flex-col items-center justify-center gap-1.5 self-center">
        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.08em]" style={{ backgroundColor: tone, color: ink }}>{company.plan}</span>
        <p className="w-full text-center text-[12px] font-medium uppercase tracking-[0.14em]" style={{ color: statusTone[status] }}>{t(`platform.status.${status}`)}</p>
      </div>
      <div className="flex w-[100px] shrink-0 flex-col items-center justify-center gap-1.5 self-end min-[760px]:self-center">
        <a href={`/platform?company=${company.id}`} className={cardOpen}>{t("platform.open")}</a>
        {archived ? (
          <form action={restoreCustomerCompany}>
            <input type="hidden" name="companyId" value={company.id} />
            <button className={cardEdit}>{t("platform.restore")}</button>
          </form>
        ) : (
          <>
            <a href={`/platform?company=${company.id}&tab=company`} className={cardEdit}>{t("platform.edit")}</a>
            <form action={setCompanyActive}>
              <input type="hidden" name="companyId" value={company.id} />
              <input type="hidden" name="active" value={company.closedAt ? "1" : "0"} />
              <button className={cardSuspend}>{company.closedAt ? t("platform.activate") : t("platform.suspend")}</button>
            </form>
            <a href={`/platform?company=${company.id}&tab=delete`} className={cardDelete}>{t("platform.delete")}</a>
          </>
        )}
      </div>
    </article>
  );
}
