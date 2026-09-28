import Link from "next/link";
import { t } from "@/lib/i18n";

export default function PausedPage() {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4">
      <h1 className="text-3xl">{t("phase.paused")}</h1>
      <p className="text-stone-600">{t("phase.pausedDetail")}</p>
      <Link href="/dashboard" className="text-stone-900 underline">{t("phase.back")}</Link>
    </main>
  );
}
