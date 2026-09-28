"use client";

import { useActionState } from "react";
import { requestPasswordReset } from "@/server/auth-actions";
import { t } from "@/lib/i18n";

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(requestPasswordReset, null);
  const isLink = state?.startsWith("http");
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="text-3xl">{t("auth.forgot")}</h1>
      <form action={action} className="mt-8 flex flex-col gap-3">
        <label className="text-sm">{t("auth.email")}<input name="email" type="email" required className="mt-1 w-full border border-stone-300 bg-white px-3 py-2" /></label>
        <button disabled={pending} className="bg-stone-900 px-4 py-2 text-white">{t("auth.reset")}</button>
      </form>
      {state ? <p className="mt-4 text-sm">{isLink ? <a href={state}>{state}</a> : t(state)}</p> : null}
    </main>
  );
}
