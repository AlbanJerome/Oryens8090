-- User–tenant mapping for auth: which tenants a user can access.
-- user_id is the Supabase auth.users.id (UUID).
-- role: OWNER (full access), EDITOR (can post), VIEWER (read-only).
-- Run after 001_global_scale_schema.sql.

CREATE TABLE IF NOT EXISTS user_tenants (
  user_id UUID NOT NULL,
  tenant_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'OWNER' CHECK (role IN ('OWNER', 'EDITOR', 'VIEWER')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_user_tenants_user_id ON user_tenants (user_id);
CREATE INDEX IF NOT EXISTS idx_user_tenants_tenant_id ON user_tenants (tenant_id);
