import Link from "next/link";
import { CompanyBrand } from "@/app/dashboard/company-mark";
import { DatePill, SessionIdentity } from "@/app/dashboard/session-mark";
import { t } from "@/lib/i18n";
import { isServicePaused } from "@/lib/service-phase";
import type { CopilotSignal } from "@/lib/copilot";
import { DepartmentGauge } from "@/app/dashboard/gauge-visual";
import { InfoTip } from "@/app/dashboard/info-tip";
import { interpretQuality, qualityPercentFromCpk, type QualityState } from "@/lib/quality-evaluation";

type Mosaic = {
  orders: number;
  criticalOrders: number;
  criticalSignals: number;
  quality: string | null;
  qualityTarget: number | null;
  qualityWarning: number | null;
  qualityDelta: number | null;
  scrap: string | null;
  scrapRiskSeries: number[];
  scrapProduced: number | null;
  scrapPieces: number | null;
  machines: number;
  efficiency: { percent: number | null; ratio: number | null; actual: number | null; estimated: number | null };
  timeUnit: "MINUTE" | "HOUR";
  efficiencySeries: number[];
  toolTrend: number[];
  materialTrend: number[];
  deliveryTrend: number[];
  tools: number;
  toolActive: number;
  toolReplaced: number;
  toolRisk: number;
  toolQuantity: number | null;
  materialQuantity: number | null;
  materialRemaining: number;
  materialUsed: number;
  materialUnit: string;
  materialCoverage: number | null;
  delivery: { percent: number; band: "high" | "moderate" | "low"; days: number; eta: Date } | null;
  waiting: number;
  completedToday: number;
  operators: number;
  productionTrend: number[];
  scrapTrend: number[];
};

const nav = [
  { href: "/dashboard", key: "nav.dashboard", icon: "home" },
  { href: "/dashboard/floor", key: "nav.operator", icon: "floor" },
  { href: "/dashboard/orders", key: "nav.orders", icon: "orders" },
  { href: "/dashboard/copilot", key: "nav.copilot", icon: "pulse" },
  { href: "/dashboard/quality", key: "nav.quality", icon: "check" },
  { href: "/dashboard/quality/certifications", key: "nav.certifications", icon: "file" },
  { href: "/dashboard/materials", key: "nav.materials", icon: "box" },
  { href: "/dashboard/tools", key: "nav.tools", icon: "tool" },
  { href: "/dashboard/machines", key: "nav.machines", icon: "machine" },
  { href: "/dashboard/users", key: "nav.users", icon: "people" },
  { href: "/dashboard/company", key: "nav.companySettings", icon: "settings" },
];

function processSummary(signals: CopilotSignal[]) {
  const rows = [
    [t("process.summary.quality"), signals.filter((signal) => signal.kind === "quality").length],
    [t("process.summary.tool"), signals.filter((signal) => signal.kind === "tooling").length],
    [t("process.summary.efficiency"), signals.filter((signal) => signal.kind === "production").length],
    [t("process.summary.material"), signals.filter((signal) => signal.code === "materialSuggestion").length],
  ].filter((row) => Number(row[1]) > 0);
  if (rows.length === 0) return t("process.normal");
  return rows.map((row) => `${row[1]} ${row[0]}`).join(" · ");
}

export function OwnerHome({
  companyName,
  today,
  person,
  signals,
  certifications,
  qualityPoints,
  mosaic,
  department,
}: {
  companyName: string;
  today: string;
  person: { name: string; role: string };
  signals: CopilotSignal[];
  certifications: number;
  qualityPoints: number[];
  mosaic: Mosaic;
  department: { id: string; name: string; score: number | null }[];
}) {
  const critical = signals.filter((signal) => signal.severity === "critical");
  const warning = signals.filter((signal) => signal.severity === "warning");
  const status = critical.length > 0 ? "critical" : warning.length > 0 ? "attention" : "safe";
  const tone = paint(status);
  const ranked = [...critical, ...warning, ...signals.filter((signal) => signal.severity === "info")].slice(0, 5);

  return (
    <OwnerFrame companyName={companyName} today={today} person={person} activeHref="/dashboard">
        <div className="grid gap-3 px-3 py-3 min-[1440px]:grid-cols-[minmax(0,1fr)_300px]">
          <div className="grid gap-3">
            <section className={`${shell} grid h-[320px] grid-cols-[minmax(180px,300px)_repeat(6,minmax(0,1fr))] gap-2 p-3`}>
              <div className="relative h-[280px] overflow-hidden rounded-xl border border-white/15 bg-[#050d18] shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_18px_50px_rgba(0,0,0,0.45),0_0_42px_rgba(60,240,255,0.14)]">
                <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_0%,rgba(60,240,255,0.2),transparent_46%)]" style={{ animation: "ppi-glow 4.5s ease-in-out infinite" }} />
                <span className="pointer-events-none absolute -left-8 bottom-0 h-28 w-40 rounded-full blur-3xl" style={{ background: tone.wash }} />
                <InfoTip title={t("dashboard.process")} text={t("dashboard.hint.process")} />
                <Link href="/dashboard/process" className="relative flex h-full flex-col justify-between p-3">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-cyan-300/80">{t("dashboard.process")}</p>
                    <p className="mt-3 flex items-center gap-3 text-[36px] font-semibold uppercase leading-none tracking-[0.06em]" style={{ color: tone.hex, textShadow: `0 0 24px ${tone.hex}` }}>
                      <StatusMark color={tone.hex} />
                      {status === "critical" ? t("dashboard.processWord.critical") : status === "attention" ? t("dashboard.processWord.attention") : t("dashboard.processWord.stable")}
                    </p>
                    <p className="mt-3 text-[12px] font-medium uppercase tracking-[0.08em] text-slate-200">{processSummary(signals)}</p>
                  </div>
                  <p className="text-[13px] font-semibold uppercase tracking-[0.14em]" style={{ color: tone.hex }}>{status === "critical" ? t("process.trend.degrading") : t("process.trend.stable")}</p>
                  <p className="text-[11px] uppercase tracking-[0.08em] text-slate-400">{`${mosaic.machines} ${t("process.machinesOrders")} · ${mosaic.orders} ${t("process.ordersWord")}`}</p>
                </Link>
              </div>
              <Tile hint={t("dashboard.hint.quality")} label={t("dashboard.slot.quality")} value={qualityScore(mosaic.quality)} status={qualityOperationalStatus(mosaic.quality, mosaic.qualityTarget, mosaic.qualityWarning, mosaic.qualityDelta)} tone={qualityOperationalTone(mosaic.quality, mosaic.qualityTarget, mosaic.qualityWarning, mosaic.qualityDelta)} points={qualityPoints} note={qualityNote(mosaic.quality, mosaic.qualityTarget, mosaic.qualityWarning, mosaic.qualityDelta)} ring={qualityRing(mosaic.quality)} />
              <Tile hint={t("dashboard.hint.scrap")} label={t("dashboard.slot.scrap")} value={mosaic.scrap ?? t("dashboard.noData")} status={scrapStatus(signals)} tone={scrapTone(signals)} points={mosaic.scrapRiskSeries} gauge={gaugeOf(mosaic.scrap)} note={scrapNote(mosaic.scrapProduced, mosaic.scrapPieces)} ring={riskRing(gaugeOf(mosaic.scrap))} />
              <Tile hint={t("dashboard.hint.efficiency")} label={t("dashboard.slot.production")} value={efficiencyPrimary(mosaic.efficiency)} status={efficiencyStatus(mosaic.efficiency.ratio)} tone={efficiencyTone(mosaic.efficiency.ratio)} note={efficiencyNote(mosaic.efficiency, mosaic.timeUnit)} points={mosaic.efficiencySeries} ring={efficiencyRing(mosaic.efficiency.percent)} />
              <Tile hint={t("dashboard.hint.tools")} label={t("dashboard.slot.tools")} value={String(mosaic.tools)} status={toolStatus(signals, mosaic.tools)} tone={toolTone(signals, mosaic.tools)} points={mosaic.toolTrend} note={toolNote(mosaic.toolActive, mosaic.toolReplaced)} ring={riskRing(mosaic.toolRisk)} />
              <Tile hint={t("dashboard.hint.materials")} label={t("dashboard.slot.materials")} value={mosaic.materialCoverage === null ? t("dashboard.noData") : `${Math.round(mosaic.materialCoverage)}%`} status={materialStatus(signals)} tone={materialTone(signals)} points={mosaic.materialTrend} relative note={materialNote(mosaic.materialRemaining, mosaic.materialUsed, mosaic.materialUnit)} ring={coverageRing(mosaic.materialCoverage)} />
              <Tile hint={t("dashboard.hint.delivery")} label={t("dashboard.slot.delivery")} value={mosaic.delivery === null ? t("dashboard.noData") : `${mosaic.delivery.percent}%`} status={mosaic.delivery === null ? t("dashboard.kpi.empty") : t(`dashboard.kpiLabel.delivery.${mosaic.delivery.band === "high" ? "high" : mosaic.delivery.band === "moderate" ? "moderate" : "low"}`)} tone={mosaic.delivery === null ? "monitor" : mosaic.delivery.band === "high" ? "good" : mosaic.delivery.band === "moderate" ? "moderate" : "severe"} points={mosaic.delivery === null ? [] : mosaic.deliveryTrend} note={deliveryNote(mosaic.delivery)} ring={mosaic.delivery === null ? null : riskRing(mosaic.delivery.percent)} />
            </section>
            <DepartmentGauge machines={department} />
            <section className="grid grid-cols-3 gap-3">
              <Trend title={t("dashboard.trend.production")} points={mosaic.productionTrend} />
              <Trend title={t("dashboard.trend.quality")} points={qualityPoints} />
              <Trend title={t("dashboard.trend.scrap")} points={mosaic.scrapTrend} />
            </section>
            <section className="grid grid-cols-3 gap-3">
              <Summary title={t("nav.materials")} value={mosaic.materialQuantity === null ? t("dashboard.noData") : String(mosaic.materialQuantity)} hint={t("dashboard.materialsUse")} href="/dashboard/materials" donut="#3cf0ff" />
              <Summary title={t("nav.tools")} value={mosaic.toolQuantity === null ? t("dashboard.noData") : String(mosaic.toolQuantity)} hint={t("dashboard.toolsUse")} href="/dashboard/tools" donut="#7cf6ff" />
              <Summary title={t("dashboard.certs")} value={String(certifications)} hint={t("documents.certifications")} href="/dashboard/quality/certifications" />
            </section>
          </div>
          <aside className="grid content-start gap-3">
            <section id="alerts" className={`${shell} p-3`}>
              <h2 className="text-[12px] uppercase tracking-[0.16em] text-slate-400">{t("dashboard.alerts")}</h2>
              {ranked.length === 0 ? <p className="mt-4 text-center text-[13px] text-slate-400">{t("dashboard.alertsNone")}</p> : (
                <ul className="mt-2 flex flex-col gap-2">
                  {ranked.map((signal) => (
                    <li key={`${signal.orderId}-${signal.code}-${signal.subject}`}>
                      <Link href={`/dashboard/orders/${signal.orderId}`} className="block rounded-lg border border-white/10 bg-white/[0.03] px-2 py-2 transition hover:border-cyan-300/30 hover:bg-white/[0.06]">
                        <span className="text-[10px] uppercase tracking-[0.14em]" style={{ color: paint(signal.severity === "critical" ? "critical" : signal.severity === "warning" ? "attention" : "safe").hex }}>{signal.severity === "critical" ? t("dashboard.process.critical") : signal.severity === "warning" ? t("dashboard.process.watch") : t("copilot.severity.info")}</span>
                        <span className="block text-[13px]">{t(`copilot.${signal.code}`)}</span>
                        <span className="text-[12px] text-slate-400">{signal.subject} · {signal.value}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className={`${shell} p-3`}>
              <h2 className="text-[12px] uppercase tracking-[0.16em] text-slate-400">{t("dashboard.overview")}</h2>
              <div className="mt-3 grid grid-cols-3 text-center">
                <p><span className="block text-[36px] font-semibold leading-none">{mosaic.orders}</span><span className="text-[11px] text-slate-400">{t("dashboard.kpi.orders")}</span></p>
                <p><span className="block text-[36px] font-semibold leading-none">{mosaic.waiting}</span><span className="text-[11px] text-slate-400">{t("dashboard.waiting")}</span></p>
                <p><span className="block text-[36px] font-semibold leading-none">{mosaic.completedToday}</span><span className="text-[11px] text-slate-400">{t("dashboard.completedToday")}</span></p>
              </div>
              <Link href="/dashboard/orders" className="mt-3 block text-[12px] text-cyan-200">{t("nav.orders")}</Link>
            </section>
            <section className="flex h-[220px] flex-col justify-between rounded-2xl border border-dashed border-white/15 bg-[#0c1c30]/50 p-3">
              <h2 className="text-[12px] uppercase tracking-[0.16em] text-slate-400">{t("dashboard.plan")}</h2>
              <p className="text-center text-[13px] text-slate-400">{t("dashboard.planEmpty")}</p>
              <p className="text-[12px] text-slate-500">{t("dashboard.kpi.activeOrders")} · {mosaic.operators}</p>
            </section>
          </aside>
        </div>
    </OwnerFrame>
  );
}

export function OwnerFrame({ companyName, today, person, activeHref, children }: { companyName: string; today: string; person: { name: string; role: string }; activeHref: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[radial-gradient(1200px_500px_at_20%_-10%,rgba(60,240,255,0.08),transparent_55%),var(--ppi-canvas,#040b16)] font-sans text-slate-100">
      <aside className="fixed inset-y-0 left-0 z-20 flex w-16 flex-col border-r border-white/[0.06] bg-[#08141f]/75 shadow-[4px_0_28px_rgba(0,0,0,0.18)] backdrop-blur min-[1280px]:w-[300px]">
        <BrandLogo />
        <div className="hidden px-4 pb-3 min-[1280px]:block">
          <SessionIdentity name={person.name} role={person.role} align="center" />
        </div>
        <div className="mx-4 hidden border-t border-white/10 min-[1280px]:block" />
        <nav className="flex flex-col gap-0.5 px-2 pt-3">
          {nav.filter((item) => !isServicePaused(item.href)).map((item) => (
            <Link key={item.key} href={item.href} title={t(item.key)} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] tracking-wide transition ${item.href === activeHref ? "bg-cyan-400/10 text-white shadow-[inset_0_0_0_1px_rgba(60,240,255,0.25)]" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"}`}>
              <Icon name={item.icon} className="h-10 w-10" />
              <span className="hidden min-[1280px]:inline">{t(item.key)}</span>
            </Link>
          ))}
        </nav>
        <div className="mt-auto">
          <div className="hidden border-t border-white/10 px-3 py-4 min-[1280px]:block">
            <CompanyBrand stacked />
          </div>
        </div>
      </aside>
      <div className="pl-16 min-[1280px]:pl-[300px]">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-400/10 px-4 py-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-cyan-300">{t("dashboard.today")}</p>
            <h1 className="text-[26px] font-medium text-white">{companyName}</h1>
          </div>
          <DatePill today={today} />
        </header>
        {children}
      </div>
    </div>
  );
}

export function efficiencyPrimary(view: Mosaic["efficiency"]) {
  if (view.ratio === null || view.percent === null) return t("dashboard.noData");
  return view.ratio > 2 ? `${trimRatio(view.ratio)}×` : `${view.percent}%`;
}

export function efficiencyNote(view: Mosaic["efficiency"], unit: Mosaic["timeUnit"]) {
  if (view.ratio === null || view.actual === null || view.estimated === null || view.percent === null) return "";
  const suffix = unit === "HOUR" ? "h" : "m";
  return `${Math.round(view.percent)}% · ${Math.round(view.actual)}${suffix}/${Math.round(view.estimated)}${suffix}`;
}

type Tone = "monitor" | "good" | "moderate" | "critical" | "severe";

export function qualityScore(cpk: string | null) {
  if (cpk === null) return t("dashboard.noData");
  const value = Number(cpk);
  if (!Number.isFinite(value)) return t("dashboard.noData");
  return `${qualityPercentFromCpk(value)}%`;
}

function qualityReading(cpk: string | null, target: number | null, warning: number | null, delta: number | null): QualityState | null {
  if (cpk === null || target === null || warning === null || delta === null) return null;
  const value = Number(cpk);
  if (!Number.isFinite(value)) return null;
  return interpretQuality(qualityPercentFromCpk(value), target, warning, delta);
}

export function qualityNote(cpk: string | null, target: number | null, warning: number | null, delta: number | null) {
  if (cpk === null || !Number.isFinite(Number(cpk))) return "";
  const index = `Cpk ${Number(cpk).toFixed(2)}`;
  if (target === null || warning === null || delta === null) return `${t("dashboard.kpi.quality.targetMissing")} · ${index}`;
  return `${t("dashboard.kpi.quality.target")} ${trimTime(target)}% · ${index}`;
}

export function qualityOperationalTone(cpk: string | null, target: number | null, warning: number | null, delta: number | null): Tone {
  const state = qualityReading(cpk, target, warning, delta);
  if (state === "optimal") return "good";
  if (state === "moderate") return "moderate";
  if (state === "poor" || state === "critical") return "severe";
  if (state === "critical") return "severe";
  return "monitor";
}

export function qualityOperationalStatus(cpk: string | null, target: number | null, warning: number | null, delta: number | null) {
  const state = qualityReading(cpk, target, warning, delta);
  if (state === "optimal") return t("dashboard.kpiLabel.quality.optimal");
  if (state === "moderate") return t("dashboard.kpiLabel.quality.moderate");
  if (state === "poor") return t("dashboard.kpiLabel.quality.poor");
  if (state === "critical") return t("dashboard.kpiLabel.quality.critical");
  return "";
}

export function materialNote(remaining: number, used: number, unit: string) {
  const measure = unit ? `${unit} ` : "";
  return `${trimCount(remaining)} ${measure}${t("dashboard.kpi.materials.remaining")} · ${trimCount(used)} ${measure}${t("dashboard.kpi.materials.used")}`;
}

export function toolNote(active: number, replaced: number) {
  return `${trimCount(active)} ${t("dashboard.kpi.tools.active")} · ${trimCount(replaced)} ${t("dashboard.kpi.tools.replaced")}`;
}

function trimCount(value: number) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

export function scrapNote(produced: number | null, scrap: number | null) {
  if (produced === null || scrap === null) return "";
  return `${produced} ${t("dashboard.kpi.scrap.produced")} · ${scrap} ${t("dashboard.kpi.scrap.pieces")}`;
}

export function scrapTone(signals: CopilotSignal[]): Tone {
  const hit = signals.find((signal) => signal.code === "scrapHistory");
  if (!hit) return "good";
  return hit.severity === "critical" ? "critical" : "moderate";
}

export function scrapStatus(signals: CopilotSignal[]) {
  const tone = scrapTone(signals);
  if (tone === "critical") return t("dashboard.kpiLabel.scrap.high");
  if (tone === "moderate") return t("dashboard.kpiLabel.scrap.moderate");
  return t("dashboard.kpiLabel.scrap.low");
}

export function efficiencyTone(ratio: number | null): Tone {
  if (ratio === null || ratio <= 1.1) return "good";
  if (ratio <= 1.5) return "moderate";
  return "monitor";
}

export function efficiencyStatus(ratio: number | null) {
  if (ratio === null) return "";
  if (ratio <= 1.1) return t("dashboard.kpiLabel.efficiency.onTarget");
  if (ratio <= 1.5) return t("dashboard.kpiLabel.efficiency.watch");
  return t("dashboard.kpiLabel.efficiency.offTarget");
}

export function toolTone(signals: CopilotSignal[], count: number): Tone {
  if (signals.some((signal) => signal.kind === "tooling" && signal.severity === "critical")) return "critical";
  if (count > 0) return "moderate";
  return "good";
}

export function toolStatus(signals: CopilotSignal[], count: number) {
  const tone = toolTone(signals, count);
  if (tone === "critical") return t("dashboard.kpiLabel.tools.high");
  if (tone === "moderate") return t("dashboard.kpiLabel.tools.moderate");
  return t("dashboard.kpiLabel.tools.good");
}

export function materialTone(signals: CopilotSignal[]): Tone {
  if (signals.some((signal) => signal.code === "materialSuggestion" && signal.severity === "critical")) return "critical";
  if (signals.some((signal) => signal.code === "materialSuggestion")) return "moderate";
  return "good";
}

export function materialStatus(signals: CopilotSignal[]) {
  const tone = materialTone(signals);
  if (tone === "critical") return t("dashboard.kpiLabel.materials.critical");
  if (tone === "moderate") return t("dashboard.kpiLabel.materials.moderate");
  return t("dashboard.kpiLabel.materials.good");
}

function trimRatio(value: number) {
  return value.toFixed(2).replace(/0$/, "").replace(/\.0$/, "");
}

function trimTime(value: number) {
  return new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0 }).format(value);
}

export function deliveryNote(delivery: Mosaic["delivery"]) {
  if (!delivery) return "";
  const eta = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" }).format(delivery.eta);
  return `${Math.max(0, Math.round(delivery.days))}d ${t("dashboard.kpi.delivery.remaining")} · ETA ${eta}`;
}

export function qualityRing(cpk: string | null) {
  if (cpk === null || !Number.isFinite(Number(cpk))) return null;
  return Math.max(10, Math.min(100, qualityPercentFromCpk(Number(cpk))));
}

export function riskRing(percent: number | null) {
  if (percent === null || !Number.isFinite(percent)) return null;
  return Math.max(10, Math.min(100, percent));
}

export function coverageRing(percent: number | null) {
  return riskRing(percent);
}

export function efficiencyRing(percent: number | null): { fill: number; color: string } | null {
  if (percent === null || !Number.isFinite(percent)) return null;
  if (percent <= 100) return { fill: 100, color: "#00E676" };
  if (percent <= 120) return { fill: 100, color: "#FF9800" };
  return { fill: 100, color: "#FF4D4F" };
}

export function gaugeOf(scrap: string | null) {
  if (!scrap?.endsWith("%")) return null;
  const value = Number(scrap.slice(0, -1));
  return Number.isFinite(value) ? value : null;
}

const shell = "rounded-2xl border border-white/10 bg-[#0b1830]/75 shadow-[0_16px_40px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.07),0_0_24px_rgba(60,240,255,0.05)] backdrop-blur";

export function Tile({ hint, label, value, status, tone, points, note = "", gauge = null, ring = null, gap, relative = false }: { hint: string; label: string; value: string; status: string; tone: Tone; points: number[]; note?: string; gauge?: number | null; ring?: number | { fill: number; color: string } | null; gap?: number | null; relative?: boolean }) {
  const missing = value === t("dashboard.noData");
  const statusText = missing || !status ? t("dashboard.kpi.empty") : status;
  const statusTone: Tone = missing || !status ? "monitor" : tone;
  const color = kpiColor(statusTone);
  const chart = statusTone === "moderate" ? "#FF9800" : statusTone === "critical" || statusTone === "severe" ? "#FF4D4F" : "#3CF0FF";
  const unavailable = statusText === t("dashboard.kpi.empty");
  const ringFill = unavailable || ring === null ? null : typeof ring === "number" ? ring : ring.fill;
  const ringColor = unavailable || ring === null ? "#3CF0FF" : typeof ring === "number" ? color : ring.color;
  return (
    <div className="relative flex h-[280px] flex-col overflow-hidden rounded-xl border border-white/[0.05] bg-gradient-to-b from-white/[0.035] to-transparent p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <span className="pointer-events-none absolute inset-x-3 top-0 h-px bg-cyan-200/30" />
      <InfoTip title={label} text={hint} />
      <p className="h-8 shrink-0 whitespace-pre-line text-center text-[11px] font-medium uppercase leading-4 tracking-[0.22em] text-slate-500">{label}</p>
      <div className="mt-3 flex h-12 shrink-0 items-center justify-between gap-2">
        <p className="text-[30px] font-semibold leading-none tracking-tight text-white">{missing ? "" : value}</p>
        <Instrument color={ringColor} fill={ringFill} />
      </div>
      <p className="mt-4 h-5 shrink-0 text-center text-[13px] font-semibold uppercase leading-5 tracking-[0.16em]" style={{ color }}>{statusText}</p>
      <div className="mt-4 min-h-0 flex-1">{unavailable ? null : <KpiTrend points={points} delta={gap !== undefined ? gap : seriesDelta(points, relative)} color={chart} id={label} />}</div>
      <p className="h-8 shrink-0 truncate whitespace-nowrap pt-3 text-center text-[11px] leading-4 text-slate-400">{!missing && note ? note : ""}</p>
    </div>
  );
}

function seriesDelta(points: number[], relative: boolean) {
  if (points.length < 2) return null;
  const first = points[0];
  const last = points[points.length - 1];
  if (relative) return first === 0 ? null : ((last - first) / Math.abs(first)) * 100;
  return last - first;
}

function KpiTrend({ points, delta, color, id }: { points: number[]; delta: number | null; color: string; id: string }) {
  if (delta === null) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <p className="shrink-0 text-center text-[11px] leading-4 tracking-wide text-slate-300">{t("dashboard.trend.empty")}</p>
        <div className="min-h-0 flex-1"><BaselineWave /></div>
      </div>
    );
  }
  const rounded = Math.round(delta * 10) / 10;
  const amount = Number.isInteger(rounded) ? String(Math.abs(rounded)) : Math.abs(rounded).toFixed(1);
  const sign = rounded > 0 ? "+" : rounded < 0 ? "-" : "";
  const arrow = rounded > 0 ? "↑" : rounded < 0 ? "↓" : "";
  const varied = points.length >= 2 && Math.min(...points) !== Math.max(...points);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <p className="shrink-0 text-center text-[11px] leading-4 tracking-wide text-slate-300">{`${t("dashboard.kpi.trend")} ${sign}${amount}%${arrow ? ` ${arrow}` : ""}`}</p>
      {varied ? <div className="min-h-0 flex-1"><Spark points={points} color={color} id={id} /></div> : null}
    </div>
  );
}

function BaselineWave() {
  return (
    <svg viewBox="0 0 100 64" className="h-full w-full" aria-hidden="true">
      <path d="M8 32 H92" fill="none" stroke="#3CF0FF" strokeWidth="2" strokeLinecap="round" strokeDasharray="5 4" style={{ filter: "drop-shadow(0 0 4px #3CF0FF)" }} />
    </svg>
  );
}

function Instrument({ color, fill }: { color: string; fill: number | null }) {
  const length = 88;
  const drawn = fill === null ? 0 : (Math.min(100, Math.max(10, fill)) / 100) * length;
  return (
    <svg viewBox="0 0 36 36" className="h-10 w-10 shrink-0" aria-hidden="true">
      <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
      {fill === null ? (
        <circle cx="18" cy="4" r="2" fill="#3CF0FF" style={{ filter: "drop-shadow(0 0 4px #3CF0FF)" }} />
      ) : (
        <circle cx="18" cy="18" r="14" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${drawn} ${length}`} transform="rotate(-90 18 18)" style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
      )}
    </svg>
  );
}

function kpiColor(tone: Tone) {
  if (tone === "good") return "#00E676";
  if (tone === "moderate") return "#FF9800";
  if (tone === "critical" || tone === "severe") return "#FF4D4F";
  return "#3CF0FF";
}

function Wave({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 120 36" className="mt-2 h-16 w-full" aria-hidden="true">
      <path d="M0 20 H20 L28 8 L38 30 L48 14 L58 20 H120" fill="none" stroke={color} strokeWidth="2.4" strokeDasharray="8 4" style={{ animation: "ppi-wave 2.8s linear infinite", filter: `drop-shadow(0 0 8px ${color})` }} />
    </svg>
  );
}

function StatusMark({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8 shrink-0" aria-hidden="true">
      <circle cx="12" cy="12" r="8" fill="none" stroke={color} strokeWidth="1.6" />
      <circle cx="12" cy="12" r="3" fill={color} />
    </svg>
  );
}

function Trend({ title, points }: { title: string; points: number[] }) {
  return (
    <section className={`${shell} h-[300px] p-3`}>
      <h2 className="text-[12px] uppercase tracking-[0.16em] text-slate-400">{title}</h2>
      {points.length < 2 ? <p className="mt-16 text-center text-[13px] text-slate-400">{t("dashboard.noData")}</p> : <Spark points={points} color="#3cf0ff" id={title} tall />}
    </section>
  );
}

function Summary({ title, value, hint, href, donut }: { title: string; value: string; hint: string; href: string; donut?: string }) {
  return (
    <Link href={href} className={`${shell} flex h-[260px] flex-col justify-between p-3 transition hover:shadow-[0_0_28px_rgba(60,240,255,0.12)]`}>
      <h2 className="text-[12px] uppercase tracking-[0.16em] text-slate-400">{title}</h2>
      {donut ? <Donut value={value} color={donut} /> : <p className="text-[40px] font-semibold leading-none">{value}</p>}
      <p className="text-[12px] text-slate-400">{hint}</p>
    </Link>
  );
}

function Donut({ value, color }: { value: string; color: string }) {
  return (
    <svg viewBox="0 0 120 120" className="mx-auto h-28 w-28">
      <circle cx="60" cy="60" r="42" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
      <circle cx="60" cy="60" r="42" fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray="198 264" transform="rotate(-90 60 60)" style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
      <text x="60" y="66" textAnchor="middle" fill="#f8fafc" fontSize="22" fontWeight="700">{value}</text>
    </svg>
  );
}

function Gauge({ value, color }: { value: number; color: string }) {
  const length = 126;
  const filled = Math.max(0, Math.min(100, value)) / 100 * length;
  return (
    <svg viewBox="0 0 80 48" className="h-12 w-16 shrink-0">
      <path d="M8 40 A32 32 0 0 1 72 40" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" strokeLinecap="round" />
      <path d="M8 40 A32 32 0 0 1 72 40" fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${filled} ${length}`} style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
    </svg>
  );
}

function paint(level: "safe" | "warning" | "attention" | "critical") {
  const table = {
    safe: { hex: "#00E676", wash: "rgba(0,230,118,0.12)" },
    warning: { hex: "#FFD54A", wash: "rgba(255,213,74,0.12)" },
    attention: { hex: "#FF9800", wash: "rgba(255,152,0,0.14)" },
    critical: { hex: "#FF4D4F", wash: "rgba(255,77,79,0.16)" },
  };
  return table[level];
}

function Spark({ points, color, id, tall = false }: { points: number[]; color: string; id: string; tall?: boolean }) {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const line = points.map((point, index) => `${index === 0 ? "M" : "L"}${(index / (points.length - 1)) * 100} ${8 + (1 - (point - min) / span) * 48}`).join(" ");
  const gradient = `spark-${id.replace(/\s+/g, "-")}`;
  return (
    <svg viewBox="0 0 100 64" className={tall ? "mt-2 h-[200px] w-full" : "h-full w-full"}>
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.45" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1="0" x2="100" y1="32" y2="32" stroke="rgba(255,255,255,0.05)" strokeWidth="0.4" />
      <path d={`${line} L100 64 L0 64 Z`} fill={`url(#${gradient})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2.2" style={{ filter: `drop-shadow(0 0 4px ${color})`, animation: "ppi-rise 0.6s ease-out" }} />
    </svg>
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

function Icon({ name, className = "h-6 w-6" }: { name: string; className?: string }) {
  const frame = `${className} shrink-0 object-contain`;
  const artwork: Record<string, string> = {
    home: "/brand/nav/dashboard.png",
    floor: "/brand/nav/floor.png",
    orders: "/brand/nav/orders.png",
    check: "/brand/nav/quality.png",
    settings: "/brand/nav/settings.png",
  };
  if (artwork[name]) {
    return <img src={artwork[name]} alt="" className={frame} />;
  }
  const paths: Record<string, string> = {
    pulse: "M3 12 H8 L10 6 L14 18 L16 12 H21",
    file: "M6 3 H14 L18 7 V21 H6 Z",
    box: "M4 8 L12 4 L20 8 L12 12 Z M4 8 V16 L12 20 V12 M20 8 V16 L12 20",
    tool: "M5 19 L15 9 L18 12 L8 22 Z",
    machine: "M4 16 H20 M7 16 V8 H17 V16",
    people: "M12 12 A3 3 0 1 0 12 6 A3 3 0 1 0 12 12 M6 20 C6 16 18 16 18 20",
  };
  return (
    <svg viewBox="0 0 24 24" className={frame} fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d={paths[name] ?? paths.pulse} />
    </svg>
  );
}
