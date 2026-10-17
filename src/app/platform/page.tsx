import { redirect } from "next/navigation";
import { AccessLink } from "@/app/platform/access-link";
import { CommercialFields } from "@/app/platform/commercial-fields";
import { CompanyList } from "@/app/platform/company-list";
import { PlatformFrame } from "@/app/platform/platform-frame";
import { PlansPanel } from "@/app/platform/plans-panel";
import { RevenuePanel } from "@/app/platform/revenue-panel";
import { countAnalyticsTestCompanies, countQaDataset } from "@/lib/analytics-test-companies";
import { commercialQuote } from "@/lib/commercial-quote";
import { t } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { availableYears, deskPeriodFor, executiveLayer, readRange, scopeCompanies } from "@/lib/executive-analytics";
import { businessDesk, type CountMode, type RegionMode } from "@/lib/platform-analytics";
import { todayLabel } from "@/lib/session-identity";
import {
  assignCompanyOwner,
  deleteCustomerCompany,
  disableOwnerAccount,
  loadBusinessDesk,
  loadCustomerProfile,
  loadPlatformCompanies,
  resetOwnerPassword,
  saveCustomerAddress,
  saveCustomerCompany,
  saveOwnerContact,
} from "@/server/platform-actions";
import { listAssignablePlans, listPlanCatalog, loadPlanDesk } from "@/server/plan-actions";

const shell = "rounded-2xl border border-white/10 bg-[#0b1830]/75 shadow-[0_16px_40px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.07),0_0_24px_rgba(60,240,255,0.05)] backdrop-blur";
const field = "mt-1 block w-full rounded-lg border border-white/15 bg-[#040b16] px-3 py-2 text-slate-100";
const action = "rounded-lg bg-cyan-400/15 px-4 py-2 text-[13px] text-cyan-100 shadow-[inset_0_0_0_1px_rgba(60,240,255,0.35)]";
const quiet = "rounded-lg border border-white/15 px-3 py-2 text-[13px] text-slate-100";
const tabs = ["company", "address", "owner", "contract", "usage", "history"] as const;

type Profile = NonNullable<Awaited<ReturnType<typeof loadCustomerProfile>>>;

function dateLabel(value: Date | null) {
  if (!value) return t("platform.usage.unavailable");
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(value);
}

function personName(person: { firstName: string | null; lastName: string | null; email: string } | null) {
  if (!person) return t("platform.ownerMissing");
  return [person.firstName, person.lastName].filter((part) => part && part.trim()).join(" ") || person.email;
}

export default async function PlatformPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; tab?: string; new?: string; error?: string; archive?: string; view?: string; period?: string; range?: string; year?: string; compareA?: string; compareB?: string; shape?: string; planMode?: string; regionMode?: string; provinceMode?: string; countryMode?: string; plan?: string; confirm?: string; monthly?: string; annual?: string; fee?: string; discount?: string; custom?: string; needReason?: string }>;
}) {
  const params = await searchParams;
  const admin = process.env.PLATFORM_ADMIN_NAME?.trim() || "Massimo Cantone";
  const frame = { title: t("platform.desk"), today: todayLabel(), person: { name: admin, role: t("platform.title") } };
  if (params.company) {
    const profile = await loadCustomerProfile(params.company);
    if (!profile) redirect("/platform");
    return (
      <PlatformFrame {...frame}>
        <CustomerProfile profile={profile} tab={params.tab ?? "company"} error={params.error} plans={await listAssignablePlans(profile.company.planId)} />
      </PlatformFrame>
    );
  }
  if (params.view === "revenue") {
    const companies = await loadBusinessDesk();
    const now = new Date();
    const range = params.range ? readRange(params.range) : params.period === "year" ? "currentYear" : "last12";
    const years = availableYears(companies);
    const year = years.includes(Number(params.year)) ? Number(params.year) : null;
    const catalog = await listPlanCatalog();
    const scoped = scopeCompanies(companies, range, year, now);
    const shape = params.shape === "bar" ? "bar" : "line";
    const planMode: CountMode = params.planMode === "revenue" ? "revenue" : "customers";
    const regionMode: RegionMode = params.regionMode === "revenue" || params.regionMode === "active" ? params.regionMode : "customers";
    const provinceMode: CountMode = params.provinceMode === "revenue" ? "revenue" : "customers";
    const countryMode: CountMode = params.countryMode === "revenue" ? "revenue" : "customers";
    const view = businessDesk(scoped, now, deskPeriodFor(range), t("platform.analytics.other"), catalog);
    const executive = executiveLayer(scoped, now, t("platform.analytics.other"), catalog);
    const hasTestData = await countAnalyticsTestCompanies(prisma) > 0;
    const compareA = years.includes(Number(params.compareA)) ? String(Number(params.compareA)) : "";
    const compareB = years.includes(Number(params.compareB)) ? String(Number(params.compareB)) : "";
    return (
      <PlatformFrame {...frame}>
        <RevenuePanel view={view} executive={executive} range={range} year={year} years={years} shape={shape} planMode={planMode} regionMode={regionMode} provinceMode={provinceMode} countryMode={countryMode} hasTestData={hasTestData} compareA={compareA} compareB={compareB} />
      </PlatformFrame>
    );
  }
  if (params.view === "plans") {
    return (
      <PlatformFrame {...frame}>
        <PlansPanel
          desk={await loadPlanDesk(params.plan)}
          confirm={params.confirm}
          hasQa={await countQaDataset(prisma) > 0}
          draft={params.confirm === "price" ? { monthly: params.monthly ?? "0", annual: params.annual ?? "0", fee: params.fee ?? "0", discount: params.discount ?? "0", custom: params.custom ?? "0", needReason: params.needReason === "1" } : undefined}
        />
      </PlatformFrame>
    );
  }
  const showArchive = params.archive === "1";
  const companies = await loadPlatformCompanies(showArchive);
  return (
    <PlatformFrame {...frame}>
      <CompanyList
        companies={companies.map((company) => ({
          id: company.id,
          name: company.name,
          plan: company.plan,
          contractStatus: company.contractStatus,
          closedAt: company.closedAt?.toISOString() ?? null,
          deletedAt: company.deletedAt?.toISOString() ?? null,
          activatedAt: company.activatedAt?.toISOString() ?? null,
          renewalAt: company.renewalAt?.toISOString() ?? null,
          ownerNames: company.ownerNames,
        }))}
        archived={showArchive}
        creating={!showArchive && params.new === "1"}
        error={params.error}
      />
    </PlatformFrame>
  );
}

function CustomerProfile({ profile, tab, error, plans }: { profile: Profile; tab: string; error?: string; plans: { id: string; name: string }[] }) {
  const { company, owner } = profile;
  const selected = tabs.includes(tab as (typeof tabs)[number]) ? tab : tab === "delete" ? "company" : "company";
  return (
    <div className="grid gap-3 px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <a href="/platform" className="text-[12px] uppercase tracking-[0.14em] text-cyan-200">{t("platform.back")}</a>
          <h2 className="text-[22px] text-white">{company.name}</h2>
        </div>
        {company.deletedAt ? null : <a href={`/platform?company=${company.id}&tab=delete`} className="rounded-lg border border-[#FF4D4F]/50 px-3 py-2 text-[13px] text-[#FF4D4F]">{t("platform.delete")}</a>}
      </div>
      <nav className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <a key={item} href={`/platform?company=${company.id}&tab=${item}`} className={item === selected && tab !== "delete" ? action : quiet}>{t(`platform.tab.${item}`)}</a>
        ))}
      </nav>
      {error ? <p className="text-[13px] text-[#FF4D4F]">{t(error)}</p> : null}
      {tab === "delete" ? <DeletePanel profile={profile} /> : null}
      {tab === "address" ? <AddressForm company={company} /> : null}
      {tab === "owner" ? <OwnerPanel profile={profile} /> : null}
      {tab === "contract" ? <ContractSummary company={company} /> : null}
      {tab === "usage" ? <UsagePanel profile={profile} /> : null}
      {tab === "history" ? <HistoryPanel profile={profile} /> : null}
      {tab !== "address" && tab !== "owner" && tab !== "contract" && tab !== "usage" && tab !== "history" && tab !== "delete" ? <CompanyForm company={company} plans={plans} /> : null}
    </div>
  );
}

function euro(value: number) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function ContractSummary({ company }: { company: Profile["company"] }) {
  const monthly = company.monthlyRevenue ? Number(company.monthlyRevenue) : 0;
  const discount = Number(company.annualDiscountPercent);
  const quote = commercialQuote(monthly, discount);
  const rows = [
    [t("platform.field.plan"), company.plan.name],
    [t("platform.field.billing"), t(`platform.billing.${company.billingCycle}`)],
    [t("platform.field.monthlyList"), euro(monthly)],
    [t("platform.field.annualGross"), euro(quote.annualGross)],
    [t("platform.field.annualDiscount"), `${discount.toLocaleString("it-IT")}%`],
    [t("platform.field.discountAmount"), euro(quote.discountAmount)],
    [t("platform.field.annualNet"), euro(quote.annualNet)],
    [t("platform.field.customerSince"), dateLabel(company.customerSince)],
    [t("platform.field.activation"), dateLabel(company.activatedAt)],
    [t("platform.field.renewal"), dateLabel(company.renewalAt)],
    [t("platform.field.expiration"), dateLabel(company.expiresAt)],
    [t("platform.field.lastPayment"), dateLabel(company.lastPaymentAt)],
    [t("platform.field.nextPayment"), dateLabel(company.nextPaymentAt)],
  ];
  return (
    <dl className={`${shell} grid gap-3 p-3 text-[13px] text-slate-200 min-[800px]:grid-cols-2`}>
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="text-[11px] uppercase tracking-[0.12em] text-slate-500">{label}</dt>
          <dd className="mt-1 text-[15px] text-white">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function CompanyForm({ company, plans }: { company: Profile["company"]; plans: { id: string; name: string }[] }) {
  return (
    <form action={saveCustomerCompany} className={`${shell} grid gap-3 p-3 min-[900px]:grid-cols-2`}>
      <input type="hidden" name="companyId" value={company.id} />
      <label className="text-[12px] uppercase tracking-[0.12em] text-slate-400">{t("platform.name")}<input name="name" required defaultValue={company.name} className={field} /></label>
      <label className="text-[12px] uppercase tracking-[0.12em] text-slate-400">{t("platform.field.businessName")}<input name="businessName" defaultValue={company.businessName ?? ""} className={field} /></label>
      <label className="text-[12px] uppercase tracking-[0.12em] text-slate-400">{t("platform.field.vat")}<input name="vatNumber" defaultValue={company.vatNumber ?? ""} className={field} /></label>
      <label className="text-[12px] uppercase tracking-[0.12em] text-slate-400">{t("platform.field.taxCode")}<input name="taxCode" defaultValue={company.taxCode ?? ""} className={field} /></label>
      <label className="text-[12px] uppercase tracking-[0.12em] text-slate-400">{t("platform.field.pec")}<input name="pec" defaultValue={company.pec ?? ""} className={field} /></label>
      <label className="text-[12px] uppercase tracking-[0.12em] text-slate-400">{t("platform.field.email")}<input name="email" type="email" defaultValue={company.email ?? ""} className={field} /></label>
      <label className="text-[12px] uppercase tracking-[0.12em] text-slate-400">{t("platform.field.phone")}<input name="phone" defaultValue={company.phone ?? ""} className={field} /></label>
      <label className="text-[12px] uppercase tracking-[0.12em] text-slate-400">{t("platform.field.mobile")}<input name="mobile" defaultValue={company.mobile ?? ""} className={field} /></label>
      <label className="text-[12px] uppercase tracking-[0.12em] text-slate-400 min-[900px]:col-span-2">{t("platform.field.website")}<input name="website" defaultValue={company.website ?? ""} className={field} /></label>
      <label className="text-[12px] uppercase tracking-[0.12em] text-slate-400 min-[900px]:col-span-2">{t("platform.field.companyNotes")}<textarea name="notes" defaultValue={company.notes ?? ""} className={field} /></label>
      <CommercialFields
        className={field}
        plans={plans}
        planId={company.planId}
        billingCycle={company.billingCycle}
        monthly={company.monthlyRevenue?.toString() ?? "0"}
        discount={company.annualDiscountPercent.toString()}
      />
      <button className={action}>{t("platform.action.save")}</button>
    </form>
  );
}

function AddressForm({ company }: { company: Profile["company"] }) {
  return (
    <form action={saveCustomerAddress} className={`${shell} grid gap-3 p-3 min-[900px]:grid-cols-2`}>
      <input type="hidden" name="companyId" value={company.id} />
      <label className="text-[12px] uppercase tracking-[0.12em] text-slate-400 min-[900px]:col-span-2">{t("platform.field.address")}<input name="addressLine" defaultValue={company.addressLine ?? ""} className={field} /></label>
      <label className="text-[12px] uppercase tracking-[0.12em] text-slate-400">{t("platform.field.zip")}<input name="zipCode" defaultValue={company.zipCode ?? ""} className={field} /></label>
      <label className="text-[12px] uppercase tracking-[0.12em] text-slate-400">{t("platform.field.city")}<input name="city" defaultValue={company.city ?? ""} className={field} /></label>
      <label className="text-[12px] uppercase tracking-[0.12em] text-slate-400">{t("platform.field.province")}<input name="province" defaultValue={company.province ?? ""} className={field} /></label>
      <label className="text-[12px] uppercase tracking-[0.12em] text-slate-400">{t("platform.field.region")}<input name="region" defaultValue={company.region ?? ""} className={field} /></label>
      <label className="text-[12px] uppercase tracking-[0.12em] text-slate-400">{t("platform.field.country")}<input name="country" defaultValue={company.country ?? ""} className={field} /></label>
      <button className={action}>{t("platform.action.save")}</button>
    </form>
  );
}

function OwnerPanel({ profile }: { profile: Profile }) {
  const { company, owner } = profile;
  if (!owner) {
    return (
      <form action={assignCompanyOwner} className={`${shell} grid gap-3 p-3 min-[900px]:grid-cols-2`}>
        <input type="hidden" name="companyId" value={company.id} />
        <label className="text-[12px] uppercase tracking-[0.12em] text-slate-400">{t("platform.ownerName")}<input name="fullName" required className={field} /></label>
        <label className="text-[12px] uppercase tracking-[0.12em] text-slate-400">{t("platform.field.email")}<input name="email" type="email" required className={field} /></label>
        <label className="text-[12px] uppercase tracking-[0.12em] text-slate-400">{t("auth.password")}<input name="password" type="password" required minLength={8} className={field} /></label>
        <button className={`${action} self-end`}>{t("platform.assignOwner")}</button>
      </form>
    );
  }
  return (
    <div className="grid gap-3 min-[1000px]:grid-cols-[minmax(0,1fr)_280px]">
      <form action={saveOwnerContact} className={`${shell} grid gap-3 p-3`}>
        <input type="hidden" name="companyId" value={company.id} />
        <input type="hidden" name="userId" value={owner.id} />
        <label className="text-[12px] uppercase tracking-[0.12em] text-slate-400">{t("platform.ownerName")}<input name="fullName" defaultValue={personName(owner)} className={field} /></label>
        <p className="text-[13px] text-slate-300">{`${t("platform.field.email")}: ${owner.email}`}</p>
        <label className="text-[12px] uppercase tracking-[0.12em] text-slate-400">{t("platform.field.phone")}<input name="phone" defaultValue={owner.phone ?? ""} className={field} /></label>
        <p className="text-[13px] text-slate-300">{`${t("platform.field.accountStatus")}: ${owner.revokedAt ? t("platform.account.disabled") : t("platform.account.active")}`}</p>
        <p className="text-[13px] text-slate-300">{`${t("platform.field.lastLogin")}: ${owner.lastLoginAt ? dateLabel(owner.lastLoginAt) : t("platform.usage.unavailable")}`}</p>
        <p className="text-[13px] text-slate-300">{`${t("platform.field.createdAt")}: ${dateLabel(owner.createdAt)}`}</p>
        <button className={action}>{t("platform.action.save")}</button>
      </form>
      <div className="grid content-start gap-3">
        <form action={resetOwnerPassword} className={`${shell} grid gap-3 p-3`}>
          <input type="hidden" name="companyId" value={company.id} />
          <input type="hidden" name="userId" value={owner.id} />
          <label className="text-[12px] uppercase tracking-[0.12em] text-slate-400">{t("auth.password")}<input name="password" type="password" required minLength={8} className={field} /></label>
          <button className={action}>{t("platform.action.resetPassword")}</button>
        </form>
        {owner.revokedAt ? null : (
          <form action={disableOwnerAccount} className={`${shell} p-3`}>
            <input type="hidden" name="companyId" value={company.id} />
            <input type="hidden" name="userId" value={owner.id} />
            <button className="rounded-lg border border-[#FF9800]/50 px-3 py-2 text-[13px] text-[#FF9800]">{t("platform.action.disable")}</button>
          </form>
        )}
        <div className={`${shell} p-3`}><AccessLink companyId={company.id} userId={owner.id} /></div>
      </div>
    </div>
  );
}

function UsagePanel({ profile }: { profile: Profile }) {
  const rows = [
    ["platform.usage.users", String(profile.usage.users)],
    ["platform.usage.offices", t("platform.usage.unavailable")],
    ["platform.usage.orders", String(profile.usage.orders)],
    ["platform.usage.measurements", String(profile.usage.measurements)],
    ["platform.usage.machines", String(profile.usage.machines)],
    ["platform.usage.tools", String(profile.usage.tools)],
    ["platform.usage.storage", String(profile.usage.storage)],
    ["platform.usage.lastActivity", profile.usage.lastActivity ? dateLabel(profile.usage.lastActivity) : t("platform.usage.unavailable")],
  ] as const;
  return (
    <dl className={`${shell} grid gap-3 p-3 min-[800px]:grid-cols-4`}>
      {rows.map(([key, value]) => (
        <div key={key}><dt className="text-[11px] uppercase tracking-[0.12em] text-slate-500">{t(key)}</dt><dd className="text-[16px] text-white">{value}</dd></div>
      ))}
    </dl>
  );
}

function HistoryPanel({ profile }: { profile: Profile }) {
  if (profile.history.length === 0) return <p className={`${shell} px-3 py-8 text-center text-[13px] text-slate-400`}>{t("platform.history.empty")}</p>;
  return (
    <ul className={`${shell} grid gap-2 p-3`}>
      {profile.history.map((event) => (
        <li key={event.id} className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-slate-200">
          <span>{t(`platform.audit.${event.action}`)}</span>
          <span className="text-slate-400">{dateLabel(event.occurredAt)}</span>
        </li>
      ))}
    </ul>
  );
}

function DeletePanel({ profile }: { profile: Profile }) {
  return (
    <form action={deleteCustomerCompany} className={`${shell} grid max-w-xl gap-3 p-3`}>
      <h3 className="text-[16px] text-white">{t("platform.delete.title")}</h3>
      <p className="text-[14px] text-slate-200">{profile.company.name}</p>
      <p className="text-[13px] text-slate-300">{`${t("platform.owner")}: ${personName(profile.owner)}`}</p>
      <p className="text-[13px] text-slate-300">{`${t("platform.delete.orders")}: ${profile.activeOrders}`}</p>
      <p className="text-[13px] text-slate-300">{`${t("platform.delete.users")}: ${profile.activeUsers}`}</p>
      <label className="text-[12px] uppercase tracking-[0.12em] text-slate-400">{t("platform.delete.prompt")}<input name="confirmation" autoComplete="off" className={field} /></label>
      <input type="hidden" name="companyId" value={profile.company.id} />
      <button className="rounded-lg border border-[#FF4D4F]/50 px-3 py-2 text-[13px] text-[#FF4D4F]">{t("platform.delete")}</button>
    </form>
  );
}
