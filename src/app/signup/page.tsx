"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUp } from "@/server/auth-actions";
import { t } from "@/lib/i18n";
import { timeControlsPaused } from "@/lib/service-phase";

export default function SignUpPage() {
  const [state, action, pending] = useActionState(signUp, null);
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="text-3xl">{t("auth.signUp")}</h1>
      <form action={action} className="mt-8 flex flex-col gap-3">
        <label className="text-sm">{t("auth.companyName")}<input name="companyName" required className="mt-1 w-full border border-stone-300 bg-white px-3 py-2" /></label>
        {timeControlsPaused ? <input type="hidden" name="timeUnit" value="MINUTE" /> : (
          <label className="text-sm">{t("auth.timeUnit")}
            <select name="timeUnit" className="mt-1 w-full border border-stone-300 bg-white px-3 py-2">
              <option value="MINUTE">{t("auth.timeUnit.minute")}</option>
              <option value="HOUR">{t("auth.timeUnit.hour")}</option>
            </select>
          </label>
        )}
        <label className="text-sm">{t("auth.email")}<input name="email" type="email" required className="mt-1 w-full border border-stone-300 bg-white px-3 py-2" /></label>
        <label className="text-sm">{t("auth.password")}<input name="password" type="password" required minLength={8} className="mt-1 w-full border border-stone-300 bg-white px-3 py-2" /></label>
        {state ? <p className="text-sm text-red-700">{t(state)}</p> : null}
        <button disabled={pending} className="bg-stone-900 px-4 py-2 text-white">{t("auth.signUp")}</button>
      </form>
      <p className="mt-4 text-sm"><Link href="/login">{t("auth.hasAccount")}</Link></p>
    </main>
  );
}
