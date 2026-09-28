import Link from "next/link";
import { RoleName } from "@prisma/client";
import { hasRole, requireMember } from "@/lib/access";
import { t } from "@/lib/i18n";
import { withTenant } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { PartForm } from "@/app/dashboard/parts/part-form";

export default async function PartsPage() {
  const { session, activeRoles } = await requireMember();
  if (!hasRole(activeRoles, RoleName.OWNER) && !hasRole(activeRoles, RoleName.PRODUCTION_MANAGER)) {
    redirect("/dashboard");
  }
  const [parts, tools] = await withTenant(session.companyId, (tx) => Promise.all([
    tx.part.findMany({ where: { companyId: session.companyId, hiddenAt: null }, orderBy: { name: "asc" } }),
    tx.tool.findMany({ where: { companyId: session.companyId, hiddenAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]));
  return (
    <main>
      <h1 className="text-3xl">{t("part.title")}</h1>
      <PartForm tools={tools} />
      {parts.length === 0 ? <p className="mt-6">{t("part.empty")}</p> : null}
      <ul className="mt-6 flex flex-col gap-2">
        {parts.map((part) => (
          <li key={part.id} className="border border-stone-200 bg-white px-3 py-2">
            <Link href={`/dashboard/parts/${part.id}`}>{part.name}</Link>
            <span className="ml-3 text-sm text-stone-500">{part.retiredAt ? t("part.retired") : t("part.active")}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
