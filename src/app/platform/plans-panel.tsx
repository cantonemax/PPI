import { t } from "@/lib/i18n";
import { clearQaDatasetData } from "@/server/analytics-test-actions";
import { createPlan, disablePlan, duplicatePlan, loadPlanDesk, reactivatePlan, savePlanFeatures, savePlanGeneral, savePlanLimits, savePlanNotes, savePlanPricing } from "@/server/plan-actions";

type Desk = Awaited<ReturnType<typeof loadPlanDesk>>;
type Draft = { monthly: string; annual: string; fee: string; discount: string; custom: string; needReason: boolean };

const shell = "rounded-2xl border border-white/10 bg-[#091422] p-4";
const field = "mt-1 block w-full rounded-lg border border-white/15 bg-[#040b16] px-3 py-2 text-[13px] text-slate-100";
const button = "rounded-lg border border-white/15 px-3 py-1.5 text-[12px] text-slate-200 hover:bg-white/5";

function euro(value: { toString(): string } | number) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(value));
}

function when(value: Date) {
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(value);
}

function shown(action: string, value: string | null) {
  if (!value) return t("platform.plans.unlimited");
  if (action === "FEATURE_ADDED" || action === "FEATURE_REMOVED") return t(`platform.plans.feature.${value}`);
  if (action === "PLAN_DISABLED" || action === "PLAN_REACTIVATED" || action === "PLAN_MODIFIED" && (value === "ACTIVE" || value === "DISABLED")) return t(`platform.plans.status.${value}`);
  const split = value.indexOf(":");
  if (split > 0 && !value.includes("€")) {
    const key = value.slice(0, split);
    const rest = value.slice(split + 1);
    return `${t(`platform.plans.field.${key}`)}: ${rest || t("platform.plans.unlimited")}`;
  }
  return value;
}

export function PlansPanel({ desk, confirm, draft, hasQa }: { desk: Desk; confirm?: string; draft?: Draft; hasQa: boolean }) {
  const { access, plans, counts, features, selected, activeCustomers } = desk;
  const enabled = new Map(selected?.features.map((feature) => [feature.featureKey, feature.enabled]) ?? []);
  return (
    <div className="grid gap-4 px-4 py-4 sm:px-6">
      <section className={`${shell} overflow-x-auto`}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[16px] font-medium text-white">{t("platform.plans.title")}</h2>
          <div className="flex flex-wrap gap-2">
            {access.create ? (
              <form action={createPlan} className="flex gap-2">
                <input name="name" placeholder={t("platform.plans.newName")} className="rounded-lg border border-white/15 bg-[#040b16] px-3 py-1.5 text-[13px]" />
                <button className={button}>{t("platform.plans.create")}</button>
              </form>
            ) : null}
            {access.edit && hasQa ? <form action={clearQaDatasetData}><button className={button}>{t("platform.plans.clearQa")}</button></form> : null}
          </div>
        </div>
        <table className="w-full min-w-[760px] text-left text-[13px] text-slate-200">
          <thead className="text-[11px] uppercase tracking-[0.12em] text-slate-500">
            <tr>
              <th className="pb-2 pr-3">{t("platform.plans.col.name")}</th>
              <th className="pb-2 pr-3">{t("platform.plans.col.status")}</th>
              <th className="pb-2 pr-3">{t("platform.plans.col.monthly")}</th>
              <th className="pb-2 pr-3">{t("platform.plans.col.annual")}</th>
              <th className="pb-2 pr-3">{t("platform.plans.col.customers")}</th>
              <th className="pb-2 pr-3">{t("platform.plans.col.updated")}</th>
              <th className="pb-2">{t("platform.plans.col.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => (
              <tr key={plan.id} className="border-t border-white/10">
                <td className="py-2 pr-3"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: plan.badgeColor }} />{plan.name}</td>
                <td className="py-2 pr-3">{t(`platform.plans.status.${plan.status}`)}</td>
                <td className="py-2 pr-3 tabular-nums">{plan.customPricingAllowed ? t("platform.plans.custom") : euro(plan.monthlyPrice)}</td>
                <td className="py-2 pr-3 tabular-nums">{plan.customPricingAllowed ? t("platform.plans.custom") : euro(plan.annualPrice)}</td>
                <td className="py-2 pr-3 tabular-nums">{counts.get(plan.id) ?? 0}</td>
                <td className="py-2 pr-3">{when(plan.updatedAt)}</td>
                <td className="py-2">
                  <span className="flex flex-wrap gap-2">
                    <a className="text-teal-100" href={`/platform?view=plans&plan=${plan.id}`}>{t("platform.plans.open")}</a>
                    {access.edit ? <a className="text-teal-100" href={`/platform?view=plans&plan=${plan.id}`}>{t("platform.plans.edit")}</a> : null}
                    {access.duplicate ? <form action={duplicatePlan}><input type="hidden" name="planId" value={plan.id} /><button className="text-teal-100">{t("platform.plans.duplicate")}</button></form> : null}
                    {access.disable && plan.status === "ACTIVE" ? <a className="text-amber-200" href={`/platform?view=plans&plan=${plan.id}&confirm=disable`}>{t("platform.plans.disable")}</a> : null}
                    {access.reactivate && plan.status === "DISABLED" ? <form action={reactivatePlan}><input type="hidden" name="planId" value={plan.id} /><button className="text-emerald-200">{t("platform.plans.reactivate")}</button></form> : null}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {selected ? (
        <section className="grid gap-4">
          <h2 className="text-[18px] font-medium text-white">{selected.name}</h2>
          {access.edit ? (
            <>
              <form action={savePlanGeneral} className={`${shell} grid gap-3 sm:grid-cols-2`}>
                <h3 className="sm:col-span-2 text-[13px] uppercase tracking-[0.14em] text-slate-400">{t("platform.plans.section.general")}</h3>
                <input type="hidden" name="planId" value={selected.id} />
                <label>{t("platform.plans.field.name")}<input name="name" defaultValue={selected.name} className={field} /></label>
                <label>{t("platform.plans.field.description")}<input name="description" defaultValue={selected.description ?? ""} className={field} /></label>
                <label>{t("platform.plans.field.badgeColor")}<input name="badgeColor" type="color" defaultValue={selected.badgeColor} className={field} /></label>
                <label>{t("platform.plans.field.displayOrder")}<input name="displayOrder" type="number" defaultValue={selected.displayOrder} className={field} /></label>
                <p className="text-[13px] text-slate-300">{`${t("platform.plans.field.status")}: ${t(`platform.plans.status.${selected.status}`)}`}</p>
                <button className={button}>{t("platform.plans.save")}</button>
              </form>
              <form action={savePlanPricing} className={`${shell} grid gap-3 sm:grid-cols-2`}>
                <h3 className="sm:col-span-2 text-[13px] uppercase tracking-[0.14em] text-slate-400">{t("platform.plans.section.pricing")}</h3>
                <input type="hidden" name="planId" value={selected.id} />
                <label>{t("platform.plans.field.monthlyPrice")}<input name="monthlyPrice" defaultValue={Number(selected.monthlyPrice)} className={field} /></label>
                <label>{t("platform.plans.field.annualPrice")}<input name="annualPrice" defaultValue={Number(selected.annualPrice)} className={field} /></label>
                <label>{t("platform.plans.field.activationFee")}<input name="activationFee" defaultValue={Number(selected.activationFee)} className={field} /></label>
                <label>{t("platform.plans.field.annualDiscountPercent")}<input name="annualDiscountPercent" defaultValue={Number(selected.annualDiscountPercent)} className={field} /></label>
                <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" name="customPricingAllowed" value="1" defaultChecked={selected.customPricingAllowed} />{t("platform.plans.field.customPricingAllowed")}</label>
                {selected.customPricingAllowed ? <p className="text-[13px] text-amber-100">{t("platform.plans.customHint")}</p> : null}
                <button className={button}>{t("platform.plans.save")}</button>
              </form>
              <form action={savePlanLimits} className={`${shell} grid gap-3 sm:grid-cols-3`}>
                <h3 className="sm:col-span-3 text-[13px] uppercase tracking-[0.14em] text-slate-400">{t("platform.plans.section.limits")}</h3>
                <input type="hidden" name="planId" value={selected.id} />
                {(["maxUsers", "maxDepartments", "maxMachines", "maxOrders", "maxMeasurements", "maxStorageMb"] as const).map((key) => (
                  <label key={key}>{t(`platform.plans.field.${key}`)}<input name={key} defaultValue={selected[key] ?? ""} className={field} /></label>
                ))}
                <p className="sm:col-span-3 text-[12px] text-slate-500">{t("platform.plans.limitHint")}</p>
                <button className={button}>{t("platform.plans.save")}</button>
              </form>
              <form action={savePlanFeatures} className={`${shell} grid gap-2 sm:grid-cols-2`}>
                <h3 className="sm:col-span-2 text-[13px] uppercase tracking-[0.14em] text-slate-400">{t("platform.plans.section.features")}</h3>
                <input type="hidden" name="planId" value={selected.id} />
                {features.map((feature) => (
                  <label key={feature.key} className="flex items-center gap-2 text-[13px] text-slate-200">
                    <input type="checkbox" name={`feature_${feature.key}`} value="1" defaultChecked={enabled.get(feature.key) === true} />
                    {t(`platform.plans.feature.${feature.key}`)}
                  </label>
                ))}
                <button className={`${button} sm:col-span-2 w-fit`}>{t("platform.plans.save")}</button>
              </form>
              <form action={savePlanNotes} className={`${shell} grid gap-3`}>
                <h3 className="text-[13px] uppercase tracking-[0.14em] text-slate-400">{t("platform.plans.section.notes")}</h3>
                <input type="hidden" name="planId" value={selected.id} />
                <textarea name="notes" defaultValue={selected.notes ?? ""} className={`${field} min-h-24`} />
                <button className={`${button} w-fit`}>{t("platform.plans.save")}</button>
              </form>
            </>
          ) : (
            <article className={shell}>
              <p className="text-[13px] text-slate-300">{selected.description}</p>
              <p className="mt-2 text-[13px] text-slate-400">{`${euro(selected.monthlyPrice)} · ${euro(selected.annualPrice)}`}</p>
            </article>
          )}
          {access.history ? (
            <article className={shell}>
              <h3 className="text-[13px] uppercase tracking-[0.14em] text-slate-400">{t("platform.plans.section.history")}</h3>
              <ul className="mt-3 grid gap-2 text-[13px]">
                {selected.changes.map((change) => (
                  <li key={change.id} className="grid gap-0.5 border-t border-white/10 py-2">
                    <span className="text-slate-400">{`${when(change.occurredAt)} · ${change.actorName}`}</span>
                    <span className="text-white">{t(`platform.plans.change.${change.action}`)}</span>
                    <span className="text-slate-300">{`${shown(change.action, change.previousValue)} → ${shown(change.action, change.newValue)}`}</span>
                    {change.reason ? <span className="text-slate-500">{change.reason}</span> : null}
                  </li>
                ))}
              </ul>
            </article>
          ) : null}
        </section>
      ) : null}
      {confirm === "price" && selected && draft ? (
        <form action={savePlanPricing} className="fixed inset-0 z-30 grid place-items-center bg-black/60 p-4">
          <div className="grid w-full max-w-md gap-3 rounded-2xl border border-white/15 bg-[#091422] p-5">
            <h3 className="text-[16px] text-white">{t("platform.plans.confirmPrice")}</h3>
            <p className="text-[14px] text-slate-200">{selected.name}</p>
            <p className="text-[14px] text-slate-300">{`${euro(selected.monthlyPrice)} → ${euro(draft.monthly)}`}</p>
            <p className="text-[14px] text-slate-300">{`${euro(selected.annualPrice)} → ${euro(draft.annual)}`}</p>
            <input type="hidden" name="planId" value={selected.id} />
            <input type="hidden" name="confirmPrice" value="1" />
            <input type="hidden" name="monthlyPrice" value={draft.monthly} />
            <input type="hidden" name="annualPrice" value={draft.annual} />
            <input type="hidden" name="activationFee" value={draft.fee} />
            <input type="hidden" name="annualDiscountPercent" value={draft.discount} />
            {draft.custom === "1" ? <input type="hidden" name="customPricingAllowed" value="1" /> : null}
            <label>{t("platform.plans.reason")}<input name="reason" required className={field} /></label>
            {draft.needReason ? <p className="text-[12px] text-amber-200">{t("platform.plans.reasonRequired")}</p> : null}
            <span className="flex gap-2">
              <button className={button}>{t("platform.plans.confirm")}</button>
              <a href={`/platform?view=plans&plan=${selected.id}`} className={button}>{t("platform.plans.cancel")}</a>
            </span>
          </div>
        </form>
      ) : null}
      {confirm === "disable" && selected ? (
        <form action={disablePlan} className="fixed inset-0 z-30 grid place-items-center bg-black/60 p-4">
          <div className="grid w-full max-w-md gap-3 rounded-2xl border border-white/15 bg-[#091422] p-5">
            <h3 className="text-[16px] text-white">{t("platform.plans.confirmDisable")}</h3>
            <p className="text-[14px] text-slate-200">{selected.name}</p>
            <p className="text-[14px] text-slate-300">{`${t("platform.plans.activeCustomers")}: ${activeCustomers}`}</p>
            {activeCustomers > 0 ? <p className="text-[13px] text-amber-200">{t("platform.plans.disableWarning")}</p> : null}
            <input type="hidden" name="planId" value={selected.id} />
            <input type="hidden" name="confirmDisable" value="1" />
            <span className="flex gap-2">
              <button className={button}>{t("platform.plans.confirm")}</button>
              <a href={`/platform?view=plans&plan=${selected.id}`} className={button}>{t("platform.plans.cancel")}</a>
            </span>
          </div>
        </form>
      ) : null}
    </div>
  );
}
