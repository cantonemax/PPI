import Link from "next/link";
import { t } from "@/lib/i18n";

const actions = [
  { href: "/dashboard/parts", label: "phase.article" },
  { href: "/dashboard/orders/new", label: "phase.order" },
  { href: "/dashboard/orders", label: "phase.orders" },
  { href: "/dashboard/quality", label: "phase.quality" },
  { href: "/dashboard/operator", label: "phase.operator" },
];

export function PhaseDesk() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8">
      <div>
        <h1 className="text-3xl">{t("phase.title")}</h1>
        <p className="mt-3 max-w-2xl text-stone-600">{t("phase.lead")}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {actions.map((action) => (
          <Link key={action.href} href={action.href} className="border border-stone-300 bg-white px-4 py-5 text-lg">
            {t(action.label)}
          </Link>
        ))}
      </div>
    </main>
  );
}
