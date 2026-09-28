"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { resetPassword } from "@/server/auth-actions";
import { t } from "@/lib/i18n";

function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const [state, action, pending] = useActionState(resetPassword, null);
  return (
    <form action={action} className="mt-8 flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      <label className="text-sm">{t("auth.password")}<input name="password" type="password" required minLength={8} className="mt-1 w-full border border-stone-300 bg-white px-3 py-2" /></label>
      {state ? <p className="text-sm text-red-700">{t(state)}</p> : null}
      <button disabled={pending} className="bg-stone-900 px-4 py-2 text-white">{t("auth.reset")}</button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="text-3xl">{t("auth.reset")}</h1>
      <Suspense>
        <ResetForm />
      </Suspense>
    </main>
  );
}
