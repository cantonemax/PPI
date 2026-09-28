import Link from "next/link";
import { redirect } from "next/navigation";
import { RoleName } from "@prisma/client";
import { hasRole, requireMember } from "@/lib/access";
import { t } from "@/lib/i18n";
import { withTenant } from "@/lib/prisma";

export default async function CertificationsPage() {
  const { session, activeRoles } = await requireMember();
  if (!hasRole(activeRoles, RoleName.OWNER) && !hasRole(activeRoles, RoleName.QUALITY_MANAGER)) redirect("/dashboard");
  const rows = await withTenant(session.companyId, (tx) =>
    tx.certification.findMany({
      where: { companyId: session.companyId },
      include: { productionOrder: { include: { part: true } } },
      orderBy: { addedAt: "desc" },
    }),
  );
  return (
    <main>
      <h1 className="text-3xl">{t("documents.certifications")}</h1>
      {rows.length === 0 ? <p className="mt-6">{t("documents.empty")}</p> : null}
      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-stone-300 text-left">
            <th className="py-2">{t("documents.order")}</th>
            <th>{t("order.part")}</th>
            <th>{t("documents.status")}</th>
            <th>{t("documents.fileName")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-stone-200">
              <td className="py-2">
                <Link href={`/dashboard/orders/${row.productionOrderId}`}>{t("documents.openOrder")}</Link>
              </td>
              <td>{row.productionOrder.part.name}</td>
              <td>{t(`order.phase.${row.productionOrder.phase}`)}</td>
              <td>{row.fileName}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
