import { t } from "@/lib/i18n";

export function ToolHistoryPanel({
  summary,
  rows,
  showCost,
  tone = "light",
}: {
  summary: { label: string; value: string }[];
  rows: { when: string; order: string; part: string; quantity: string; cost: string }[];
  showCost: boolean;
  tone?: "light" | "dark";
}) {
  const row = tone === "dark" ? "border border-white/10 px-3 py-2 text-slate-100" : "border border-stone-200 bg-white px-3 py-2";
  const muted = tone === "dark" ? "text-sm text-slate-300" : "text-sm text-stone-600";
  const label = tone === "dark" ? "text-sm text-slate-400" : "text-sm text-stone-500";
  return (
    <section className="mt-6">
      <h2 className={tone === "dark" ? "text-xl text-white" : "text-xl"}>{t("toolHistory.title")}</h2>
      {summary.length > 0 ? (
        <dl className="mt-3 grid gap-2 sm:grid-cols-2">
          {summary.map((item) => (
            <div key={item.label}>
              <dt className={label}>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {rows.length === 0 ? <p className="mt-3">{t("toolHistory.empty")}</p> : (
        <ul className="mt-4 flex flex-col gap-2">
          {rows.map((rowItem) => (
            <li key={`${rowItem.when}-${rowItem.order}-${rowItem.quantity}-${rowItem.cost}`} className={row}>
              <p>{rowItem.when}</p>
              <p className={muted}>{t("toolHistory.order")}: {rowItem.order}</p>
              <p className={muted}>{t("toolHistory.part")}: {rowItem.part}</p>
              <p className={muted}>{t("toolHistory.quantity")}: {rowItem.quantity}</p>
              {showCost ? <p className={muted}>{t("toolHistory.snapshotCost")}: {rowItem.cost}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
