import type { ReactNode } from "react";
import { t } from "@/lib/i18n";
import { clearAnalyticsTestData } from "@/server/analytics-test-actions";
import type { ExecutiveRange } from "@/lib/executive-analytics";
import { executiveLayer } from "@/lib/executive-analytics";
import { businessDesk, type CountMode, type RegionMode } from "@/lib/platform-analytics";

type BusinessView = ReturnType<typeof businessDesk>;
type ExecutiveView = ReturnType<typeof executiveLayer>;
type Slice = { label: string; value: number };
type Modes = { planMode: CountMode; regionMode: RegionMode; provinceMode: CountMode; countryMode: CountMode };

const palette = ["#2563eb", "#22d3ee", "#7c3aed", "#eab308", "#16a34a", "#f97316", "#dc2626", "#ec4899"];
const otherColor = "#94a3b8";
function Split() {
  return <div className="h-px w-full bg-white/55" />;
}
const shell = "rounded-2xl border border-white/10 bg-[#091422] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]";
const on = "rounded-md bg-teal-300/20 px-2 py-0.5 text-[11px] font-medium text-teal-50";
const off = "rounded-md px-2 py-0.5 text-[11px] text-slate-400 hover:bg-white/5 hover:text-white";
const select = "rounded-lg border border-white/15 bg-[#040b16] px-2 py-1 text-[13px] text-slate-100";
const countTone: Record<string, string> = {
  "platform.kpi.active": "bg-emerald-300",
  "platform.kpi.trial": "bg-cyan-300",
  "platform.kpi.suspended": "bg-rose-300",
  "platform.kpi.renewals": "bg-sky-400",
};
const renewalTone: Record<string, string> = {
  "platform.renewal.next30": "border-l-emerald-300",
  "platform.renewal.next60": "border-l-amber-300",
  "platform.renewal.expired": "border-l-orange-300",
  "platform.renewal.suspended": "border-l-rose-300",
};

function medal(rank: number) {
  if (rank === 1) return "bg-amber-300/25 text-amber-50 ring-1 ring-amber-200/50";
  if (rank === 2) return "bg-slate-200/15 text-slate-50 ring-1 ring-slate-200/40";
  if (rank === 3) return "bg-orange-300/20 text-orange-50 ring-1 ring-orange-200/40";
  return "text-slate-500";
}

function rankRow(rank: number) {
  if (rank === 1) return "border-t border-amber-200/30 bg-amber-300/[0.08]";
  if (rank === 2) return "border-t border-white/10 bg-white/[0.04]";
  if (rank === 3) return "border-t border-orange-200/25 bg-orange-300/[0.07]";
  return "border-t border-white/10";
}

function euro(value: number) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}

function dateLabel(value: Date | null) {
  if (!value) return t("platform.usage.unavailable");
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(value);
}

function href(range: ExecutiveRange, year: number | null, shape: "line" | "bar", modes: Modes) {
  const query = new URLSearchParams({ view: "revenue", range, shape, planMode: modes.planMode, regionMode: modes.regionMode, provinceMode: modes.provinceMode, countryMode: modes.countryMode });
  if (year) query.set("year", String(year));
  return `/platform?${query.toString()}`;
}

function Segment({ children }: { children: ReactNode }) {
  return <div className="inline-flex flex-wrap gap-0.5 rounded-lg border border-white/10 bg-black/25 p-0.5">{children}</div>;
}

function Heading({ children }: { children: ReactNode }) {
  return <h2 className="text-[14px] font-medium tracking-tight text-white">{children}</h2>;
}

function EmptyChart({ children }: { children: ReactNode }) {
  return (
    <div className="relative grid h-36 place-items-center overflow-hidden rounded-xl border border-white/10">
      <div
        className="absolute inset-0 opacity-50"
        style={{
          backgroundImage: "linear-gradient(rgba(148,163,184,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.16) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      <div className="relative grid justify-items-center gap-1 px-4 text-center">
        <svg viewBox="0 0 24 24" className="h-6 w-6 text-teal-200" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <path d="M4 19h16M7 16v-4M12 16V8M17 16v-7" />
        </svg>
        <p className="max-w-md text-[13px] leading-snug text-slate-400">{children}</p>
      </div>
    </div>
  );
}

function focusSlices(slices: readonly Slice[], otherLabel: string) {
  const named = slices.filter((slice) => slice.value > 0 && slice.label !== otherLabel).sort((left, right) => right.value - left.value || left.label.localeCompare(right.label, "it"));
  const carried = slices.filter((slice) => slice.label === otherLabel).reduce((sum, slice) => sum + slice.value, 0);
  const head = named.slice(0, 6);
  const rest = named.slice(6).reduce((sum, slice) => sum + slice.value, 0) + carried;
  return rest > 0 ? [...head, { label: otherLabel, value: rest }] : head;
}

function Pie({ slices, money = false, otherLabel }: { slices: Slice[]; money?: boolean; otherLabel: string }) {
  const drawn = slices.filter((slice) => slice.value > 0);
  const total = drawn.reduce((sum, slice) => sum + slice.value, 0);
  if (total <= 0) return <div><Split /><div className="pt-3"><EmptyChart>{t("platform.analytics.empty")}</EmptyChart></div></div>;
  const text = (value: number) => money ? euro(value) : String(value);
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  let colorIndex = 0;
  const rings = drawn.map((slice) => {
    const length = (slice.value / total) * circumference;
    const gap = drawn.length > 1 ? Math.min(2, length * 0.06) : 0;
    const grouped = slice.label === otherLabel;
    const ring = {
      dash: `${Math.max(length - gap, 0.5)} ${circumference}`,
      offset,
      color: grouped ? otherColor : palette[colorIndex % palette.length] ?? palette[0],
      label: slice.label,
      value: slice.value,
      share: Math.round((slice.value / total) * 100),
      grouped,
    };
    if (!grouped) colorIndex += 1;
    offset += length;
    return ring;
  });
  return (
    <div>
      <Split />
      <div className="flex justify-center py-3">
        <svg viewBox="0 0 100 100" className="h-48 w-48" role="img">
          <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
          {rings.map((ring) => (
            <circle key={ring.label} cx="50" cy="50" r={radius} fill="none" stroke={ring.color} strokeWidth="6" strokeDasharray={ring.dash} strokeDashoffset={-ring.offset} strokeLinecap="round" transform="rotate(-90 50 50)" />
          ))}
          <text x="50" y="49" textAnchor="middle" fill="#f8fafc" fontSize={money ? "7" : "13"} fontWeight="600">{text(total)}</text>
          <text x="50" y="59" textAnchor="middle" fill="#94a3b8" fontSize="5">{t("platform.analytics.total")}</text>
        </svg>
      </div>
      <Split />
      <ul className="pt-1">
        {rings.map((ring) => (
          <li key={ring.label} className={`grid grid-cols-[auto_minmax(0,1fr)_auto_2.5rem] items-center gap-2 py-1 text-[12px] ${ring.grouped ? "text-slate-400" : "text-slate-300"}`}>
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: ring.color }} />
            <span className="truncate">{ring.label}</span>
            <span className={`tabular-nums ${ring.grouped ? "text-slate-400" : "text-slate-100"}`}>{text(ring.value)}</span>
            <span className="text-right tabular-nums text-slate-500">{`${ring.share}%`}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Series({ points, shape }: { points: { label: string; value: number }[]; shape: "line" | "bar" }) {
  const max = Math.max(...points.map((point) => point.value), 1);
  const width = 720;
  const height = 250;
  const padX = 18;
  const base = 214;
  const plot = 188;
  const span = width - padX * 2;
  const yOf = (value: number) => base - (value / max) * plot;
  const slots = points.map((point, index) => {
    const x = padX + (points.length === 1 ? span / 2 : (index / (points.length - 1)) * span);
    return { ...point, x, y: yOf(point.value), slot: padX + index * (span / points.length) };
  });
  const guides = [0, 0.5, 1].map((step) => base - step * plot);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-80 w-full sm:h-96" role="img" aria-label={t("platform.analytics.chart")}>
      {guides.map((y) => <line key={y} x1={padX} x2={width - padX} y1={y} y2={y} stroke="rgba(255,255,255,0.08)" />)}
      {shape === "bar" ? slots.map((point) => {
        const slot = span / points.length;
        const bar = Math.min(36, slot * 0.52);
        const x = point.slot + (slot - bar) / 2;
        return <rect key={point.label} x={x} y={point.y} width={bar} height={Math.max(base - point.y, 0)} rx="5" fill="#2dd4bf"><title>{`${point.label}: ${euro(point.value)}`}</title></rect>;
      }) : (
        <>
          <polygon points={`${slots[0]?.x ?? padX},${base} ${slots.map((point) => `${point.x},${point.y}`).join(" ")} ${slots.at(-1)?.x ?? width - padX},${base}`} fill="rgba(56,189,248,0.18)" />
          <polyline points={slots.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke="#22d3ee" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          {slots.map((point) => <circle key={point.label} cx={point.x} cy={point.y} r="3.5" fill="#082f49" stroke="#22d3ee" strokeWidth="1.5"><title>{`${point.label}: ${euro(point.value)}`}</title></circle>)}
        </>
      )}
      {slots.map((point) => (
        <text key={`${point.label}-axis`} x={shape === "bar" ? point.slot + span / points.length / 2 : point.x} y="234" textAnchor="middle" fill="#94a3b8" fontSize="11">{point.label}</text>
      ))}
    </svg>
  );
}

function GrowthChart({ points }: { points: { label: string; revenue: number; customers: number }[] }) {
  const maxRevenue = Math.max(...points.map((point) => point.revenue), 1);
  const maxCustomers = Math.max(...points.map((point) => point.customers), 1);
  const width = 720;
  const height = 250;
  const padX = 18;
  const base = 214;
  const plot = 188;
  const span = width - padX * 2;
  const slots = points.map((point, index) => {
    const x = padX + (points.length === 1 ? span / 2 : (index / (points.length - 1)) * span);
    return {
      ...point,
      x,
      revenueY: base - (point.revenue / maxRevenue) * plot,
      customerY: base - (point.customers / maxCustomers) * plot,
    };
  });
  return (
    <div className="grid gap-1">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-80 w-full sm:h-96" role="img" aria-label={t("platform.analytics.growth")}>
        {[0, 0.5, 1].map((step) => {
          const y = base - step * plot;
          return <line key={y} x1={padX} x2={width - padX} y1={y} y2={y} stroke="rgba(255,255,255,0.08)" />;
        })}
        <polygon points={`${slots[0]?.x ?? padX},${base} ${slots.map((point) => `${point.x},${point.revenueY}`).join(" ")} ${slots.at(-1)?.x ?? width - padX},${base}`} fill="rgba(34,211,238,0.2)" />
        <polyline points={slots.map((point) => `${point.x},${point.revenueY}`).join(" ")} fill="none" stroke="#22d3ee" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        <polyline points={slots.map((point) => `${point.x},${point.customerY}`).join(" ")} fill="none" stroke="#e2e8f0" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {slots.map((point) => <text key={point.label} x={point.x} y="234" textAnchor="middle" fill="#94a3b8" fontSize="11">{point.label}</text>)}
      </svg>
      <p className="flex gap-4 text-[11px] text-slate-400">
        <span className="text-cyan-200">{t("platform.analytics.growthRevenue")}</span>
        <span className="text-slate-200">{t("platform.analytics.growthCustomers")}</span>
      </p>
    </div>
  );
}

function hiddenFilters(range: ExecutiveRange, year: number | null, shape: "line" | "bar", modes: Modes) {
  return (
    <>
      <input type="hidden" name="view" value="revenue" />
      <input type="hidden" name="shape" value={shape} />
      <input type="hidden" name="planMode" value={modes.planMode} />
      <input type="hidden" name="regionMode" value={modes.regionMode} />
      <input type="hidden" name="provinceMode" value={modes.provinceMode} />
      <input type="hidden" name="countryMode" value={modes.countryMode} />
      {year ? <input type="hidden" name="year" value={year} /> : null}
      <input type="hidden" name="range" value={range} />
    </>
  );
}

export function RevenuePanel({
  view,
  executive,
  range,
  year,
  years,
  shape,
  planMode,
  regionMode,
  provinceMode,
  countryMode,
  hasTestData = false,
  compareA = "",
  compareB = "",
}: {
  view: BusinessView;
  executive: ExecutiveView;
  range: ExecutiveRange;
  year: number | null;
  years: number[];
  shape: "line" | "bar";
  planMode: CountMode;
  regionMode: RegionMode;
  provinceMode: CountMode;
  countryMode: CountMode;
  hasTestData?: boolean;
  compareA?: string;
  compareB?: string;
}) {
  const modes = { planMode, regionMode, provinceMode, countryMode };
  const launch = range === "sinceLaunch";
  const money = [
    ["platform.kpi.mrr", euro(view.kpis.mrr)],
    ["platform.kpi.arr", euro(view.kpis.arr)],
    ["platform.kpi.month", euro(view.kpis.monthRevenue)],
    ["platform.kpi.year", euro(view.kpis.yearRevenue)],
  ] as const;
  const counts = [
    ["platform.kpi.active", String(view.kpis.active)],
    ["platform.kpi.trial", String(view.kpis.trial)],
    ["platform.kpi.suspended", String(view.kpis.suspended)],
    ["platform.kpi.renewals", String(view.kpis.renewals)],
  ] as const;
  const lifetime = [
    ["platform.kpi.totalRevenue", euro(executive.lifetime.totalRevenue)],
    ["platform.kpi.acquired", String(executive.lifetime.acquired)],
    ["platform.kpi.active", String(executive.lifetime.active)],
    ["platform.kpi.lost", String(executive.lifetime.lost)],
    ["platform.kpi.averageValue", executive.lifetime.averageValue === null ? t("platform.summary.none") : euro(executive.lifetime.averageValue)],
    ["platform.kpi.popularPlan", executive.lifetime.popularPlan ?? t("platform.summary.none")],
    ["platform.kpi.bestCustomer", executive.lifetime.bestCustomer ?? t("platform.summary.none")],
    ["platform.kpi.bestRegion", executive.lifetime.bestRegion ?? t("platform.summary.none")],
    ["platform.kpi.bestProvince", executive.lifetime.bestProvince ?? t("platform.summary.none")],
    ["platform.kpi.bestCountry", executive.lifetime.bestCountry ?? t("platform.summary.none")],
  ] as const;
  const summary = [
    ["platform.summary.bestCustomer", executive.summary.bestCustomer ? <a href={`/platform?company=${executive.summary.bestCustomer.id}`} className="text-teal-100">{executive.summary.bestCustomer.name}</a> : t("platform.summary.none")],
    ["platform.summary.bestRegion", executive.summary.bestRegion ?? t("platform.summary.none")],
    ["platform.summary.bestProvince", executive.summary.bestProvince ?? t("platform.summary.none")],
    ["platform.summary.bestCountry", executive.summary.bestCountry ?? t("platform.summary.none")],
    ["platform.summary.popularPlan", executive.summary.popularPlan ?? t("platform.summary.none")],
    ["platform.summary.nextRenewal", executive.summary.nextRenewal ? <a href={`/platform?company=${executive.summary.nextRenewal.id}`} className="text-teal-100">{`${executive.summary.nextRenewal.name} · ${dateLabel(executive.summary.nextRenewal.at)}`}</a> : t("platform.summary.none")],
  ] as const;
  const lists = [
    ["platform.renewal.next30", view.renewals.next30],
    ["platform.renewal.next60", view.renewals.next60],
    ["platform.renewal.expired", view.renewals.expired],
    ["platform.renewal.suspended", view.renewals.suspended],
  ] as const;
  const otherLabel = t("platform.analytics.other");
  const pies = [
    { title: "platform.analytics.plans", slices: [...view.plans[planMode]], money: planMode === "revenue", links: [
      [href(range, year, shape, { ...modes, planMode: "customers" }), "platform.mode.customers", planMode === "customers"],
      [href(range, year, shape, { ...modes, planMode: "revenue" }), "platform.mode.revenue", planMode === "revenue"],
    ] },
    { title: "platform.analytics.regions", slices: focusSlices(view.regions[regionMode], otherLabel), money: regionMode === "revenue", links: [
      [href(range, year, shape, { ...modes, regionMode: "customers" }), "platform.mode.customers", regionMode === "customers"],
      [href(range, year, shape, { ...modes, regionMode: "revenue" }), "platform.mode.revenue", regionMode === "revenue"],
      [href(range, year, shape, { ...modes, regionMode: "active" }), "platform.mode.active", regionMode === "active"],
    ] },
    { title: "platform.analytics.provinces", slices: focusSlices(view.provinces[provinceMode], otherLabel), money: provinceMode === "revenue", links: [
      [href(range, year, shape, { ...modes, provinceMode: "customers" }), "platform.mode.customers", provinceMode === "customers"],
      [href(range, year, shape, { ...modes, provinceMode: "revenue" }), "platform.mode.revenue", provinceMode === "revenue"],
    ] },
    { title: "platform.analytics.countries", slices: focusSlices(view.countries[countryMode], otherLabel), money: countryMode === "revenue", links: [
      [href(range, year, shape, { ...modes, countryMode: "customers" }), "platform.mode.customers", countryMode === "customers"],
      [href(range, year, shape, { ...modes, countryMode: "revenue" }), "platform.mode.revenue", countryMode === "revenue"],
    ] },
  ] as const;
  return (
    <div className="grid gap-2 px-3 py-2 sm:px-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <form method="get" action="/platform" className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="view" value="revenue" />
          <input type="hidden" name="shape" value={shape} />
          <input type="hidden" name="planMode" value={modes.planMode} />
          <input type="hidden" name="regionMode" value={modes.regionMode} />
          <input type="hidden" name="provinceMode" value={modes.provinceMode} />
          <input type="hidden" name="countryMode" value={modes.countryMode} />
          <label className="grid gap-0.5 text-[10px] uppercase tracking-[0.14em] text-slate-500">
            {t("platform.analytics.range")}
            <select name="range" defaultValue={range} className={select}>
              {(["last30", "last90", "last12", "currentYear", "previousYear", "last3Years", "sinceLaunch"] as const).map((item) => (
                <option key={item} value={item}>{t(`platform.range.${item}`)}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-0.5 text-[10px] uppercase tracking-[0.14em] text-slate-500">
            {t("platform.analytics.year")}
            <select name="year" defaultValue={year ?? ""} className={select}>
              <option value="">{t("platform.analytics.allYears")}</option>
              {years.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <button type="submit" className="rounded-lg bg-teal-300/15 px-3 py-1 text-[13px] text-teal-50">{t("platform.analytics.apply")}</button>
        </form>
        <div className="flex flex-wrap items-center gap-2">
          {launch ? null : (
            <Segment>
              <a href={href(range, year, "line", modes)} className={shape === "line" ? on : off}>{t("platform.shape.line")}</a>
              <a href={href(range, year, "bar", modes)} className={shape === "bar" ? on : off}>{t("platform.shape.bar")}</a>
            </Segment>
          )}
          {hasTestData ? (
            <form action={clearAnalyticsTestData}>
              <button type="submit" className="rounded-lg border border-white/15 px-2.5 py-1 text-[12px] text-slate-300 hover:bg-white/5 hover:text-white">{t("platform.analytics.clearTest")}</button>
            </form>
          ) : null}
        </div>
      </div>
      <form method="get" action="/platform" className={`${shell} flex flex-wrap items-end gap-2 px-3 py-2`}>
        {hiddenFilters(range, year, shape, modes)}
        <p className="mr-1 text-[12px] font-medium text-white">{t("platform.analytics.compareTitle")}</p>
        <label className="grid gap-0.5 text-[10px] uppercase tracking-[0.14em] text-slate-500">
          {t("platform.analytics.compareA")}
          <select name="compareA" defaultValue={compareA} className={select}>
            <option value="">{t("platform.summary.none")}</option>
            {years.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="grid gap-0.5 text-[10px] uppercase tracking-[0.14em] text-slate-500">
          {t("platform.analytics.compareB")}
          <select name="compareB" defaultValue={compareB} className={select}>
            <option value="">{t("platform.summary.none")}</option>
            {years.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <button type="submit" className="rounded-lg border border-white/15 px-2.5 py-1 text-[12px] text-slate-200">{t("platform.analytics.apply")}</button>
        <p className="text-[12px] text-slate-400">{compareA && compareB ? `${compareA} / ${compareB}` : t("platform.analytics.compareReady")}</p>
      </form>
      <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
        {summary.map(([key, value]) => (
          <article key={key} className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5">
            <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">{t(key)}</p>
            <p className="truncate text-[14px] font-semibold leading-tight text-slate-100">{value}</p>
          </article>
        ))}
      </section>
      {launch ? (
        <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {lifetime.map(([key, value]) => (
            <article key={key} className={`${shell} px-3 py-1.5`}>
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">{t(key)}</p>
              <p className="mt-1 truncate text-[26px] font-semibold leading-none tracking-tight text-white">{value}</p>
            </article>
          ))}
        </section>
      ) : (
        <>
          <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {money.map(([key, value]) => (
              <article key={key} className={`${shell} relative overflow-hidden border-teal-200/25 bg-teal-300/[0.06] px-3 py-1.5`}>
                <span className="absolute inset-x-0 top-0 h-0.5 bg-teal-300" />
                <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400">{t(key)}</p>
                <p className="mt-1 text-[32px] font-semibold leading-none tracking-tight text-white sm:text-[36px]">{value}</p>
              </article>
            ))}
          </section>
          <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {counts.map(([key, value]) => (
              <article key={key} className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5">
                <span className={`h-5 w-1 rounded-full ${countTone[key] ?? "bg-slate-400"}`} />
                <span className="min-w-0">
                  <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">{t(key)}</p>
                  <p className="text-[22px] font-semibold tabular-nums leading-none text-slate-100">{value}</p>
                </span>
              </article>
            ))}
          </section>
        </>
      )}
      <section className={`${shell} grid gap-1 p-2`}>
        <Heading>{t(launch ? "platform.analytics.growth" : `platform.range.${range}`)}</Heading>
        {launch ? (
          executive.growth.length > 0 ? <GrowthChart points={executive.growth} /> : <EmptyChart>{t("platform.analytics.noRevenue")}</EmptyChart>
        ) : view.hasRevenue ? <Series points={view.series} shape={shape} /> : <EmptyChart>{t("platform.analytics.noRevenue")}</EmptyChart>}
      </section>
      <section className={`${shell} p-2.5`}>
        <Heading>{t("platform.top.title")}</Heading>
        <ul className="mt-2 grid gap-1.5 min-[760px]:hidden">
          {view.top.map((row) => (
            <li key={row.id} className={`rounded-lg px-2.5 py-1.5 ${rankRow(row.rank)}`}>
              <div className="flex items-center justify-between gap-2">
                <a href={`/platform?company=${row.id}`} className="truncate text-[14px] font-semibold text-teal-100">{row.name}</a>
                <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums ${medal(row.rank)}`}>{row.rank}</span>
              </div>
              <p className="text-[12px] text-slate-400">{`${row.plan} · ${euro(row.annualRevenue)} · ${dateLabel(row.renewalAt)}`}</p>
            </li>
          ))}
        </ul>
        <div className="mt-1 hidden overflow-x-auto min-[760px]:block">
          <table className="w-full text-left text-[13px] text-slate-200">
            <thead className="text-[10px] uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="pb-1 pr-3 font-medium">{t("platform.top.rank")}</th>
                <th className="pb-1 pr-3 font-medium">{t("platform.top.company")}</th>
                <th className="pb-1 pr-3 font-medium">{t("platform.top.plan")}</th>
                <th className="pb-1 pr-3 font-medium">{t("platform.top.revenue")}</th>
                <th className="pb-1 font-medium">{t("platform.top.renewal")}</th>
              </tr>
            </thead>
            <tbody>
              {view.top.map((row) => (
                <tr key={row.id} className={rankRow(row.rank)}>
                  <td className="py-1 pr-3">
                    <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums ${medal(row.rank)}`}>{row.rank}</span>
                  </td>
                  <td className="py-1 pr-3 font-semibold"><a href={`/platform?company=${row.id}`} className="text-teal-100">{row.name}</a></td>
                  <td className="py-1 pr-3 text-slate-300">{row.plan}</td>
                  <td className="py-1 pr-3 font-semibold tabular-nums text-white">{euro(row.annualRevenue)}</td>
                  <td className="py-1 text-slate-300">{dateLabel(row.renewalAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="grid gap-2 lg:grid-cols-4">
        {pies.map((pie) => (
          <article key={pie.title} className={`${shell} p-2.5`}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-1">
              <h2 className="text-[13px] font-medium text-white">{t(pie.title)}</h2>
              <Segment>
                {pie.links.map(([link, key, active]) => <a key={key} href={link} className={active ? on : off}>{t(key)}</a>)}
              </Segment>
            </div>
            <Pie slices={[...pie.slices]} money={pie.money} otherLabel={otherLabel} />
          </article>
        ))}
      </section>
      <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {lists.map(([key, rows]) => (
          <article key={key} className={`${shell} border-l-2 px-2.5 py-2 ${renewalTone[key] ?? "border-l-slate-400"}`}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[13px] font-medium text-white">{t(key)}</h2>
              <span className="text-[12px] tabular-nums text-slate-300">{rows.length}</span>
            </div>
            {rows.length === 0 ? (
              <div className="mt-1">
                <p className="text-[22px] font-semibold leading-none tabular-nums text-white">0</p>
                <p className="mt-1 text-[12px] text-slate-400">{t("platform.renewal.none")}</p>
              </div>
            ) : (
              <ul className="mt-1 grid gap-0.5 text-[13px]">
                {rows.map((row) => (
                  <li key={`${key}-${row.id}`} className="flex items-baseline justify-between gap-2">
                    <a href={`/platform?company=${row.id}`} className="truncate text-teal-100">{row.name}</a>
                    <span className="shrink-0 text-[11px] text-slate-500">{dateLabel(row.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}
