import { RoleName } from "@prisma/client";
import { NextResponse } from "next/server";
import { hasRole, requireMember } from "@/lib/access";
import { readObject } from "@/lib/object-storage";
import { withTenant } from "@/lib/prisma";

function mediaType(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  return "";
}

async function floorMayRead(companyId: string, userId: string, orderId: string) {
  return withTenant(companyId, async (tx) => {
    const current = await tx.user.findFirst({
      where: { id: userId, companyId },
      include: { activeProductionOrder: { include: { machineTimes: { where: { endedAt: null }, take: 1 } } } },
    });
    const machineId = current?.activeProductionOrder?.machineTimes[0]?.machineId ?? null;
    const order = await tx.productionOrder.findFirst({
      where: {
        id: orderId,
        companyId,
        hiddenAt: null,
        OR: [
          { assignedOperatorId: userId },
          ...(current?.activeProductionOrderId ? [{ id: current.activeProductionOrderId }] : []),
          ...(machineId ? [{ estimate: { is: { machineId } } }] : []),
        ],
      },
      select: { id: true },
    });
    return Boolean(order);
  });
}

const kinds = {
  drawing: "drawing",
  "technical-document": "technicalDocument",
  certification: "certification",
} as const;

export async function GET(_request: Request, context: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await context.params;
  const model = kinds[kind as keyof typeof kinds];
  if (!model) return new NextResponse(null, { status: 404 });

  const member = await requireMember();
  const owner = hasRole(member.activeRoles, RoleName.OWNER);
  const planner = owner || hasRole(member.activeRoles, RoleName.PRODUCTION_MANAGER);
  const quality = owner || hasRole(member.activeRoles, RoleName.QUALITY_MANAGER);
  const floor = owner || hasRole(member.activeRoles, RoleName.OPERATOR);

  const file = await withTenant(member.session.companyId, async (tx) => {
    if (model === "drawing") return tx.drawing.findFirst({ where: { id, companyId: member.session.companyId }, include: { productionOrder: true } });
    if (model === "technicalDocument") {
      return tx.technicalDocument.findFirst({ where: { id, companyId: member.session.companyId }, include: { productionOrder: true } });
    }
    return tx.certification.findFirst({ where: { id, companyId: member.session.companyId }, include: { productionOrder: true } });
  });
  if (!file) return new NextResponse(null, { status: 404 });

  if (model === "certification") {
    if (!quality) return new NextResponse(null, { status: 403 });
  } else if (planner) {
    // Owner and Production Manager open documents from the order.
  } else if (floor && await floorMayRead(member.session.companyId, member.user.id, file.productionOrderId)) {
  } else {
    return new NextResponse(null, { status: 403 });
  }

  const bytes = await readObject(file.storageKey);
  const name = file.fileName.replace(/[\r\n"]/g, "");
  const inline = new URL(_request.url).searchParams.get("inline") === "1";
  const type = mediaType(name);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": inline && type ? type : "application/octet-stream",
      "Content-Disposition": `${inline && type ? "inline" : "attachment"}; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
