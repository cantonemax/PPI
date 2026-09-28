import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { RoleName } from "@prisma/client";
import { PartForm } from "@/app/dashboard/parts/part-form";
import { hasRole, requireMember } from "@/lib/access";
import { t } from "@/lib/i18n";
import { withTenant } from "@/lib/prisma";
import { hidePart, retirePart } from "@/server/part-actions";

export default async function PartDetailPage({ params }: { params: Promise<{ partId: string }> }) {
  const { partId } = await params;
  const { session, activeRoles } = await requireMember();
  if (!hasRole(activeRoles, RoleName.OWNER) && !hasRole(activeRoles, RoleName.PRODUCTION_MANAGER)) {
    redirect("/dashboard");
  }
  const part = await withTenant(session.companyId, (tx) =>
    tx.part.findFirst({
      where: { id: partId, companyId: session.companyId, hiddenAt: null },
      include: { productionOrders: { orderBy: { startedAt: "desc" } } },
    }),
  );
  if (!part) notFound();
  return (
    <main>
      <h1 className="text-3xl">{part.name}</h1>
      <p className="mt-2 text-sm text-stone-500">{part.retiredAt ? t("part.retired") : t("part.active")}</p>
      <PartForm partId={part.id} name={part.name} />
      <div className="mt-4 flex gap-3">
        {part.productionOrders.length > 0 && !part.retiredAt ? (
          <form action={retirePart}>
            <input type="hidden" name="partId" value={part.id} />
            <button className="border border-stone-300 px-3 py-1 text-sm">{t("part.retire")}</button>
          </form>
        ) : null}
        {part.productionOrders.length === 0 ? (
          <form action={hidePart}>
            <input type="hidden" name="partId" value={part.id} />
            <button className="border border-stone-300 px-3 py-1 text-sm">{t("part.hide")}</button>
          </form>
        ) : null}
      </div>
      <h2 className="mt-8 text-xl">{t("part.history")}</h2>
      <ul className="mt-2 flex flex-col gap-2">
        {part.productionOrders.map((order) => (
          <li key={order.id}>
            <Link href={`/dashboard/orders/${order.id}`}>{t(`order.phase.${order.phase}`)} · {order.targetQuantity}</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
