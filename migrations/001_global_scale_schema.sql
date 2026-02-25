-- Global Scale: metadata on journal entries/lines, tenant locale & currency
-- Run this migration against your Postgres database.

-- Tenants table: id matches tenant_id used across entities/journal_entries
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  currency_code TEXT NOT NULL DEFAULT 'USD',
  locale TEXT NOT NULL DEFAULT 'en-US',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add metadata JSONB to journal_entries
ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Add metadata JSONB to journal_entry_lines
ALTER TABLE journal_entry_lines
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Optional: backfill tenants from existing tenant_id values (e.g. from entities or journal_entries)
-- INSERT INTO tenants (id, currency_code, locale)
-- SELECT DISTINCT tenant_id, 'USD', 'en-US' FROM journal_entries
-- ON CONFLICT (id) DO NOTHING;
