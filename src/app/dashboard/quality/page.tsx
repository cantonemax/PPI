import { redirect } from "next/navigation";
import { OrderPhase } from "@prisma/client";
import Link from "next/link";
import { qualityOrder } from "@/lib/copilot";
import { companySignals } from "@/lib/copilot-query";
import { requireMember } from "@/lib/access";
import { t } from "@/lib/i18n";
import { withTenant } from "@/lib/prisma";
import { createControl, createControlPlan, recordMeasurementForm, updateControl } from "@/server/quality-actions";
import { formatCapability, formatPercent, formatQualityScore } from "@/lib/kpi/kpi-formatting";
import { qualityControlReading, type QualityChartMark, type QualityControlReading } from "@/lib/quality-evaluation";
import { RoleEngine } from "@/lib/auth/role-engine";

export default async function QualityPage() {
  const { session, user, activeRoles } = await requireMember();
  const allowed = RoleEngine.canCertify(activeRoles);
  if (!allowed) redirect("/dashboard");

  const orders = await withTenant(session.companyId, (tx) => tx.productionOrder.findMany({
    where: {
      companyId: session.companyId,
      hiddenAt: null,
      phase: { in: [OrderPhase.IN_PRODUCTION, OrderPhase.COMPLETED] },
    },
    include: {
      part: true,
      controlPlan: {
        include: {
          controls: { include: { measurements: { orderBy: { recordedAt: "desc" } } } },
        },
      },
    },
    orderBy: { startedAt: "desc" },
  }));

  const qualitySignals = (await companySignals(session.companyId, user.company.timeUnit))
    .filter((signal) => signal.kind === "quality")
    .sort((a, b) => qualityOrder(a) - qualityOrder(b));

  const rows = orders
    .map((order) => {
      const controls = (order.controlPlan?.controls ?? []).map((control) => {
        const chronological = [...control.measurements].reverse().map((measurement) => Number(measurement.value));
        const reading = qualityControlReading({
          values: chronological,
          lsl: Number(control.lowerLimit),
          usl: Number(control.upperLimit),
        });
        return { control, reading };
      });
      return { order, controls, alert: controls.some((item) => item.reading.partOut) };
    })
    .sort((a, b) => Number(b.alert) - Number(a.alert));

  return (
    <main className="flex flex-col gap-8">
      <h1 className="text-3xl">{t("quality.title")}</h1>
      <ul className="flex flex-col gap-2 text-sm">
        {qualitySignals.map((signal) => (
          <li key={`${signal.orderId}-${signal.code}-${signal.subject}`}>
            <Link href={`/dashboard/orders/${signal.orderId}`}>{t(`copilot.${signal.code}`)} · {signal.subject} · {signal.value}</Link>
          </li>
        ))}
      </ul>
      {rows.map(({ order, controls }) => (
        <section key={order.id} className="border border-stone-200 bg-white p-4">
          <h2 className="text-2xl">{order.part.name}</h2>
          {order.controlPlan ? null : (
            <form action={createControlPlan} className="mt-3">
              <input type="hidden" name="orderId" value={order.id} />
              <button className="min-h-12 bg-stone-950 px-4 text-white">{t("quality.createPlan")}</button>
            </form>
          )}
          {controls.map(({ control, reading }) => {
            const partColor = reading.latest === null ? "#8E9AAB" : reading.partOut ? "#FF4D4F" : "#00E676";
            const processColor = reading.processRisk === "critical" ? "#FF4D4F" : reading.processRisk === "attention" ? "#FF9800" : reading.processRisk === "none" ? "#00E676" : "#8E9AAB";
            const processLabel = reading.processRisk === "critical" ? t("quality.process.unstable") : reading.processRisk === "attention" ? t("quality.process.warning") : reading.processRisk === "none" ? t("quality.process.stable") : t("spc.insufficient");
            const orderLabel = order.code ?? order.id.slice(-6).toUpperCase();
            return (
            <article key={control.id} className="mt-4 border-t border-stone-200 pt-4">
              <p className="text-xl">{control.name}</p>
              <p>
                {t("quality.nominal")} {Number(control.nominal)} · {Number(control.lowerLimit)}–{Number(control.upperLimit)}
              </p>
              <section className="mt-3">
                <h3 className="text-[12px] uppercase tracking-[0.14em] text-stone-500">{t("quality.block.part")}</h3>
                <p className="mt-1">{t("quality.part")} {order.part.name} · {t("quality.order")} {orderLabel}</p>
                <p>{t("quality.latest")}: {reading.latest === null ? t("quality.none") : reading.latest}</p>
                <p className="font-semibold" style={{ color: partColor }}>{reading.latest === null ? t("quality.none") : reading.partOut ? t("quality.part.out") : t("quality.part.in")}</p>
              </section>
              <section className="mt-3">
                <h3 className="text-[12px] uppercase tracking-[0.14em] text-stone-500">{t("quality.block.process")}</h3>
                <p className="mt-1 font-semibold" style={{ color: processColor }}>{processLabel}</p>
              </section>
              <section className="mt-3">
                <h3 className="text-[12px] uppercase tracking-[0.14em] text-stone-500">{t("quality.block.rules")}</h3>
                <ul className="mt-1 flex flex-col gap-1">
                  {reading.rules.map((rule) => (
                    <li key={rule.rule} className="text-sm" style={{ color: rule.active ? rule.color : "#8E9AAB" }}>
                      {t(`quality.we.${rule.rule.toLowerCase().replace("_", "")}`)} · {rule.active ? t("quality.we.active") : t("quality.we.inactive")} · {t(`quality.we.severity.${rule.severity}`)} · {t(rule.actionKey)}
                    </li>
                  ))}
                </ul>
              </section>
              <section className="mt-3">
                <h3 className="text-[12px] uppercase tracking-[0.14em] text-stone-500">{t("quality.block.charts")}</h3>
                <QualityCharts reading={reading} />
              </section>
              <section className="mt-3">
                <h3 className="text-[12px] uppercase tracking-[0.14em] text-stone-500">{t("quality.block.capability")}</h3>
                {reading.cp === null || reading.cpk === null ? <p className="mt-1">{t("quality.notCalculable")}</p> : (
                  <p className="mt-1">
                    {t("quality.cp")} {formatCapability(reading.cp)} · {t("quality.cpk")} {formatCapability(reading.cpk)} · {t(`quality.confidence.${reading.confidence}`)} · {t("quality.score")} {formatQualityScore(reading.qualityScore)}
                  </p>
                )}
              </section>
              <section className="mt-3">
                <h3 className="text-[12px] uppercase tracking-[0.14em] text-stone-500">{t("quality.block.risk")}</h3>
                <p className="mt-1">{t("quality.outOfToleranceRate")} {formatPercent(reading.outOfToleranceRate) ?? t("quality.none")}</p>
                <p style={{ color: processColor }}>{processLabel}</p>
              </section>
              {order.phase === OrderPhase.IN_PRODUCTION ? (
                <form action={recordMeasurementForm} className="mt-2 flex gap-2">
                  <input type="hidden" name="controlId" value={control.id} />
                  <input name="value" inputMode="decimal" required className="min-h-12 border border-stone-300 px-3" />
                  <button className="min-h-12 bg-stone-950 px-4 text-white">{t("quality.record")}</button>
                </form>
              ) : null}
              <form action={updateControl} className="mt-2 grid gap-2 md:grid-cols-5">
                <input type="hidden" name="controlId" value={control.id} />
                <input name="name" defaultValue={control.name} required className="min-h-12 border border-stone-300 px-3" />
                <input name="nominal" defaultValue={Number(control.nominal)} required className="min-h-12 border border-stone-300 px-3" />
                <input name="lowerLimit" defaultValue={Number(control.lowerLimit)} required className="min-h-12 border border-stone-300 px-3" />
                <input name="upperLimit" defaultValue={Number(control.upperLimit)} required className="min-h-12 border border-stone-300 px-3" />
                <button className="min-h-12 border border-stone-950 px-3">{t("quality.update")}</button>
              </form>
            </article>
            );
          })}
          {order.controlPlan ? (
            <form action={createControl} className="mt-4 grid gap-2 md:grid-cols-5">
              <input type="hidden" name="orderId" value={order.id} />
              <input name="name" required placeholder={t("quality.name")} className="min-h-12 border border-stone-300 px-3" />
              <input name="nominal" required placeholder={t("quality.nominal")} className="min-h-12 border border-stone-300 px-3" />
              <input name="lowerLimit" required placeholder={t("quality.lower")} className="min-h-12 border border-stone-300 px-3" />
              <input name="upperLimit" required placeholder={t("quality.upper")} className="min-h-12 border border-stone-300 px-3" />
              <button className="min-h-12 bg-stone-950 px-3 text-white">{t("quality.addControl")}</button>
            </form>
          ) : null}
        </section>
      ))}
    </main>
  );
}

function QualityCharts({ reading }: { reading: QualityControlReading }) {
  if (reading.individuals.points.length < 2) return <p className="mt-1">{t("quality.chart.empty")}</p>;
  const active = [...new Map(reading.marks.map((mark) => [mark.actionKey, mark])).values()];
  return (
    <div className="mt-2 grid gap-3">
      <LimitChart
        title={t("quality.chart.individuals")}
        points={reading.individuals.points}
        center={reading.individuals.cl}
        upper={reading.individuals.ucl}
        lower={reading.individuals.lcl}
        marks={reading.marks}
        markAt={(mark) => mark.index}
      />
      <LimitChart
        title={t("quality.chart.movingRange")}
        points={reading.movingRange.points}
        center={reading.movingRange.cl}
        upper={reading.movingRange.ucl}
        lower={null}
        marks={reading.marks.filter((mark) => mark.rangeIndex !== null)}
        markAt={(mark) => mark.rangeIndex ?? 0}
      />
      {active.map((mark) => (
        <p key={mark.actionKey} className="text-sm font-semibold" style={{ color: mark.color }}>{t(`quality.we.${mark.rule.toLowerCase().replace("_", "")}`)} · {t(mark.actionKey)}</p>
      ))}
    </div>
  );
}

function LimitChart({
  title,
  points,
  center,
  upper,
  lower,
  marks,
  markAt,
}: {
  title: string;
  points: number[];
  center: number;
  upper: number;
  lower: number | null;
  marks: QualityChartMark[];
  markAt: (mark: QualityChartMark) => number;
}) {
  const guides = [center, upper, ...(lower === null ? [] : [lower])];
  const finite = [...points, ...guides].filter((value) => Number.isFinite(value));
  const low = Math.min(...finite);
  const high = Math.max(...finite);
  const pad = Math.max(high - low, 0.001) * 0.22;
  const y0 = low - pad;
  const y1 = high + pad;
  const width = 640;
  const height = 180;
  const plot = { left: 16, right: 88, top: 16, bottom: 16 };
  const plotWidth = width - plot.left - plot.right;
  const plotHeight = height - plot.top - plot.bottom;
  const yOf = (value: number) => plot.top + ((y1 - value) / (y1 - y0)) * plotHeight;
  const xOf = (index: number) => points.length <= 1 ? plot.left + plotWidth / 2 : plot.left + (index / (points.length - 1)) * plotWidth;
  const marked = new Map(marks.map((mark) => [markAt(mark), mark]));
  const lines = [
    { value: center, label: t("quality.chart.center"), color: "#64748b" },
    { value: upper, label: t("spc.ucl"), color: "#64748b" },
    ...(lower === null ? [] : [{ value: lower, label: t("spc.lcl"), color: "#64748b" }]),
  ];
  return (
    <div>
      <p className="text-sm text-stone-600">{title}</p>
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-1 aspect-[3/1] w-full" role="img" aria-label={title}>
        {lines.map((line) => (
          <g key={line.label}>
            <line x1={plot.left} x2={width - plot.right} y1={yOf(line.value)} y2={yOf(line.value)} stroke={line.color} strokeDasharray={line.label === t("quality.chart.center") ? undefined : "4 3"} strokeWidth="1" />
            <text x={width - plot.right + 8} y={yOf(line.value) + 4} fill={line.color} fontSize="12">{`${line.label} ${Number(line.value.toFixed(3))}`}</text>
          </g>
        ))}
        {points.length > 1 ? <polyline fill="none" stroke="#334155" strokeWidth="1.5" points={points.map((value, index) => `${xOf(index)},${yOf(value)}`).join(" ")} /> : null}
        {points.map((value, index) => {
          const mark = marked.get(index);
          return (
            <g key={index}>
              <circle cx={xOf(index)} cy={yOf(value)} r={mark ? 6 : 3.5} fill={mark ? mark.color : "#334155"} />
              {mark ? <text x={xOf(index) + 8} y={yOf(value) - 8} fill={mark.color} fontSize="12">{t(`quality.we.${mark.rule.toLowerCase().replace("_", "")}`)}</text> : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
