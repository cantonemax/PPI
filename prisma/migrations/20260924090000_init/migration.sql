-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RoleName" AS ENUM ('OWNER', 'PRODUCTION_MANAGER', 'QUALITY_MANAGER', 'OPERATOR');

-- CreateEnum
CREATE TYPE "OrderPhase" AS ENUM ('DRAFT', 'IN_PRODUCTION', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TimeUnit" AS ENUM ('MINUTE', 'HOUR');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('COMPANY_CREATED', 'COMPANY_CLOSED', 'INVITATION_CREATED', 'INVITATION_ACCEPTED', 'INVITATION_REVOKED', 'ROLE_ASSIGNED', 'ROLE_REVOKED', 'USER_REVOKED', 'LOGIN', 'LOGOUT', 'ORDER_CREATED', 'ORDER_STARTED', 'ORDER_CANCELLED', 'ORDER_START_UNDONE', 'ORDER_COMPLETED', 'ORDER_REOPENED', 'ORDER_COMPLETED_AGAIN', 'ESTIMATE_FROZEN', 'ACTUAL_CORRECTED', 'RESOURCE_RETIRED', 'BREAK_GLASS', 'PRODUCTION_RECORDED', 'SCRAP_RECORDED', 'PAUSE_STARTED', 'PAUSE_ENDED', 'DOWNTIME_STARTED', 'DOWNTIME_ENDED', 'ACTIVE_ORDER_CHANGED', 'TOOL_CHANGED', 'MATERIAL_CONSUMED', 'MACHINE_TIME_RECORDED', 'MACHINE_CHANGED', 'CONTROL_CREATED', 'CONTROL_UPDATED', 'MEASUREMENT_RECORDED');

-- CreateEnum
CREATE TYPE "AuditSubjectType" AS ENUM ('COMPANY', 'USER', 'INVITATION', 'ROLE_ASSIGNMENT', 'PRODUCTION_ORDER', 'PART', 'MACHINE', 'TOOL', 'MATERIAL');

-- CreateEnum
CREATE TYPE "AuditActorKind" AS ENUM ('USER', 'PLATFORM');

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timeUnit" "TimeUnit" NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "activeProductionOrderId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleAssignment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "RoleName" NOT NULL,
    "economicAuthority" BOOLEAN NOT NULL DEFAULT false,
    "assignedAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "RoleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthCredential" (
    "userId" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "resetTokenHash" TEXT,
    "resetExpiresAt" TIMESTAMP(3),

    CONSTRAINT "AuthCredential_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvitationRole" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "invitationId" TEXT NOT NULL,
    "role" "RoleName" NOT NULL,

    CONSTRAINT "InvitationRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Part" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "retiredAt" TIMESTAMP(3),
    "hiddenAt" TIMESTAMP(3),

    CONSTRAINT "Part_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Machine" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hourlyRate" DECIMAL(18,6) NOT NULL,
    "retiredAt" TIMESTAMP(3),
    "hiddenAt" TIMESTAMP(3),

    CONSTRAINT "Machine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tool" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "unitCost" DECIMAL(18,6) NOT NULL,
    "retiredAt" TIMESTAMP(3),
    "hiddenAt" TIMESTAMP(3),

    CONSTRAINT "Tool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "unitCost" DECIMAL(18,6) NOT NULL,
    "retiredAt" TIMESTAMP(3),
    "hiddenAt" TIMESTAMP(3),

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionOrder" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "phase" "OrderPhase" NOT NULL DEFAULT 'DRAFT',
    "targetQuantity" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "hiddenAt" TIMESTAMP(3),

    CONSTRAINT "ProductionOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Estimate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "timePerPiece" DECIMAL(18,6),
    "expectedScrap" DECIMAL(18,6),
    "machineId" TEXT,
    "hourlyRateSnapshot" DECIMAL(18,6),
    "otherOperationalCost" DECIMAL(18,6),
    "agreedOperationalValue" DECIMAL(18,6),

    CONSTRAINT "Estimate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EstimateToolUse" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "unitCost" DECIMAL(18,6) NOT NULL,

    CONSTRAINT "EstimateToolUse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EstimateMaterialUse" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "unitCost" DECIMAL(18,6) NOT NULL,

    CONSTRAINT "EstimateMaterialUse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Actual" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "goodQuantity" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Actual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MachineTime" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "hourlyRateSnapshot" DECIMAL(18,6) NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "MachineTime_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scrap" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "pieceCount" INTEGER NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scrap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pause" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "Pause_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Downtime" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "Downtime_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToolChange" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "unitCost" DECIMAL(18,6) NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ToolChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialConsumption" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "unitCost" DECIMAL(18,6) NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialConsumption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ControlPlan" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,

    CONSTRAINT "ControlPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Control" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "controlPlanId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nominal" DECIMAL(18,6) NOT NULL,
    "lowerLimit" DECIMAL(18,6) NOT NULL,
    "upperLimit" DECIMAL(18,6) NOT NULL,

    CONSTRAINT "Control_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Measurement" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "value" DECIMAL(18,6) NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Measurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Drawing" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Drawing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechnicalDocument" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TechnicalDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionNote" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certification" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Certification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "actorKind" "AuditActorKind" NOT NULL,
    "actorUserId" TEXT,
    "action" "AuditAction" NOT NULL,
    "subjectType" "AuditSubjectType" NOT NULL,
    "subjectId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "breakGlassReason" TEXT,
    "breakGlassUntil" TIMESTAMP(3),

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Company_closedAt_idx" ON "Company"("closedAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_companyId_idx" ON "User"("companyId");

-- CreateIndex
CREATE INDEX "User_activeProductionOrderId_idx" ON "User"("activeProductionOrderId");

-- CreateIndex
CREATE INDEX "RoleAssignment_companyId_idx" ON "RoleAssignment"("companyId");

-- CreateIndex
CREATE INDEX "RoleAssignment_companyId_role_idx" ON "RoleAssignment"("companyId", "role");

-- CreateIndex
CREATE INDEX "RoleAssignment_userId_role_revokedAt_idx" ON "RoleAssignment"("userId", "role", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuthCredential_resetTokenHash_key" ON "AuthCredential"("resetTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");

-- CreateIndex
CREATE INDEX "Invitation_companyId_email_idx" ON "Invitation"("companyId", "email");

-- CreateIndex
CREATE INDEX "Invitation_companyId_expiresAt_idx" ON "Invitation"("companyId", "expiresAt");

-- CreateIndex
CREATE INDEX "InvitationRole_companyId_idx" ON "InvitationRole"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "InvitationRole_invitationId_role_key" ON "InvitationRole"("invitationId", "role");

-- CreateIndex
CREATE INDEX "Part_companyId_hiddenAt_idx" ON "Part"("companyId", "hiddenAt");

-- CreateIndex
CREATE INDEX "Part_companyId_retiredAt_idx" ON "Part"("companyId", "retiredAt");

-- CreateIndex
CREATE INDEX "Machine_companyId_hiddenAt_idx" ON "Machine"("companyId", "hiddenAt");

-- CreateIndex
CREATE INDEX "Machine_companyId_retiredAt_idx" ON "Machine"("companyId", "retiredAt");

-- CreateIndex
CREATE INDEX "Tool_companyId_hiddenAt_idx" ON "Tool"("companyId", "hiddenAt");

-- CreateIndex
CREATE INDEX "Tool_companyId_retiredAt_idx" ON "Tool"("companyId", "retiredAt");

-- CreateIndex
CREATE INDEX "Material_companyId_hiddenAt_idx" ON "Material"("companyId", "hiddenAt");

-- CreateIndex
CREATE INDEX "Material_companyId_retiredAt_idx" ON "Material"("companyId", "retiredAt");

-- CreateIndex
CREATE INDEX "ProductionOrder_companyId_phase_idx" ON "ProductionOrder"("companyId", "phase");

-- CreateIndex
CREATE INDEX "ProductionOrder_companyId_partId_phase_idx" ON "ProductionOrder"("companyId", "partId", "phase");

-- CreateIndex
CREATE INDEX "ProductionOrder_companyId_hiddenAt_idx" ON "ProductionOrder"("companyId", "hiddenAt");

-- CreateIndex
CREATE UNIQUE INDEX "Estimate_productionOrderId_key" ON "Estimate"("productionOrderId");

-- CreateIndex
CREATE INDEX "Estimate_companyId_idx" ON "Estimate"("companyId");

-- CreateIndex
CREATE INDEX "Estimate_machineId_idx" ON "Estimate"("machineId");

-- CreateIndex
CREATE INDEX "EstimateToolUse_companyId_idx" ON "EstimateToolUse"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "EstimateToolUse_estimateId_toolId_key" ON "EstimateToolUse"("estimateId", "toolId");

-- CreateIndex
CREATE INDEX "EstimateMaterialUse_companyId_idx" ON "EstimateMaterialUse"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "EstimateMaterialUse_estimateId_materialId_key" ON "EstimateMaterialUse"("estimateId", "materialId");

-- CreateIndex
CREATE UNIQUE INDEX "Actual_productionOrderId_key" ON "Actual"("productionOrderId");

-- CreateIndex
CREATE INDEX "Actual_companyId_idx" ON "Actual"("companyId");

-- CreateIndex
CREATE INDEX "MachineTime_companyId_idx" ON "MachineTime"("companyId");

-- CreateIndex
CREATE INDEX "MachineTime_productionOrderId_startedAt_idx" ON "MachineTime"("productionOrderId", "startedAt");

-- CreateIndex
CREATE INDEX "MachineTime_machineId_idx" ON "MachineTime"("machineId");

-- CreateIndex
CREATE INDEX "Scrap_companyId_idx" ON "Scrap"("companyId");

-- CreateIndex
CREATE INDEX "Scrap_productionOrderId_occurredAt_idx" ON "Scrap"("productionOrderId", "occurredAt");

-- CreateIndex
CREATE INDEX "Pause_companyId_idx" ON "Pause"("companyId");

-- CreateIndex
CREATE INDEX "Pause_productionOrderId_startedAt_idx" ON "Pause"("productionOrderId", "startedAt");

-- CreateIndex
CREATE INDEX "Downtime_companyId_idx" ON "Downtime"("companyId");

-- CreateIndex
CREATE INDEX "Downtime_productionOrderId_startedAt_idx" ON "Downtime"("productionOrderId", "startedAt");

-- CreateIndex
CREATE INDEX "Downtime_machineId_startedAt_idx" ON "Downtime"("machineId", "startedAt");

-- CreateIndex
CREATE INDEX "ToolChange_companyId_idx" ON "ToolChange"("companyId");

-- CreateIndex
CREATE INDEX "ToolChange_productionOrderId_occurredAt_idx" ON "ToolChange"("productionOrderId", "occurredAt");

-- CreateIndex
CREATE INDEX "ToolChange_toolId_idx" ON "ToolChange"("toolId");

-- CreateIndex
CREATE INDEX "MaterialConsumption_companyId_idx" ON "MaterialConsumption"("companyId");

-- CreateIndex
CREATE INDEX "MaterialConsumption_productionOrderId_occurredAt_idx" ON "MaterialConsumption"("productionOrderId", "occurredAt");

-- CreateIndex
CREATE INDEX "MaterialConsumption_materialId_idx" ON "MaterialConsumption"("materialId");

-- CreateIndex
CREATE UNIQUE INDEX "ControlPlan_productionOrderId_key" ON "ControlPlan"("productionOrderId");

-- CreateIndex
CREATE INDEX "ControlPlan_companyId_idx" ON "ControlPlan"("companyId");

-- CreateIndex
CREATE INDEX "Control_companyId_idx" ON "Control"("companyId");

-- CreateIndex
CREATE INDEX "Control_controlPlanId_idx" ON "Control"("controlPlanId");

-- CreateIndex
CREATE INDEX "Measurement_companyId_idx" ON "Measurement"("companyId");

-- CreateIndex
CREATE INDEX "Measurement_productionOrderId_recordedAt_idx" ON "Measurement"("productionOrderId", "recordedAt");

-- CreateIndex
CREATE INDEX "Measurement_controlId_idx" ON "Measurement"("controlId");

-- CreateIndex
CREATE INDEX "Drawing_companyId_idx" ON "Drawing"("companyId");

-- CreateIndex
CREATE INDEX "Drawing_productionOrderId_idx" ON "Drawing"("productionOrderId");

-- CreateIndex
CREATE INDEX "TechnicalDocument_companyId_idx" ON "TechnicalDocument"("companyId");

-- CreateIndex
CREATE INDEX "TechnicalDocument_productionOrderId_idx" ON "TechnicalDocument"("productionOrderId");

-- CreateIndex
CREATE INDEX "ProductionNote_companyId_idx" ON "ProductionNote"("companyId");

-- CreateIndex
CREATE INDEX "ProductionNote_productionOrderId_idx" ON "ProductionNote"("productionOrderId");

-- CreateIndex
CREATE INDEX "Certification_companyId_idx" ON "Certification"("companyId");

-- CreateIndex
CREATE INDEX "Certification_productionOrderId_idx" ON "Certification"("productionOrderId");

-- CreateIndex
CREATE INDEX "AuditEvent_companyId_occurredAt_idx" ON "AuditEvent"("companyId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditEvent_companyId_subjectType_subjectId_idx" ON "AuditEvent"("companyId", "subjectType", "subjectId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_activeProductionOrderId_fkey" FOREIGN KEY ("activeProductionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthCredential" ADD CONSTRAINT "AuthCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvitationRole" ADD CONSTRAINT "InvitationRole_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvitationRole" ADD CONSTRAINT "InvitationRole_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "Invitation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Part" ADD CONSTRAINT "Part_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Machine" ADD CONSTRAINT "Machine_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tool" ADD CONSTRAINT "Tool_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateToolUse" ADD CONSTRAINT "EstimateToolUse_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateToolUse" ADD CONSTRAINT "EstimateToolUse_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateToolUse" ADD CONSTRAINT "EstimateToolUse_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "Tool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateMaterialUse" ADD CONSTRAINT "EstimateMaterialUse_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateMaterialUse" ADD CONSTRAINT "EstimateMaterialUse_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateMaterialUse" ADD CONSTRAINT "EstimateMaterialUse_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Actual" ADD CONSTRAINT "Actual_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Actual" ADD CONSTRAINT "Actual_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineTime" ADD CONSTRAINT "MachineTime_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineTime" ADD CONSTRAINT "MachineTime_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineTime" ADD CONSTRAINT "MachineTime_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scrap" ADD CONSTRAINT "Scrap_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scrap" ADD CONSTRAINT "Scrap_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pause" ADD CONSTRAINT "Pause_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pause" ADD CONSTRAINT "Pause_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Downtime" ADD CONSTRAINT "Downtime_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Downtime" ADD CONSTRAINT "Downtime_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Downtime" ADD CONSTRAINT "Downtime_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolChange" ADD CONSTRAINT "ToolChange_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolChange" ADD CONSTRAINT "ToolChange_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolChange" ADD CONSTRAINT "ToolChange_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "Tool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialConsumption" ADD CONSTRAINT "MaterialConsumption_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialConsumption" ADD CONSTRAINT "MaterialConsumption_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialConsumption" ADD CONSTRAINT "MaterialConsumption_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControlPlan" ADD CONSTRAINT "ControlPlan_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControlPlan" ADD CONSTRAINT "ControlPlan_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Control" ADD CONSTRAINT "Control_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Control" ADD CONSTRAINT "Control_controlPlanId_fkey" FOREIGN KEY ("controlPlanId") REFERENCES "ControlPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Measurement" ADD CONSTRAINT "Measurement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Measurement" ADD CONSTRAINT "Measurement_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Measurement" ADD CONSTRAINT "Measurement_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "Control"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Drawing" ADD CONSTRAINT "Drawing_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Drawing" ADD CONSTRAINT "Drawing_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnicalDocument" ADD CONSTRAINT "TechnicalDocument_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnicalDocument" ADD CONSTRAINT "TechnicalDocument_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionNote" ADD CONSTRAINT "ProductionNote_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionNote" ADD CONSTRAINT "ProductionNote_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certification" ADD CONSTRAINT "Certification_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certification" ADD CONSTRAINT "Certification_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Tenant constraints Prisma cannot express.
-- A new database receives this SQL from the initial migration.
-- Statements are idempotent for a database created earlier with db push.

CREATE UNIQUE INDEX IF NOT EXISTS role_assignment_open_unique
  ON "RoleAssignment" ("userId", "role")
  WHERE "revokedAt" IS NULL;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'User', 'RoleAssignment', 'Invitation', 'InvitationRole', 'AuditEvent',
    'Part', 'Machine', 'Tool', 'Material', 'ProductionOrder', 'Estimate',
    'EstimateToolUse', 'EstimateMaterialUse', 'Actual', 'Scrap', 'Pause',
    'Downtime', 'ToolChange', 'MaterialConsumption', 'MachineTime',
    'ControlPlan', 'Control', 'Measurement', 'Certification',
    'Drawing', 'TechnicalDocument', 'ProductionNote', 'AuthCredential'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', table_name);
  END LOOP;
END $$;

CREATE POLICY tenant_isolation ON "User"
  USING (
    "companyId" = NULLIF(current_setting('app.company_id', true), '')
    OR "email" = NULLIF(current_setting('app.login_email', true), '')
  )
  WITH CHECK ("companyId" = NULLIF(current_setting('app.company_id', true), ''));

CREATE POLICY tenant_isolation ON "Invitation"
  USING (
    "companyId" = NULLIF(current_setting('app.company_id', true), '')
    OR "tokenHash" = NULLIF(current_setting('app.invite_token', true), '')
  )
  WITH CHECK ("companyId" = NULLIF(current_setting('app.company_id', true), ''));

CREATE POLICY tenant_isolation ON "AuthCredential"
  USING (
    "resetTokenHash" = NULLIF(current_setting('app.reset_token', true), '')
    OR EXISTS (
      SELECT 1 FROM "User" AS tenant_user
      WHERE tenant_user.id = "AuthCredential"."userId"
        AND (
          tenant_user."companyId" = NULLIF(current_setting('app.company_id', true), '')
          OR tenant_user.email = NULLIF(current_setting('app.login_email', true), '')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "User" AS tenant_user
      WHERE tenant_user.id = "AuthCredential"."userId"
        AND tenant_user."companyId" = NULLIF(current_setting('app.company_id', true), '')
    )
  );

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'RoleAssignment', 'InvitationRole', 'AuditEvent',
    'Part', 'Machine', 'Tool', 'Material', 'ProductionOrder', 'Estimate',
    'EstimateToolUse', 'EstimateMaterialUse', 'Actual', 'Scrap', 'Pause',
    'Downtime', 'ToolChange', 'MaterialConsumption', 'MachineTime',
    'ControlPlan', 'Control', 'Measurement', 'Certification',
    'Drawing', 'TechnicalDocument', 'ProductionNote'
  ]
  LOOP
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING ("companyId" = NULLIF(current_setting(''app.company_id'', true), '''')) WITH CHECK ("companyId" = NULLIF(current_setting(''app.company_id'', true), ''''))',
      table_name
    );
  END LOOP;
END $$;
