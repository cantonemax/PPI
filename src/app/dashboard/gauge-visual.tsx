import Link from "next/link";
import { t } from "@/lib/i18n";

export type GaugeTone = "stable" | "attention" | "critical";

export function gaugeTone(score: number): GaugeTone {
  if (score >= 80) return "stable";
  if (score >= 60) return "attention";
  return "critical";
}

export function gaugeColor(tone: GaugeTone) {
  return tone === "stable" ? "#00E676" : tone === "attention" ? "#FF9800" : "#FF4D4F";
}

export function GaugeLegend() {
  const rows = [
    ["stable", "80-100", "#00E676"],
    ["attention", "60-79", "#FF9800"],
    ["critical", "0-59", "#FF4D4F"],
  ] as const;
  return (
    <ul className="flex flex-wrap gap-3">
      {rows.map(([tone, range, color]) => (
        <li key={tone} className="inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.12em] text-slate-300">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
          {t(`gauge.legend.${tone}`)}
          <span className="text-slate-500">{range}</span>
        </li>
      ))}
    </ul>
  );
}

export function DepartmentGauge({ machines }: { machines: { id: string; name: string; score: number | null }[] }) {
  const scored = machines.filter((machine) => machine.score !== null);
  const score = scored.length === 0 ? null : Math.round(scored.reduce((sum, machine) => sum + (machine.score ?? 0), 0) / scored.length);
  const tone = score === null ? null : gaugeTone(score);
  const color = tone ? gaugeColor(tone) : "#8E9AAB";
  return (
    <section className="rounded-2xl border border-white/10 bg-[#050d18] p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[12px] uppercase tracking-[0.16em] text-slate-400">{t("gauge.department")}</p>
          <p className="mt-2 text-[40px] font-semibold leading-none" style={{ color }}>{score ?? t("dashboard.noData")}</p>
          <p className="mt-2 text-[13px] font-semibold uppercase tracking-[0.14em]" style={{ color }}>{tone ? t(`gauge.legend.${tone}`) : t("dashboard.kpi.empty")}</p>
        </div>
        <GaugeLegend />
      </div>
      {machines.length === 0 ? <p className="mt-4 text-[13px] text-slate-400">{t("gauge.empty")}</p> : (
        <div className="mt-4 flex flex-col gap-2">
          {machines.map((machine) => {
            const machineTone = machine.score === null ? null : gaugeTone(machine.score);
            const machineColor = machineTone ? gaugeColor(machineTone) : "#8E9AAB";
            return (
              <Link key={machine.id} href={`/dashboard/process/machines/${machine.id}`} className="grid grid-cols-[8rem_minmax(0,1fr)_3rem] items-center gap-3 rounded-lg border border-white/10 px-3 py-2 hover:border-[#3CF0FF]">
                <span className="truncate text-[13px] text-white">{machine.name}</span>
                <span className="h-2 overflow-hidden rounded-full bg-white/10">
                  <span className="block h-full rounded-full" style={{ width: `${machine.score ?? 0}%`, background: machineColor }} />
                </span>
                <span className="text-right text-[13px] font-semibold" style={{ color: machineColor }}>{machine.score ?? t("order.selected.empty")}</span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function MachineGauge({
  score,
  orders,
  prediction,
  stops,
  scrap,
}: {
  score: number | null;
  orders: number;
  prediction: string;
  stops: number;
  scrap: number;
}) {
  const tone = score === null ? null : gaugeTone(score);
  const color = tone ? gaugeColor(tone) : "#8E9AAB";
  return (
    <section className="rounded-2xl border border-white/10 bg-[#050d18] p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[12px] uppercase tracking-[0.16em] text-slate-400">{t("gauge.machine")}</p>
          <p className="mt-2 text-[40px] font-semibold leading-none" style={{ color }}>{score ?? t("dashboard.noData")}</p>
          <p className="mt-2 text-[13px] font-semibold uppercase tracking-[0.14em]" style={{ color }}>{tone ? t(`gauge.legend.${tone}`) : t("dashboard.kpi.empty")}</p>
        </div>
        <GaugeLegend />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 min-[900px]:grid-cols-4">
        <Fact label={t("gauge.orders")} value={String(orders)} />
        <Fact label={t("gauge.prediction")} value={prediction} />
        <Fact label={t("gauge.stops")} value={String(stops)} />
        <Fact label={t("gauge.scrap")} value={String(scrap)} />
      </div>
    </section>
  );
}

export function SelectedOrder({
  code,
  article,
  quantity,
  controls,
  lot = "",
}: {
  code: string;
  article: string;
  quantity: string;
  controls: string;
  lot?: string;
}) {
  const rows = [
    [t("order.selected.article"), article || t("order.selected.empty")],
    [t("order.selected.lot"), lot || t("order.selected.empty")],
    [t("order.selected.quantity"), quantity || t("order.selected.empty")],
    [t("order.selected.controls"), controls || t("order.selected.empty")],
  ] as const;
  return (
    <section className="rounded-2xl border border-white/10 bg-[#050d18] px-4 py-4">
      <p className="text-[12px] uppercase tracking-[0.16em] text-slate-400">{t("order.selected.title")}</p>
      <p className="mt-2 text-[28px] font-semibold leading-none tracking-[0.08em] text-white">{code || t("order.selected.empty")}</p>
      <dl className="mt-4 grid grid-cols-2 gap-2 min-[900px]:grid-cols-4">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-white/10 px-3 py-2">
            <dt className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{label}</dt>
            <dd className="mt-1 truncate text-[16px] font-semibold text-white">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 truncate text-[16px] font-semibold text-white">{value}</p>
    </div>
  );
}
