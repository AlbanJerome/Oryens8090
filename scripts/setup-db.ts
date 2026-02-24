/**
 * WO-GL-010: Idempotent database schema initialization
 * Run: npx tsx scripts/setup-db.ts [DATABASE_URL]
 * If DATABASE_URL is omitted, SQL is printed to stdout.
 * Requires: PostgreSQL. Optional dependency "pg" for direct execution.
 */

const DDL_STATEMENTS: string[] = [
  `-- Oryens General Ledger schema (idempotent)
  CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    code VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    account_type VARCHAR(32) NOT NULL,
    normal_balance VARCHAR(8) NOT NULL,
    parent_account_id UUID,
    is_system_controlled BOOLEAN DEFAULT FALSE,
    allows_intercompany BOOLEAN DEFAULT FALSE,
    required_approval_above_cents BIGINT,
    default_cost_center VARCHAR(64),
    default_project_id UUID,
    tax_category VARCHAR(64),
    external_mapping JSONB DEFAULT '{}',
    created_by UUID NOT NULL,
    deleted_at TIMESTAMPTZ,
    UNIQUE(tenant_id, code)
  );`,
  `CREATE INDEX IF NOT EXISTS idx_accounts_tenant ON accounts(tenant_id);`,
  `CREATE INDEX IF NOT EXISTS idx_accounts_deleted_at ON accounts(deleted_at) WHERE deleted_at IS NULL;`,

  `CREATE TABLE IF NOT EXISTS journal_entries (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    entity_id UUID NOT NULL,
    posting_date DATE NOT NULL,
    source_module VARCHAR(64) NOT NULL,
    source_document_id UUID NOT NULL,
    source_document_type VARCHAR(64) NOT NULL,
    description TEXT NOT NULL,
    is_intercompany BOOLEAN DEFAULT FALSE,
    counterparty_entity_id UUID,
    valid_time_start TIMESTAMPTZ NOT NULL,
    reversal_of UUID,
    version INT DEFAULT 1,
    created_by UUID,
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    idempotency_key VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
  );`,
  `CREATE INDEX IF NOT EXISTS idx_journal_entries_tenant_entity ON journal_entries(tenant_id, entity_id);`,
  `CREATE INDEX IF NOT EXISTS idx_journal_entries_posting_date ON journal_entries(posting_date);`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_journal_entries_idempotency ON journal_entries(tenant_id, idempotency_key) WHERE idempotency_key IS NOT NULL;`,

  `CREATE TABLE IF NOT EXISTS journal_entry_lines (
    id UUID PRIMARY KEY,
    entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_code VARCHAR(64) NOT NULL,
    debit_amount_cents BIGINT NOT NULL DEFAULT 0,
    credit_amount_cents BIGINT NOT NULL DEFAULT 0,
    cost_center VARCHAR(64),
    description TEXT
  );`,
  `CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_entry ON journal_entry_lines(entry_id);`,
  `CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_account ON journal_entry_lines(account_code);`,

  `CREATE TABLE IF NOT EXISTS temporal_balances (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    entity_id UUID NOT NULL,
    account_code VARCHAR(64) NOT NULL,
    balance_cents BIGINT NOT NULL,
    currency VARCHAR(8) NOT NULL,
    valid_time_start TIMESTAMPTZ NOT NULL,
    valid_time_end TIMESTAMPTZ NOT NULL,
    transaction_time_start TIMESTAMPTZ NOT NULL,
    transaction_time_end TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
  );`,
  `CREATE INDEX IF NOT EXISTS idx_temporal_balances_lookup ON temporal_balances(tenant_id, entity_id, account_code);`,
  `CREATE INDEX IF NOT EXISTS idx_temporal_balances_valid ON temporal_balances(valid_time_start, valid_time_end);`,

  `CREATE TABLE IF NOT EXISTS accounting_periods (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    name VARCHAR(32) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(16) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    UNIQUE(tenant_id, name)
  );`,
  `CREATE INDEX IF NOT EXISTS idx_accounting_periods_tenant ON accounting_periods(tenant_id);`,

  `CREATE TABLE IF NOT EXISTS idempotency_records (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    idempotency_key VARCHAR(255) NOT NULL,
    command_type VARCHAR(64) NOT NULL,
    result JSONB NOT NULL,
    executed_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    UNIQUE(tenant_id, idempotency_key)
  );`,
  `CREATE INDEX IF NOT EXISTS idx_idempotency_tenant_key ON idempotency_records(tenant_id, idempotency_key);`,

  `CREATE TABLE IF NOT EXISTS entities (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    parent_entity_id UUID,
    ownership_percentage NUMERIC(5,2) NOT NULL,
    consolidation_method VARCHAR(32) NOT NULL,
    currency VARCHAR(8) DEFAULT 'USD',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
  );`,
  `CREATE INDEX IF NOT EXISTS idx_entities_tenant_parent ON entities(tenant_id, parent_entity_id);`,
];

async function runWithPg(connectionString: string): Promise<void> {
  try {
    const { default: pg } = await import('pg');
    const client = new pg.Client({ connectionString });
    await client.connect();
    for (const stmt of DDL_STATEMENTS) {
      const trimmed = stmt.trim();
      if (!trimmed) continue;
      await client.query(trimmed);
    }
    await client.end();
    console.error('Schema initialized successfully.');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ERR_MODULE_NOT_FOUND' && (e as NodeJS.ErrnoException).message?.includes('pg')) {
      console.error('Optional dependency "pg" not installed. Run: npm install pg');
      console.error('Or pipe SQL to your client: npx tsx scripts/setup-db.ts > schema.sql');
      process.exit(1);
    }
    throw e;
  }
}

function printSql(): void {
  for (const stmt of DDL_STATEMENTS) {
    const trimmed = stmt.trim();
    if (!trimmed) continue;
    console.log(trimmed.endsWith(';') ? trimmed : trimmed + ';');
  }
}

const dbUrl = process.argv[2] ?? process.env.DATABASE_URL;
if (dbUrl) {
  runWithPg(dbUrl).catch((e) => {
    console.error(e);
    process.exit(1);
  });
} else {
  printSql();
}
