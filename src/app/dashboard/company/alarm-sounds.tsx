"use client";

import { alarmToneFlags, alarmTones, playAlarm, type AlarmTone } from "@/lib/alarm-tones";
import { t } from "@/lib/i18n";

const roles: Record<AlarmTone, string> = {
  siren: "company.tone.siren.role",
  alarm: "company.tone.alarm.role",
  high: "company.tone.high.role",
  burst: "company.tone.burst.role",
};

export function AlarmSounds({ selected }: { selected: string }) {
  const flags = alarmToneFlags(selected);
  return (
    <fieldset className="flex flex-col gap-2">
      <legend>{t("company.tone")}</legend>
      {alarmTones.map((tone) => (
        <div key={tone} className="flex items-center gap-3">
          <label className="flex w-72 items-center gap-2">
            <input name={`tone.${tone}`} type="checkbox" defaultChecked={flags[tone]} className="h-4 w-4 accent-[#3CF0FF]" />
            <span>
              {t(`company.tone.${tone}`)}
              <span className="mt-0.5 block text-[11px] normal-case tracking-normal text-slate-400">{t(roles[tone])}</span>
            </span>
          </label>
          <button type="button" onClick={() => playAlarm(tone)} className="rounded-full border border-white/20 px-3 py-1 text-[12px] text-cyan-100">
            {t("company.tone.preview")}
          </button>
        </div>
      ))}
    </fieldset>
  );
}
