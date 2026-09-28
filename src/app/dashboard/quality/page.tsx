import { redirect } from "next/navigation";
import { OrderPhase, RoleName } from "@prisma/client";
import Link from "next/link";
import { capability } from "@/lib/capability";
import { qualityOrder } from "@/lib/copilot";
import { companySignals } from "@/lib/copilot-query";
import { hasRole, requireMember } from "@/lib/access";
import { t } from "@/lib/i18n";
import { withTenant } from "@/lib/prisma";
import { createControl, createControlPlan, recordMeasurementForm, updateControl } from "@/server/quality-actions";

export default async function QualityPage() {
  const { session, user, activeRoles } = await requireMember();
  const allowed = hasRole(activeRoles, RoleName.QUALITY_MANAGER) || hasRole(activeRoles, RoleName.OWNER);
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
        const values = control.measurements.map((measurement) => Number(measurement.value));
        const latest = control.measurements[0];
        const outside = latest
          ? Number(latest.value) < Number(control.lowerLimit) || Number(latest.value) > Number(control.upperLimit)
          : false;
        return {
          control,
          latest,
          outside,
          index: capability(values, Number(control.lowerLimit), Number(control.upperLimit)),
        };
      });
      return { order, controls, alert: controls.some((item) => item.outside) };
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
          {controls.map(({ control, latest, index }) => (
            <article key={control.id} className="mt-4 border-t border-stone-200 pt-4">
              <p className="text-xl">{control.name}</p>
              <p>
                {t("quality.nominal")} {Number(control.nominal)} · {Number(control.lowerLimit)}–{Number(control.upperLimit)}
              </p>
              <p>
                {t("quality.latest")}: {latest ? Number(latest.value) : t("quality.none")} · {control.measurements.length}
              </p>
              {index?.status === "indices" ? (
                <p>
                  Cp {index.cp.toFixed(2)} · Cpk {index.cpk.toFixed(2)} · {t(`quality.confidence.${index.confidence}`)}
                </p>
              ) : null}
              {index?.status === "notCalculable" ? <p>{t("quality.notCalculable")}</p> : null}
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
          ))}
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
