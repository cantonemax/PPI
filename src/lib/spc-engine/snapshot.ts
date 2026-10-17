import { Prisma } from "@prisma/client";
import type { Db } from "@/lib/prisma";
import { updateOwned } from "@/lib/tenant-write";
import { PpiSpcEngine, type SpcInput, type SpcResult } from "@/lib/spc-engine/ppi-spc-engine";

export async function writeFeatureSpc(tx: Db, input: SpcInput & {
  companyId: string;
  productionOrderId: string;
  controlId: string;
}): Promise<SpcResult> {
  const result = new PpiSpcEngine().evaluate(input);
  const data = {
    companyId: input.companyId,
    productionOrderId: input.productionOrderId,
    machineId: input.machineId ?? null,
    toolId: input.toolId ?? null,
    insufficientData: result.insufficientData,
    sampleSize: result.sampleSize,
    mean: decimal(result.mean),
    median: decimal(result.median),
    variance: decimal(result.variance),
    sigma: decimal(result.sigma),
    minimum: decimal(result.min),
    maximum: decimal(result.max),
    range: decimal(result.range),
    coefficientOfVariation: decimal(result.coefficientOfVariation),
    cp: decimal(result.cp),
    cpk: decimal(result.cpk),
    ucl: decimal(result.ucl),
    lcl: decimal(result.lcl),
    trendSlope: decimal(result.trendSlope),
    trendDirection: result.trendDirection,
    processState: result.processState,
    calculatedAt: new Date(),
  };
  const existing = await tx.featureSpc.findFirst({ where: { controlId: input.controlId, companyId: input.companyId } });
  if (existing) await updateOwned(tx.featureSpc, existing.id, input.companyId, data);
  else await tx.featureSpc.create({ data: { ...data, controlId: input.controlId } });
  return result;
}

function decimal(value: number | null) {
  if (value === null || !Number.isFinite(value)) return null;
  return new Prisma.Decimal(value.toFixed(10));
}
