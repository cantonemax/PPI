"use client";

import { useState } from "react";
import { commercialQuote } from "@/lib/commercial-quote";
import { t } from "@/lib/i18n";

function euro(value: number) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

export function CommercialFields({
  className,
  plans,
  planId,
  billingCycle,
  monthly,
  discount,
}: {
  className: string;
  plans: { id: string; name: string }[];
  planId: string;
  billingCycle: string;
  monthly: string;
  discount: string;
}) {
  const [price, setPrice] = useState(monthly);
  const [percent, setPercent] = useState(discount);
  const monthlyValue = Number(price.replace(",", ".")) || 0;
  const discountValue = Number(percent.replace(",", ".")) || 0;
  const quote = commercialQuote(monthlyValue, discountValue);
  return (
    <>
      <label className="text-[12px] uppercase tracking-[0.12em] text-slate-400">{t("platform.field.plan")}
        <select name="planId" defaultValue={planId} className={className}>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select>
      </label>
      <label className="text-[12px] uppercase tracking-[0.12em] text-slate-400">{t("platform.field.billing")}
        <select name="billingCycle" defaultValue={billingCycle} className={className}>
          <option value="MONTHLY">{t("platform.billing.MONTHLY")}</option>
          <option value="YEARLY">{t("platform.billing.YEARLY")}</option>
        </select>
      </label>
      <label className="text-[12px] uppercase tracking-[0.12em] text-slate-400">{t("platform.field.monthlyList")}
        <input name="monthlyRevenue" inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} className={className} />
      </label>
      <label className="text-[12px] uppercase tracking-[0.12em] text-slate-400">{t("platform.field.annualDiscount")}
        <input name="annualDiscountPercent" inputMode="decimal" value={percent} onChange={(event) => setPercent(event.target.value)} className={className} />
      </label>
      <p className="text-[13px] text-slate-300">{`${t("platform.field.annualGross")}: ${euro(quote.annualGross)}`}</p>
      <p className="text-[13px] text-slate-300">{`${t("platform.field.discountAmount")}: ${euro(quote.discountAmount)}`}</p>
      <p className="text-[13px] text-slate-100">{`${t("platform.field.annualNet")}: ${euro(quote.annualNet)}`}</p>
    </>
  );
}
