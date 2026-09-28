import { OrderPhase } from "@prisma/client";
import { t } from "@/lib/i18n";
import { uploadCertification } from "@/server/document-actions";

export function CertificationSection({
  orderId,
  phase,
  rows,
}: {
  orderId: string;
  phase: OrderPhase;
  rows: { id: string; fileName: string }[];
}) {
  const open = phase === OrderPhase.IN_PRODUCTION || phase === OrderPhase.COMPLETED;
  return (
    <section className="rounded-2xl border border-white/10 bg-[#0b1830]/75 p-4 text-[13px] uppercase tracking-[0.06em] text-slate-300 shadow-[0_16px_40px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.07)]">
      <h2 className="text-[15px] uppercase tracking-[0.16em] text-cyan-200">{t("documents.certifications")}</h2>
      {rows.length === 0 ? <p className="mt-2">{t("documents.empty")}</p> : null}
      <ul className="mt-2 flex flex-col gap-1">
        {rows.map((row) => (
          <li key={row.id}>
            <a href={`/dashboard/documents/certification/${row.id}`} className="text-cyan-200">{row.fileName}</a>
          </li>
        ))}
      </ul>
      {open ? (
        <form action={uploadCertification} className="mt-3 flex items-center gap-2">
          <input type="hidden" name="orderId" value={orderId} />
          <input name="file" type="file" required className="text-sm" />
          <button className="rounded-full border border-cyan-300/40 bg-cyan-400/10 px-4 py-2 text-white">{t("documents.upload")}</button>
        </form>
      ) : null}
    </section>
  );
}
