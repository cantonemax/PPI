"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";
import { criticalThreshold, warningThreshold } from "@/lib/quality-evaluation";
import { saveQualityRules } from "@/server/order-actions";

const field = "mt-1 w-full rounded-lg border border-white/15 bg-[#0b1830] px-3 py-2 text-slate-100 outline-none [color-scheme:dark] disabled:opacity-40";

export function QualityRulesForm({
  orderId,
  useDefaults,
  target,
  warningDelta,
  criticalDelta,
  companyTarget,
  companyWarning,
  companyCritical,
}: {
  orderId: string;
  useDefaults: boolean;
  target: string;
  warningDelta: string;
  criticalDelta: string;
  companyTarget: string;
  companyWarning: string;
  companyCritical: string;
}) {
  const [defaultsOn, setDefaultsOn] = useState(useDefaults);
  const [targetValue, setTargetValue] = useState(useDefaults ? companyTarget : target);
  const [warningValue, setWarningValue] = useState(useDefaults ? companyWarning : warningDelta);
  const [criticalValue, setCriticalValue] = useState(useDefaults ? companyCritical : criticalDelta);
  const shownTarget = Number(defaultsOn ? companyTarget : targetValue);
  const shownWarning = Number(defaultsOn ? companyWarning : warningValue);
  const shownCritical = Number(defaultsOn ? companyCritical : criticalValue);
  const attention = Number.isFinite(shownTarget) && Number.isFinite(shownWarning) ? warningThreshold(shownTarget, shownWarning) : null;
  const threshold = Number.isFinite(shownTarget) && Number.isFinite(shownCritical) ? criticalThreshold(shownTarget, shownCritical) : null;

  return (
    <form action={saveQualityRules} className="mt-3 grid max-w-xl gap-3 text-[13px] uppercase tracking-[0.08em]">
      <input type="hidden" name="orderId" value={orderId} />
      <label className="flex items-center gap-2">
        <input name="useCompanyDefaults" type="checkbox" checked={defaultsOn} onChange={(event) => setDefaultsOn(event.target.checked)} className="h-4 w-4 accent-[#3CF0FF]" />
        {t("order.useCompanyDefaults")}
      </label>
      <label>{t("order.qualityTarget")}
        <input name="qualityTarget" value={defaultsOn ? companyTarget : targetValue} disabled={defaultsOn} onChange={(event) => setTargetValue(event.target.value)} className={field} />
      </label>
      <label>{t("order.qualityWarning")}
        <input name="warningDelta" value={defaultsOn ? companyWarning : warningValue} disabled={defaultsOn} onChange={(event) => setWarningValue(event.target.value)} className={field} />
      </label>
      <label>{t("order.qualityDelta")}
        <input name="criticalDelta" value={defaultsOn ? companyCritical : criticalValue} disabled={defaultsOn} onChange={(event) => setCriticalValue(event.target.value)} className={field} />
      </label>
      <p className="text-slate-300">{t("order.qualityWarningThreshold")}: {attention === null ? "—" : `${attention}%`}</p>
      <p className="text-slate-300">{t("order.qualityThreshold")}: {threshold === null ? "—" : `${threshold}%`}</p>
      <button className="w-fit rounded-full border border-cyan-300/40 bg-cyan-400/10 px-4 py-2 text-white">{t("order.qualitySave")}</button>
    </form>
  );
}
