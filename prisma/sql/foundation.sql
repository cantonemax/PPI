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
