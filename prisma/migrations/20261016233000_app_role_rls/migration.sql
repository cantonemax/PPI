DO $body$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ppi_app') THEN
    CREATE ROLE ppi_app LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END
$body$;

GRANT USAGE ON SCHEMA public TO ppi_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ppi_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ppi_app;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ppi_app;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO ppi_app;

DO $body$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'ProductFamily', 'FamilyDimension', 'ArticleDimension', 'ArticleTool'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING ("companyId" = NULLIF(current_setting(''app.company_id'', true), '''')) WITH CHECK ("companyId" = NULLIF(current_setting(''app.company_id'', true), ''''))',
      table_name
    );
  END LOOP;
END
$body$;

CREATE OR REPLACE FUNCTION app_company_for_reset(token text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_user."companyId"
  FROM "AuthCredential" AS credential
  JOIN "User" AS tenant_user ON tenant_user.id = credential."userId"
  WHERE credential."resetTokenHash" = token
    AND credential."resetExpiresAt" IS NOT NULL
    AND credential."resetExpiresAt" > (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
    AND tenant_user."revokedAt" IS NULL
$$;

REVOKE ALL ON FUNCTION app_company_for_reset(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_company_for_reset(text) TO ppi_app;
