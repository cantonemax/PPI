import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const companies = await prisma.company.findMany({ select: { id: true, name: true } });
const cleared = [];

for (const company of companies) {
  const counts = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.company_id', ${company.id}, true)`;
    await tx.user.updateMany({ data: { activeProductionOrderId: null } });
    const measurements = await tx.measurement.deleteMany();
    await tx.control.deleteMany();
    await tx.controlPlan.deleteMany();
    await tx.drawing.deleteMany();
    await tx.technicalDocument.deleteMany();
    await tx.productionNote.deleteMany();
    await tx.certification.deleteMany();
    const scrap = await tx.scrap.deleteMany();
    const toolChanges = await tx.toolChange.deleteMany();
    await tx.materialConsumption.deleteMany();
    await tx.machineTime.deleteMany();
    await tx.pause.deleteMany();
    await tx.downtime.deleteMany();
    await tx.estimateToolUse.deleteMany();
    await tx.estimateMaterialUse.deleteMany();
    await tx.estimate.deleteMany();
    await tx.actual.deleteMany();
    const orders = await tx.productionOrder.deleteMany();
    return { orders: orders.count, measurements: measurements.count, scrap: scrap.count, toolChanges: toolChanges.count };
  });
  cleared.push({ name: company.name, ...counts });
}

for (const row of cleared) {
  console.log(`${row.name}: orders ${row.orders}, measurements ${row.measurements}, scrap ${row.scrap}, tool changes ${row.toolChanges}`);
}
await prisma.$disconnect();
