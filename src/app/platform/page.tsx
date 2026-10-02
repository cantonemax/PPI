import { PlatformFrame } from "@/app/platform/platform-frame";
import { t } from "@/lib/i18n";
import { todayLabel } from "@/lib/session-identity";
import { assignCompanyOwner, createPilotCompany, loadPlatformCompanies, saveCompanyLogo, setCompanyActive } from "@/server/platform-actions";

const shell = "rounded-2xl border border-white/10 bg-[#0b1830]/75 shadow-[0_16px_40px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.07),0_0_24px_rgba(60,240,255,0.05)] backdrop-blur";
const field = "mt-1 block w-full rounded-lg border border-white/15 bg-[#040b16] px-3 py-2 text-slate-100";
const action = "rounded-lg bg-cyan-400/15 px-4 py-2 text-[13px] text-cyan-100 shadow-[inset_0_0_0_1px_rgba(60,240,255,0.35)]";

export default async function PlatformPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const companies = await loadPlatformCompanies();
  const name = process.env.PLATFORM_ADMIN_NAME?.trim() || "Massimo Cantone";

  return (
    <PlatformFrame title={t("platform.desk")} today={todayLabel()} person={{ name, role: t("platform.title") }}>
      <div className="grid gap-3 px-3 py-3 min-[1440px]:grid-cols-[minmax(0,1fr)_300px]">
        <section id="companies" className="grid content-start gap-3">
          <h2 className="px-1 text-[12px] uppercase tracking-[0.16em] text-slate-400">{t("platform.companies")}</h2>
          {error ? <p className="px-1 text-[13px] text-[#FF4D4F]">{t(error)}</p> : null}
          {companies.length === 0 ? <p className={`${shell} px-3 py-8 text-center text-[13px] text-slate-400`}>{t("platform.empty")}</p> : null}
          {companies.map((company) => (
            <article key={company.id} className={`${shell} grid gap-4 p-3 min-[900px]:grid-cols-[180px_minmax(0,1fr)]`}>
              <div>
                <div className="flex h-24 w-full items-center justify-center rounded-lg border border-white/10 bg-[#040b16]">
                  {company.logoKey ? <img src={`/platform/logo/${company.id}`} alt="" className="h-20 max-w-full object-contain" /> : <span className="px-2 text-center text-[11px] uppercase tracking-[0.12em] text-slate-500">{t("platform.logoEmpty")}</span>}
                </div>
                <form action={saveCompanyLogo} className="mt-3 grid gap-2">
                  <input type="hidden" name="companyId" value={company.id} />
                  <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-white/15 px-3 py-2 text-[13px] text-slate-200">
                    {t("platform.chooseLogo")}
                    <input name="logo" type="file" accept="image/png,image/jpeg,image/webp" required className="sr-only" />
                  </label>
                  <button className={action}>{t("platform.saveLogo")}</button>
                </form>
              </div>
              <div>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[18px] text-white">{company.name}</p>
                    <p className="mt-1 text-[12px] uppercase tracking-[0.14em]" style={{ color: company.active ? "#00E676" : "#FF9800" }}>{company.active ? t("platform.active") : t("platform.inactive")}</p>
                    {company.slogan ? <p className="mt-2 text-[13px] uppercase tracking-[0.08em] text-cyan-200">{company.slogan}</p> : null}
                    <p className="mt-2 text-[12px] text-slate-400">{`${t("platform.owner")}: ${company.ownerNames || t("platform.ownerMissing")}`}</p>
                    <p className="mt-1 text-[12px] text-slate-400">{`${t("platform.orders")}: ${company.orders} · ${t("platform.measurements")}: ${company.measurements}`}</p>
                  </div>
                  <form action={setCompanyActive}>
                    <input type="hidden" name="companyId" value={company.id} />
                    <input type="hidden" name="active" value={company.active ? "0" : "1"} />
                    <button className={company.active ? "rounded-lg border border-[#FF4D4F]/50 px-4 py-2 text-[13px] text-[#FF4D4F]" : action}>{company.active ? t("platform.deactivate") : t("platform.activate")}</button>
                  </form>
                </div>
                <form action={assignCompanyOwner} className="mt-4 grid gap-3 min-[900px]:grid-cols-[1fr_1.4fr_1fr_auto] min-[900px]:items-end">
                  <input type="hidden" name="companyId" value={company.id} />
                  <label className="text-[12px] uppercase tracking-[0.12em] text-slate-400">{t("setup.operatorName")}<input name="firstName" className={field} /></label>
                  <label className="text-[12px] uppercase tracking-[0.12em] text-slate-400">{t("auth.email")}<input name="email" type="email" required className={field} /></label>
                  <label className="text-[12px] uppercase tracking-[0.12em] text-slate-400">{t("auth.password")}<input name="password" type="password" required minLength={8} className={field} /></label>
                  <button className={action}>{t("platform.assignOwner")}</button>
                </form>
              </div>
            </article>
          ))}
        </section>
        <aside id="create" className="grid content-start gap-3">
          <section className={`${shell} p-3`}>
            <h2 className="text-[12px] uppercase tracking-[0.16em] text-slate-400">{t("platform.create")}</h2>
            <form action={createPilotCompany} className="mt-3 grid gap-3">
              <label className="text-[12px] uppercase tracking-[0.12em] text-slate-400">{t("platform.name")}<input name="name" required className={field} /></label>
              <button className={action}>{t("platform.create")}</button>
            </form>
          </section>
        </aside>
      </div>
    </PlatformFrame>
  );
}
