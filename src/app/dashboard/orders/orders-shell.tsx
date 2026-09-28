import Link from "next/link";
import { CompanyBrand } from "@/app/dashboard/company-mark";
import { DatePill, SessionIdentity } from "@/app/dashboard/session-mark";
import { t } from "@/lib/i18n";

const commands = [
  { href: "/dashboard/orders?view=create", key: "order.create", view: "create" },
  { href: "/dashboard/orders?view=draft", key: "order.draft", view: "draft" },
  { href: "/dashboard/orders?view=active", key: "order.active", view: "active" },
  { href: "/dashboard/orders?view=closed", key: "order.closed", view: "closed" },
] as const;

export type OrdersView = (typeof commands)[number]["view"];

export function OrdersShell({
  title,
  today,
  person,
  view,
  code,
  showCommands = true,
  backHref = "/dashboard",
  backLabel = t("order.back"),
  children,
}: {
  title: string;
  today: string;
  person: { name: string; role: string };
  view?: OrdersView;
  code?: string;
  showCommands?: boolean;
  backHref?: string;
  backLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-[radial-gradient(1200px_500px_at_20%_-10%,rgba(60,240,255,0.08),transparent_55%),var(--ppi-canvas,#040b16)] font-sans text-slate-100">
      <aside className="fixed inset-y-0 left-0 z-20 flex w-[300px] flex-col border-r border-white/[0.06] bg-[#08141f]/75 shadow-[4px_0_28px_rgba(0,0,0,0.18)] backdrop-blur">
        <div className="relative flex h-[152px] items-center justify-center px-4">
          <span className="pointer-events-none absolute inset-x-6 top-6 h-16 rounded-full bg-cyan-300/20 blur-2xl" />
          <img src="/brand/ppi-logo.png" alt={t("product.name")} className="relative z-10 h-auto w-full object-contain mix-blend-screen drop-shadow-[0_0_18px_rgba(60,240,255,0.35)]" />
        </div>
        <div className="px-5 pb-3">
          <SessionIdentity name={person.name} role={person.role} align="center" />
        </div>
        <div className="mx-4 border-t border-white/10" />
        {showCommands ? (
          <nav className="flex flex-col gap-0.5 px-2 pt-3">
            {commands.map((item) => {
              const current = item.view === view;
              return (
                <Link key={item.key} href={item.href} className={`rounded-xl px-3 py-2.5 text-[13px] uppercase tracking-[0.14em] ${current ? "bg-cyan-400/10 text-white shadow-[inset_0_0_0_1px_rgba(60,240,255,0.25)]" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"}`}>
                  {t(item.key)}
                </Link>
              );
            })}
          </nav>
        ) : null}
        <div className="mt-auto">
          <div className="px-2 pb-3">
            <Link href={backHref} className="flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2.5 text-[12px] uppercase tracking-[0.08em] text-cyan-200 hover:bg-white/[0.04]">
              <span aria-hidden="true" className="text-[16px] leading-none">←</span>
              {backLabel}
            </Link>
          </div>
          <div className="border-t border-white/10 px-3 py-4">
            <CompanyBrand stacked />
          </div>
        </div>
      </aside>
      <main className="pl-[300px]">
        <header className="flex items-center justify-between gap-3 border-b border-cyan-400/10 px-4 py-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-cyan-300">{t("order.title")}</p>
            <h1 className="text-[26px] font-medium uppercase tracking-[0.08em] text-white">{title}</h1>
            {code ? (
              <p className="mt-1 text-[28px] font-medium uppercase tracking-[0.12em] text-white">
                <span className="mr-3 text-[13px] tracking-[0.28em] text-cyan-300">{t("order.commessaMark")}</span>
                {code}
              </p>
            ) : null}
          </div>
          <DatePill today={today} />
        </header>
        <div className="px-4 py-4">{children}</div>
      </main>
    </div>
  );
}
