"use client";

import { useActionState } from "react";
import { t } from "@/lib/i18n";
import { prepareOwnerAccess } from "@/server/platform-actions";

export function AccessLink({ companyId, userId }: { companyId: string; userId: string }) {
  const [state, action, pending] = useActionState(prepareOwnerAccess, null);
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="userId" value={userId} />
      <button disabled={pending} className="rounded-lg border border-white/15 px-3 py-2 text-[13px] text-slate-100">{t("platform.action.sendCredentials")}</button>
      {state ? <p className="text-[12px] text-cyan-200">{t("platform.credentialsReady")}<a className="mt-1 block break-all text-white" href={state}>{state}</a></p> : null}
    </form>
  );
}
