import { t } from "@/lib/i18n";
import { timeControlsPaused } from "@/lib/service-phase";
import type { OrderEconomics } from "@/lib/economics";

function money(value: number | null) {
  if (value === null) return t("economy.absent");
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(value);
}

function quantity(value: number | null) {
  if (value === null) return t("economy.absent");
  return new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2 }).format(value);
}

export function ComparisonSection({ economics, economic }: { economics: OrderEconomics; economic: boolean }) {
  const rows = [
    ...(timeControlsPaused ? [] : [{ label: t("economy.time"), estimate: quantity(economics.time.estimated), actual: quantity(economics.time.actual), difference: quantity(economics.time.difference) }]),
    { label: t("economy.scrap"), estimate: quantity(economics.scrap.estimated), actual: quantity(economics.scrap.actual), difference: quantity(economics.scrap.difference) },
    ...economics.tools.map((line) => ({
      label: `${t("economy.tools")}: ${line.name}`,
      estimate: quantity(line.estimated),
      actual: quantity(line.actual),
      difference: quantity(line.difference),
    })),
    ...economics.materials.map((line) => ({
      label: `${t("economy.materials")}: ${line.name}`,
      estimate: quantity(line.estimated),
      actual: quantity(line.actual),
      difference: quantity(line.difference),
    })),
  ];
  if (economic) {
    rows.push({
      label: t("economy.cost"),
      estimate: money(economics.estimatedCost),
      actual: money(economics.actualCost),
      difference: money(economics.costDeviation),
    });
    rows.push({
      label: t("economy.margin"),
      estimate: money(economics.expectedMargin),
      actual: money(economics.actualMargin),
      difference: money(economics.marginDeviation),
    });
  }
  return (
    <section className="rounded-2xl border border-white/10 bg-[#0b1830]/75 p-4 text-[13px] uppercase tracking-[0.06em] text-slate-300 shadow-[0_16px_40px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.07)]">
      <h2 className="text-[15px] uppercase tracking-[0.16em] text-cyan-200">{t("economy.comparison")}</h2>
      <table className="mt-3 w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-white/10 uppercase tracking-[0.14em] text-cyan-300/80">
            <th className="py-2" />
            <th>{t("economy.estimate")}</th>
            <th>{t("economy.actual")}</th>
            <th>{t("economy.difference")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-white/[0.06]">
              <td className="py-2">{row.label}</td>
              <td>{row.estimate}</td>
              <td>{row.actual}</td>
              <td>{row.difference}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
