import { AuditAction, AuditActorKind, AuditSubjectType } from "@prisma/client";
import type { Db } from "@/lib/prisma";

export async function recordAudit(
  db: Db,
  input: {
    companyId: string;
    actorUserId: string | null;
    action: AuditAction;
    subjectType: AuditSubjectType;
    subjectId: string;
    actorKind?: AuditActorKind;
  },
): Promise<void> {
  await db.auditEvent.create({
    data: {
      companyId: input.companyId,
      actorKind: input.actorKind ?? AuditActorKind.USER,
      actorUserId: input.actorUserId,
      action: input.action,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      occurredAt: new Date(),
    },
  });
}
