"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signIn } from "@/server/auth-actions";
import { t } from "@/lib/i18n";

export default function LoginPage() {
  const [state, action, pending] = useActionState(signIn, null);
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <p className="text-sm text-stone-500">{t("product.tagline")}</p>
      <h1 className="mt-2 text-3xl">{t("product.name")}</h1>
      <form action={action} className="mt-8 flex flex-col gap-3">
        <label className="text-sm">{t("auth.email")}<input name="email" type="email" required className="mt-1 w-full border border-stone-300 bg-white px-3 py-2" /></label>
        <label className="text-sm">{t("auth.password")}<input name="password" type="password" required className="mt-1 w-full border border-stone-300 bg-white px-3 py-2" /></label>
        {state ? <p className="text-sm text-red-700">{t(state)}</p> : null}
        <button disabled={pending} className="bg-stone-900 px-4 py-2 text-white">{t("auth.signIn")}</button>
      </form>
      <p className="mt-4 text-sm"><Link href="/forgot-password">{t("auth.forgot")}</Link></p>
      <p className="mt-2 text-sm"><Link href="/signup">{t("auth.noAccount")}</Link></p>
    </main>
  );
}
