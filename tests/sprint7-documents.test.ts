import { afterAll, describe, expect, it } from "vitest";
import { clearSession } from "./next-mocks";
import * as documents from "@/server/document-actions";
import { signIn, signUp } from "@/server/auth-actions";
import { acceptInvitation, inviteUser } from "@/server/membership-actions";
import { cancelDraft, completeOrder, createDraftOrder, startOrder } from "@/server/order-actions";
import { createPart } from "@/server/part-actions";
import { prisma } from "@/lib/prisma";
import { GET } from "@/app/dashboard/documents/[kind]/[id]/route";
import CertificationsPage from "@/app/dashboard/quality/certifications/page";

function form(entries: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.append(key, value);
  return data;
}

async function call(run: () => Promise<unknown>) {
  try {
    await run();
    return "";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.startsWith("REDIRECT ")) return message.slice("REDIRECT ".length);
    throw error;
  }
}

async function asUser(email: string, password: string) {
  clearSession();
  await call(() => signIn(null, form({ email, password })));
}

function pdf(name: string) {
  const data = new FormData();
  data.set("file", new File(["pdf"], name, { type: "application/pdf" }));
  return data;
}

afterAll(async () => {
  await prisma.$disconnect();
  await (globalThis as { __ppiPg?: { stop: () => Promise<void> } }).__ppiPg?.stop();
});

describe("sprint 7 documents", () => {
  const password = "password-a";
  let draftId = "";
  let productionId = "";
  let completedId = "";
  let cancelledId = "";
  let drawingId = "";
  let technicalId = "";
  let certificationId = "";

  it("prepares two companies and the order phases", async () => {
    await call(() => signUp(null, form({ companyName: "Company A", timeUnit: "MINUTE", email: "owner-a@demo.test", password })));
    clearSession();
    await call(() => signUp(null, form({ companyName: "Company B", timeUnit: "MINUTE", email: "owner-b@demo.test", password })));
    await asUser("owner-a@demo.test", password);
    for (const [email, role] of [
      ["pm-a@demo.test", "PRODUCTION_MANAGER"],
      ["qm-a@demo.test", "QUALITY_MANAGER"],
      ["op-a@demo.test", "OPERATOR"],
    ] as const) {
      const link = await inviteUser(null, form({ email, roles: role }));
      clearSession();
      await call(() => acceptInvitation(null, form({ token: String(link).split("/invite/")[1] ?? "", password })));
      await asUser("owner-a@demo.test", password);
    }
    await call(() => createPart(null, form({ name: "PERNO" })));
    const part = await prisma.part.findFirstOrThrow({ where: { name: "PERNO" } });
    const make = async () => {
      await call(() => createDraftOrder(null, form({ partId: part.id, targetQuantity: "10", timePerPiece: "1" })));
      return (await prisma.productionOrder.findFirstOrThrow({ where: { partId: part.id }, orderBy: { id: "desc" } })).id;
    };
    draftId = await make();
    productionId = await make();
    await call(() => startOrder(form({ orderId: productionId })));
    completedId = await make();
    await call(() => startOrder(form({ orderId: completedId })));
    await call(() => completeOrder(form({ orderId: completedId })));
    cancelledId = await make();
    await call(() => cancelDraft(form({ orderId: cancelledId })));
    expect(draftId).not.toBe(cancelledId);
  });

  it("allows owner and production manager drawings and rejects the others", async () => {
    await asUser("owner-a@demo.test", password);
    const data = pdf("owner.pdf");
    data.set("orderId", draftId);
    expect(await call(() => documents.uploadDrawing(data))).toBe(`/dashboard/orders/${draftId}`);
    drawingId = (await prisma.drawing.findFirstOrThrow({ where: { productionOrderId: draftId } })).id;

    await asUser("pm-a@demo.test", password);
    const pm = pdf("pm.pdf");
    pm.set("orderId", productionId);
    expect(await call(() => documents.uploadDrawing(pm))).toBe(`/dashboard/orders/${productionId}`);

    await asUser("qm-a@demo.test", password);
    const qm = pdf("qm.pdf");
    qm.set("orderId", productionId);
    expect(await call(() => documents.uploadDrawing(qm))).toBe("/dashboard");

    await asUser("op-a@demo.test", password);
    const op = pdf("op.pdf");
    op.set("orderId", productionId);
    expect(await call(() => documents.uploadDrawing(op))).toBe("/dashboard");

    await asUser("owner-a@demo.test", password);
    const cancelled = pdf("no.pdf");
    cancelled.set("orderId", cancelledId);
    expect(await call(() => documents.uploadDrawing(cancelled))).toContain("documents.rejected");
  });

  it("allows owner and production manager technical documents and rejects the others", async () => {
    await asUser("owner-a@demo.test", password);
    const data = pdf("tech.pdf");
    data.set("orderId", draftId);
    expect(await call(() => documents.uploadTechnicalDocument(data))).toBe(`/dashboard/orders/${draftId}`);
    technicalId = (await prisma.technicalDocument.findFirstOrThrow({ where: { productionOrderId: draftId } })).id;

    await asUser("pm-a@demo.test", password);
    const pm = pdf("tech-pm.pdf");
    pm.set("orderId", productionId);
    expect(await call(() => documents.uploadTechnicalDocument(pm))).toBe(`/dashboard/orders/${productionId}`);

    await asUser("qm-a@demo.test", password);
    const qm = pdf("tech-qm.pdf");
    qm.set("orderId", productionId);
    expect(await call(() => documents.uploadTechnicalDocument(qm))).toBe("/dashboard");

    await asUser("op-a@demo.test", password);
    const op = pdf("tech-op.pdf");
    op.set("orderId", productionId);
    expect(await call(() => documents.uploadTechnicalDocument(op))).toBe("/dashboard");

    await asUser("owner-a@demo.test", password);
    const cancelled = pdf("tech-no.pdf");
    cancelled.set("orderId", cancelledId);
    expect(await call(() => documents.uploadTechnicalDocument(cancelled))).toContain("documents.rejected");
  });

  it("allows production notes except on a cancelled order", async () => {
    await asUser("owner-a@demo.test", password);
    for (const orderId of [draftId, productionId, completedId]) {
      expect(await call(() => documents.addProductionNote(form({ orderId, body: "nota" })))).toBe(`/dashboard/orders/${orderId}`);
    }
    expect(await call(() => documents.addProductionNote(form({ orderId: cancelledId, body: "no" })))).toContain("documents.rejected");
  });

  it("uploads certifications only for owner and quality manager in production or completed", async () => {
    await asUser("owner-a@demo.test", password);
    const draft = pdf("cert-draft.pdf");
    draft.set("orderId", draftId);
    expect(await call(() => documents.uploadCertification(draft))).toContain("documents.rejected");
    const cancelled = pdf("cert-cancelled.pdf");
    cancelled.set("orderId", cancelledId);
    expect(await call(() => documents.uploadCertification(cancelled))).toContain("documents.rejected");

    const live = pdf("cert-live.pdf");
    live.set("orderId", productionId);
    expect(await call(() => documents.uploadCertification(live))).toBe(`/dashboard/orders/${productionId}`);
    certificationId = (await prisma.certification.findFirstOrThrow({ where: { productionOrderId: productionId } })).id;

    await asUser("qm-a@demo.test", password);
    const qmLive = pdf("cert-qm.pdf");
    qmLive.set("orderId", productionId);
    expect(await call(() => documents.uploadCertification(qmLive))).toBe(`/dashboard/orders/${productionId}`);

    await asUser("owner-a@demo.test", password);
    const done = pdf("cert-done.pdf");
    done.set("orderId", completedId);
    expect(await call(() => documents.uploadCertification(done))).toBe(`/dashboard/orders/${completedId}`);

    await asUser("qm-a@demo.test", password);
    const qmDone = pdf("cert-qm-done.pdf");
    qmDone.set("orderId", completedId);
    expect(await call(() => documents.uploadCertification(qmDone))).toBe(`/dashboard/orders/${completedId}`);

    await asUser("pm-a@demo.test", password);
    const pm = pdf("cert-pm.pdf");
    pm.set("orderId", productionId);
    expect(await call(() => documents.uploadCertification(pm))).toBe("/dashboard");

    await asUser("op-a@demo.test", password);
    const op = pdf("cert-op.pdf");
    op.set("orderId", productionId);
    expect(await call(() => documents.uploadCertification(op))).toBe("/dashboard");
  });

  it("shows certifications only to owner and quality manager", async () => {
    await asUser("owner-a@demo.test", password);
    expect(await call(() => CertificationsPage())).toBe("");
    await asUser("qm-a@demo.test", password);
    expect(await call(() => CertificationsPage())).toBe("");
    await asUser("pm-a@demo.test", password);
    expect(await call(() => CertificationsPage())).toBe("/dashboard");
    await asUser("op-a@demo.test", password);
    expect(await call(() => CertificationsPage())).toBe("/dashboard");
  });

  it("does not expose certification update or delete", () => {
    expect(Object.keys(documents).sort()).toEqual([
      "addProductionNote",
      "uploadCertification",
      "uploadDrawing",
      "uploadTechnicalDocument",
    ]);
  });

  it("downloads documents only for the authorized role and company", async () => {
    const download = (kind: string, id: string) => GET(new Request("http://localhost/download"), { params: Promise.resolve({ kind, id }) });
    await asUser("owner-a@demo.test", password);
    expect((await download("drawing", drawingId)).status).toBe(200);
    expect((await download("technical-document", technicalId)).status).toBe(200);
    await asUser("qm-a@demo.test", password);
    expect((await download("certification", certificationId)).status).toBe(200);
    await asUser("pm-a@demo.test", password);
    expect((await download("certification", certificationId)).status).toBe(403);
    await asUser("op-a@demo.test", password);
    expect((await download("certification", certificationId)).status).toBe(403);

    await asUser("owner-b@demo.test", password);
    expect((await download("drawing", drawingId)).status).not.toBe(200);
    expect((await download("technical-document", technicalId)).status).not.toBe(200);
    expect((await download("certification", certificationId)).status).not.toBe(200);
  });
});
