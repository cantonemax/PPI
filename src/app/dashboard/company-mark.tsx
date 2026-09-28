import { requireMember } from "@/lib/access";

export async function CompanyBrand({ stacked = false }: { stacked?: boolean }) {
  const { user } = await requireMember();
  return <CompanyMark slogan={user.company.slogan} logoSrc={companyLogoSrc(user.company.logoKey)} stacked={stacked} />;
}

export function CompanyMark({ slogan, logoSrc, stacked = false }: { slogan: string | null; logoSrc: string; stacked?: boolean }) {
  return (
    <div className={stacked ? "ppi-brand flex flex-col items-center gap-2" : "ppi-brand flex items-center gap-3"}>
      <img src={logoSrc} alt="" className={stacked ? "h-[88px] w-auto max-w-full object-contain" : "h-14 w-auto max-w-[160px] object-contain"} />
      {slogan ? <p className={stacked ? "whitespace-nowrap text-center text-[12px] uppercase tracking-[0.04em] text-cyan-200" : "max-w-[320px] text-[13px] font-semibold uppercase leading-4 tracking-[0.04em] text-[color:var(--ppi-slogan,#a5f3fc)]"}>{slogan}</p> : null}
    </div>
  );
}

export function companyLogoSrc(logoKey: string | null) {
  return logoKey ? "/dashboard/company/logo" : "/brand/ditec-logo.png";
}
