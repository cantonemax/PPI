"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { createOperator } from "@/server/operator-setup-actions";
import { t } from "@/lib/i18n";

function OperatorForm() {
  const [state, action, pending] = useActionState(createOperator, null);
  const params = useSearchParams();
  const created = params.get("created") === "1";
  const loginId = params.get("login");
  return (
    <main className="mx-auto flex max-w-lg flex-col gap-4 px-6 py-8">
      <h1 className="text-3xl">{t("setup.operator")}</h1>
      <p className="text-sm text-stone-600">{t("setup.operatorLead")}</p>
      {created ? (
        <p className="text-sm text-emerald-700">
          {t("setup.operatorCreated")}
          {loginId ? ` ${t("setup.operatorLogin")}: ${loginId}` : null}
        </p>
      ) : null}
      <form action={action} className="flex flex-col gap-3">
        <label className="text-sm">{t("setup.operatorName")}<input name="firstName" required className="mt-1 w-full border border-stone-300 bg-white px-3 py-2" /></label>
        <label className="text-sm">{t("setup.operatorLastName")}<input name="lastName" required className="mt-1 w-full border border-stone-300 bg-white px-3 py-2" /></label>
        <label className="text-sm">{t("auth.password")}<input name="password" type="password" required minLength={8} className="mt-1 w-full border border-stone-300 bg-white px-3 py-2" /></label>
        {state ? <p className="text-sm text-red-700">{t(state)}</p> : null}
        <button disabled={pending} className="bg-stone-900 px-4 py-2 text-white">{t("setup.operator")}</button>
      </form>
    </main>
  );
}

export default function OperatorsPage() {
  return (
    <Suspense>
      <OperatorForm />
    </Suspense>
  );
}
