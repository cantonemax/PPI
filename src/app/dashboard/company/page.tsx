import { RoleName } from "@prisma/client";
import { redirect } from "next/navigation";
import { AlarmSounds } from "@/app/dashboard/company/alarm-sounds";
import { OwnerFrame } from "@/app/dashboard/owner-home";
import { companyLogoSrc } from "@/app/dashboard/company-mark";
import { hasRole, requireMember } from "@/lib/access";
import { t } from "@/lib/i18n";
import { personName, positionLabel, todayLabel } from "@/lib/session-identity";
import { saveCompanyDesk } from "@/server/company-actions";

const sloganField = "h-10 w-full rounded-lg border border-white/15 bg-[#0b1830] px-3 text-slate-100 outline-none normal-case [color-scheme:dark]";

export default async function CompanyDeskPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { user, activeRoles } = await requireMember();
  if (!hasRole(activeRoles, RoleName.OWNER)) redirect("/dashboard");
  const { error } = await searchParams;
  const company = user.company;
  return (
    <OwnerFrame companyName={company.name} today={todayLabel()} person={{ name: personName(user), role: positionLabel(activeRoles) }} activeHref="/dashboard/company">
      <form action={saveCompanyDesk} className="mx-auto flex max-w-3xl flex-col px-4 py-6 font-sans text-[13px] uppercase tracking-[0.08em]">
        <h2 className="text-[26px] font-medium tracking-[0.08em] text-white">{t("company.title")}</h2>
        {error ? <p className="mt-4 text-[#FF4D4F]">{t(error)}</p> : null}
        <div className="mt-8 grid w-fit grid-cols-[140px_420px] items-center gap-x-8 gap-y-10">
          <img src={companyLogoSrc(company.logoKey)} alt="" className="h-20 w-[140px] object-contain object-left" />
          <label className="inline-flex w-fit cursor-pointer items-center rounded-full border border-cyan-300/40 bg-cyan-400/10 px-4 py-2 text-white">
            {t("company.uploadLogo")}
            <input name="logo" type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" />
          </label>
          <span>{t("company.slogan")}</span>
          <input name="slogan" defaultValue={company.slogan ?? ""} maxLength={80} className={sloganField} />
        </div>
        <div className="mt-14 flex flex-col gap-4">
          <fieldset className="flex flex-col gap-2">
            <legend>{t("company.appearance")}</legend>
            <label className="flex items-center gap-2"><input type="radio" name="appearance" value="DARK" defaultChecked={company.appearance === "DARK"} className="accent-[#3CF0FF]" />{t("company.appearance.dark")}</label>
            <label className="flex items-center gap-2"><input type="radio" name="appearance" value="FLOOR" defaultChecked={company.appearance === "FLOOR"} className="accent-[#3CF0FF]" />{t("company.appearance.floor")}</label>
          </fieldset>
          <label className="flex items-center gap-2">
            <input name="alarmSound" type="checkbox" defaultChecked={company.alarmSoundEnabled} className="h-4 w-4 accent-[#3CF0FF]" />
            {t("company.alarmSound")}
          </label>
          <AlarmSounds selected={company.alarmTone} />
          <label className="flex items-center gap-2">
            <input name="criticalScreen" type="checkbox" defaultChecked={company.criticalScreenEnabled} className="h-4 w-4 accent-[#3CF0FF]" />
            {t("company.criticalScreen")}
          </label>
          <button className="w-fit rounded-full border border-cyan-300/40 bg-cyan-400/10 px-4 py-2 text-white">{t("company.save")}</button>
        </div>
      </form>
    </OwnerFrame>
  );
}
