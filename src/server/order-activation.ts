import { AuditAction, AuditSubjectType, OrderPhase } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { recordAudit } from "@/lib/audit";
import { prisma, withTenant, type Db } from "@/lib/prisma";

export async function activateDraft(
  tx: Db,
  companyId: string,
  orderId: string,
  actorUserId: string | null,
  requireTime: boolean,
  startedAt = new Date(),
): Promise<string | null> {
  const order = await tx.productionOrder.findFirst({
    where: { id: orderId, companyId, phase: OrderPhase.DRAFT, hiddenAt: null },
    include: { estimate: { include: { toolUses: true, materialUses: true, machine: true } } },
  });
  if (!order?.estimate) return "common.required";
  if (requireTime && !order.estimate.timePerPiece) return "order.timeRequired";
  for (const use of order.estimate.toolUses) {
    const tool = await tx.tool.findFirst({ where: { id: use.toolId, companyId } });
    if (!tool) return "common.required";
    await tx.estimateToolUse.update({ where: { id: use.id }, data: { unitCost: tool.unitCost } });
  }
  for (const use of order.estimate.materialUses) {
    const material = await tx.material.findFirst({ where: { id: use.materialId, companyId } });
    if (!material) return "common.required";
    await tx.estimateMaterialUse.update({ where: { id: use.id }, data: { unitCost: material.unitCost } });
  }
  await tx.estimate.update({
    where: { id: order.estimate.id },
    data: { hourlyRateSnapshot: order.estimate.machine?.hourlyRate ?? null },
  });
  await tx.actual.create({
    data: { companyId, productionOrderId: order.id, goodQuantity: 0 },
  });
  await tx.productionOrder.update({
    where: { id: order.id },
    data: {
      phase: OrderPhase.IN_PRODUCTION,
      startedAt,
      scheduledStartAt: null,
      scheduledStartByUserId: null,
    },
  });
  await recordAudit(tx, {
    companyId,
    actorUserId,
    action: AuditAction.ORDER_STARTED,
    subjectType: AuditSubjectType.PRODUCTION_ORDER,
    subjectId: order.id,
  });
  return null;
}

export async function promoteDueOrders(companyId?: string): Promise<void> {
  try {
    const now = new Date();
    const companies = companyId ? [{ id: companyId }] : await prisma.company.findMany({ select: { id: true } });
    for (const company of companies) {
      const due = await withTenant(company.id, (tx) => tx.productionOrder.findMany({
        where: {
          companyId: company.id,
          phase: OrderPhase.DRAFT,
          hiddenAt: null,
          scheduledStartAt: { lte: now },
        },
        select: { id: true, scheduledStartByUserId: true, scheduledStartAt: true },
      }));
      for (const order of due) {
        const error = await withTenant(company.id, (tx) => activateDraft(
          tx,
          company.id,
          order.id,
          order.scheduledStartByUserId,
          false,
          order.scheduledStartAt ?? now,
        ));
        if (error) continue;
        revalidatePath("/dashboard/orders");
        revalidatePath(`/dashboard/orders/${order.id}`);
        revalidatePath("/dashboard");
      }
    }
  } catch {
    return;
  }
}
