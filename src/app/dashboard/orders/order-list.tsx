"use client";

import Link from "next/link";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { t } from "@/lib/i18n";
import { activateDraftOrder } from "@/server/order-actions";

export type OrderListRow = {
  id: string;
  href: string;
  code: string;
  article: string;
  quantity: number;
  phase: string;
  started: string;
  startedDay: string;
  completed: string;
  completedDay: string;
};

const searchModes = ["code", "article", "quantity", "date"] as const;
type SearchMode = (typeof searchModes)[number];

const field = "mt-1 h-9 w-full rounded-lg border border-white/15 bg-[#08141f] px-2 text-[13px] uppercase tracking-[0.08em] text-slate-100 outline-none [color-scheme:dark]";

export function OrderList({ rows, activatable = false, dateOn = "started" }: { rows: OrderListRow[]; activatable?: boolean; dateOn?: "started" | "completed" }) {
  const [mode, setMode] = useState<SearchMode>("code");
  const [query, setQuery] = useState("");
  const visible = rows.filter((row) => {
    const value = query.trim();
    if (!value) return true;
    if (mode === "code") return row.code.toLocaleLowerCase("it-IT").includes(value.toLocaleLowerCase("it-IT"));
    if (mode === "article") return row.article.toLocaleLowerCase("it-IT").includes(value.toLocaleLowerCase("it-IT"));
    if (mode === "quantity") return String(row.quantity).includes(value);
    return (dateOn === "completed" ? row.completedDay : row.startedDay) === value;
  });

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b1830]/75 shadow-[0_16px_40px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.07)]">
      <div className="grid grid-cols-1 gap-3 border-b border-white/10 px-4 py-3 sm:grid-cols-[12rem_1fr]">
        <label className="text-[11px] uppercase tracking-[0.16em] text-cyan-300/80">
          {t("order.filter.search")}
          <select value={mode} onChange={(event) => { setMode(event.target.value as SearchMode); setQuery(""); }} className={field}>
            {searchModes.map((item) => <option key={item} value={item}>{t(`order.filter.${item}`)}</option>)}
          </select>
        </label>
        <label className="text-[11px] uppercase tracking-[0.16em] text-cyan-300/80">
          {t(`order.filter.${mode}`)}
          {mode === "date" ? (
            <input type="date" value={query} onChange={(event) => setQuery(event.target.value)} className={field} />
          ) : (
            <input value={query} inputMode={mode === "quantity" ? "numeric" : "text"} onChange={(event) => setQuery(event.target.value)} placeholder={t("order.filter.all")} className={field} />
          )}
        </label>
      </div>
      {visible.length === 0 ? <p className="px-4 py-6 text-[13px] uppercase tracking-[0.12em] text-slate-400">{t("order.filter.empty")}</p> : (
        <table className="w-full border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-white/10 uppercase tracking-[0.16em] text-cyan-300/80">
              <th className="px-4 py-3 font-medium">{t("order.code")}</th>
              <th className="px-4 py-3 font-medium">{t("order.selected.article")}</th>
              <th className="px-4 py-3 font-medium">{t("order.listQuantity")}</th>
              <th className="px-4 py-3 font-medium">{t("order.lifecycle")}</th>
              <th className="px-4 py-3 font-medium">{t("order.startedAt")}</th>
              <th className="px-4 py-3 font-medium">{t("order.completedAt")}</th>
              {activatable ? <th className="px-4 py-3 font-medium">{t("order.activate")}</th> : null}
            </tr>
          </thead>
          <tbody>
            {visible.map((order) => (
              <tr key={order.id} className="border-b border-white/[0.06] uppercase tracking-[0.06em]">
                <td className="px-4 py-3">
                  <Link href={order.href} className="font-medium text-white">{order.code}</Link>
                </td>
                <td className="px-4 py-3 text-slate-200">{order.article}</td>
                <td className="px-4 py-3 text-slate-200">{order.quantity}</td>
                <td className="px-4 py-3 text-slate-300">{order.phase}</td>
                <td className="px-4 py-3 text-slate-400">{order.started}</td>
                <td className="px-4 py-3 text-slate-400">{order.completed}</td>
                {activatable ? (
                  <td className="px-4 py-3">
                    <form action={activateDraftOrder}>
                      <input type="hidden" name="orderId" value={order.id} />
                      <ActivateBox />
                    </form>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ActivateBox() {
  const { pending } = useFormStatus();
  return (
    <input
      type="checkbox"
      aria-label={t("order.activate")}
      disabled={pending}
      onChange={(event) => event.currentTarget.form?.requestSubmit()}
      className="h-5 w-5 accent-[#3CF0FF] disabled:opacity-40"
    />
  );
}
