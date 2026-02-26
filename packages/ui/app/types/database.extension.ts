/**
 * Database row types for API routes (Supabase-style helper pattern).
 * Use Tables<'table_name'> for row types; use Pg*Row for query result shapes where they differ.
 */

/** Raw account row from accounts table */
export interface PgAccountRow {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  account_type: string;
  normal_balance: string;
  created_by: string;
}

/** Raw audit_log row (with optional join columns) */
export interface PgAuditLogRow {
  id: string;
  tenant_id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  payload: unknown;
  created_at: Date | string;
  entity_name?: string | null;
}

/** Raw accounting_periods row */
export interface PgAccountingPeriodRow {
  id: string;
  tenant_id: string;
  name: string;
  start_date: Date | string;
  end_date: Date | string;
  status: string;
}

/** Journal entry line row as returned by journal-lines query (with joins) */
export interface PgJournalLineResultRow {
  id: string;
  entry_id: string;
  posting_date: Date | string;
  description: string | null;
  entity_id: string;
  entity_name: string | null;
  account_code: string;
  debit_amount_cents: number | string;
  credit_amount_cents: number | string;
  transaction_amount_cents?: number | string | null;
  transaction_currency_code?: string | null;
  exchange_rate?: number | string | null;
}

/** journal_entries table row (for Tables<> and triggers) */
export interface JournalEntriesRow {
  id: string;
  tenant_id: string;
  entity_id: string;
  posting_date: Date | string;
  source_module: string;
  source_document_id: string;
  source_document_type: string;
  description: string;
  is_intercompany?: boolean;
  counterparty_entity_id?: string | null;
  valid_time_start: Date | string;
  reversal_of?: string | null;
  version?: number | null;
  created_by?: string | null;
  approved_by?: string | null;
  approved_at?: Date | string | null;
  idempotency_key?: string | null;
  created_at?: Date | string | null;
  metadata?: unknown;
}

/** journal_entry_lines table row */
export interface JournalEntryLinesRow {
  id: string;
  entry_id: string;
  account_code: string;
  debit_amount_cents: number;
  credit_amount_cents: number;
  cost_center?: string | null;
  description?: string | null;
  metadata?: unknown;
  transaction_amount_cents?: number | null;
  transaction_currency_code?: string | null;
  exchange_rate?: number | string | null;
}

/** audit_log table row */
export interface AuditLogTableRow {
  id: string;
  tenant_id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  payload: Record<string, unknown>;
  created_at: Date | string;
}

export interface Database {
  public: {
    Tables: {
      journal_entries: { Row: JournalEntriesRow };
      journal_entry_lines: { Row: JournalEntryLinesRow };
      audit_log: { Row: AuditLogTableRow };
      accounts: { Row: PgAccountRow };
      accounting_periods: { Row: PgAccountingPeriodRow };
    };
  };
}

/** Supabase-style helper: get Row type for a table name */
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
