-- RBAC: add role to user_tenants (OWNER = full access, EDITOR = can post, VIEWER = read-only).
-- Run after 003_user_tenants.sql.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_tenants' AND column_name = 'role'
  ) THEN
    ALTER TABLE user_tenants
      ADD COLUMN role TEXT NOT NULL DEFAULT 'OWNER'
        CHECK (role IN ('OWNER', 'EDITOR', 'VIEWER'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_tenants_tenant_role ON user_tenants (tenant_id, role);
