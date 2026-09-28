"use client";

import { useActionState } from "react";
import { acceptInvitation } from "@/server/membership-actions";
import { t } from "@/lib/i18n";

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="text-3xl">{t("invite.title")}</h1>
      <InviteForm params={params} />
    </main>
  );
}

function InviteForm({ params }: { params: Promise<{ token: string }> }) {
  const [state, action, pending] = useActionState(acceptInvitation, null);
  return (
    <form
      action={async (formData) => {
        const { token } = await params;
        formData.set("token", token);
        await action(formData);
      }}
      className="mt-8 flex flex-col gap-3"
    >
      <label className="text-sm">{t("auth.password")}<input name="password" type="password" required minLength={8} className="mt-1 w-full border border-stone-300 bg-white px-3 py-2" /></label>
      {state ? <p className="text-sm text-red-700">{t(state)}</p> : null}
      <button disabled={pending} className="bg-stone-900 px-4 py-2 text-white">{t("invite.accept")}</button>
    </form>
  );
}
