/**
 * POST /api/tenants/[tenantId]/seed-sample
 * Creates sample journal entries for testing. Requires at least one entity and two accounts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { assertUserCanAccessTenant, getRequestUserTenantRows } from '@/app/lib/tenant-guard';
import {
  CreateJournalEntryCommandHandler,
  CreateJournalEntryCommandValidator,
  JournalEntryService,
  IdempotencyService,
  AuditLoggerService,
  Account,
  AccountNotFoundError,
  PeriodClosedError,
  JournalEntryError,
  type PgClient,
  type IApplyJournalEntry,
} from '@oryens/core';
import { toLocalDateString } from '@/app/lib/date-utils';
import type { PgAccountRow } from '@/app/types/database.extension';

interface JournalEntryLineLike {
  id: string;
  entryId: string;
  accountCode: string;
  debitAmount: { toCents(): number };
  creditAmount: { toCents(): number };
  description?: string;
  metadata?: Record<string, unknown>;
  transactionAmountCents?: number;
  transactionCurrencyCode?: string;
  exchangeRate?: number;
}

interface JournalEntryLike {
  id: string;
  tenantId: string;
  entityId: string;
  postingDate: Date;
  sourceModule: string;
  sourceDocumentId: string;
  sourceDocumentType: string;
  description: string;
  isIntercompany?: boolean;
  validTimeStart?: Date;
  version?: number;
  createdBy?: string;
  metadata?: Record<string, unknown>;
  lines: readonly JournalEntryLineLike[];
}

function createJournalEntryRepo(client: PgClient) {
  return {
    save: async (entry: JournalEntryLike) => {
      const entryMeta = (entry as { metadata?: Record<string, unknown> }).metadata;
      await client.query(
        `INSERT INTO journal_entries (id, tenant_id, entity_id, posting_date, source_module, source_document_id, source_document_type, description, is_intercompany, valid_time_start, version, created_by, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb)`,
        [
          entry.id,
          entry.tenantId,
          entry.entityId,
          entry.postingDate,
          entry.sourceModule,
          entry.sourceDocumentId,
          entry.sourceDocumentType,
          entry.description,
          entry.isIntercompany ?? false,
          entry.validTimeStart ?? entry.postingDate,
          entry.version ?? 1,
          entry.createdBy ?? null,
          entryMeta != null ? JSON.stringify(entryMeta) : '{}',
        ]
      );
      for (const line of entry.lines) {
        const lineMeta = (line as { metadata?: Record<string, unknown> }).metadata;
        const tx = line as { transactionAmountCents?: number; transactionCurrencyCode?: string; exchangeRate?: number };
        await client.query(
          `INSERT INTO journal_entry_lines (id, entry_id, account_code, debit_amount_cents, credit_amount_cents, description, metadata, transaction_amount_cents, transaction_currency_code, exchange_rate)
           VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10)`,
          [
            line.id,
            line.entryId,
            line.accountCode,
            line.debitAmount.toCents(),
            line.creditAmount.toCents(),
            line.description ?? null,
            lineMeta != null ? JSON.stringify(lineMeta) : '{}',
            tx.transactionAmountCents ?? null,
            tx.transactionCurrencyCode ?? null,
            tx.exchangeRate ?? null,
          ]
        );
      }
    },
    findById: async () => null,
    findByIdempotencyKey: async () => null,
    findIntercompanyTransactions: async () => [],
    getTrialBalanceData: async () => [],
  };
}

function createAccountRepo(client: PgClient, tenantId: string) {
  const rowToAccount = (r: PgAccountRow) =>
    new Account({
      id: r.id,
      tenantId: r.tenant_id,
      code: r.code,
      name: r.name,
      accountType: r.account_type as 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense',
      normalBalance: r.normal_balance as 'Debit' | 'Credit',
      createdBy: r.created_by,
    });
  return {
    findById: async (_t: string, accountId: string) => {
      const res = await client.query(
        'SELECT id, tenant_id, code, name, account_type, normal_balance, created_by FROM accounts WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL',
        [tenantId, accountId]
      );
      const r = res.rows[0];
      return r ? rowToAccount(r as unknown as PgAccountRow) : null;
    },
    findByCode: async (_t: string, accountCode: string) => {
      const res = await client.query(
        'SELECT id, tenant_id, code, name, account_type, normal_balance, created_by FROM accounts WHERE tenant_id = $1 AND code = $2 AND deleted_at IS NULL',
        [tenantId, accountCode]
      );
      const r = res.rows[0];
      return r ? rowToAccount(r as unknown as PgAccountRow) : null;
    },
    findByCodes: async (_t: string, codes: string[]) => {
      if (codes.length === 0) return [];
      const res = await client.query(
        `SELECT id, tenant_id, code, name, account_type, normal_balance, created_by FROM accounts WHERE tenant_id = $1 AND code = ANY($2) AND deleted_at IS NULL`,
        [tenantId, codes]
      );
      return (res.rows as unknown as PgAccountRow[]).map(rowToAccount);
    },
  };
}

function createPeriodRepo(client: PgClient, tenantId: string) {
  return {
    canPostToDate: async (_t: string, date: Date) => {
      const dateStr = toLocalDateString(date);
      const res = await client.query(
        `SELECT id, tenant_id, name, start_date, end_date, status FROM accounting_periods WHERE tenant_id = $1 AND $2::date >= start_date AND $2::date <= end_date ORDER BY end_date DESC LIMIT 1`,
        [tenantId, dateStr]
      );
      type PeriodRow = { id: string; tenant_id: string; name: string; start_date: Date; end_date: Date; status: string };
      const r = res.rows[0] as unknown as PeriodRow | undefined;
      if (!r) {
        return { allowed: false, period: null, reason: 'No period found for date' };
      }
      const status = r.status as 'OPEN' | 'SOFT_CLOSED' | 'HARD_CLOSED';
      const allowed = status === 'OPEN';
      return {
        allowed,
        period: {
          id: r.id,
          tenantId: r.tenant_id,
          name: r.name,
          startDate: r.start_date,
          endDate: r.end_date,
          status,
        },
        reason: allowed ? undefined : `Period ${r.name} is ${status}`,
      };
    },
  };
}

function createAuditLogRepo(client: PgClient) {
  return {
    append: async (entry: { tenantId: string; userId?: string; action: string; entityType?: string | null; entityId?: string | null; payload?: unknown }) => {
      await client.query(
        `INSERT INTO audit_log (tenant_id, user_id, action, entity_type, entity_id, payload)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
        [
          entry.tenantId,
          entry.userId ?? null,
          entry.action,
          entry.entityType ?? null,
          entry.entityId ?? null,
          JSON.stringify(entry.payload ?? {}),
        ]
      );
    },
  };
}

const SAMPLE_ENTRIES: Array<{ description: string; debitCents: number; creditCents: number }> = [
  { description: 'Sample: Office supplies', debitCents: 15000, creditCents: 15000 },
  { description: 'Sample: Rent payment', debitCents: 500000, creditCents: 500000 },
  { description: 'Sample: Client invoice payment', debitCents: 200000, creditCents: 200000 },
  { description: 'Sample: Loan drawdown', debitCents: 1000000, creditCents: 1000000 },
  { description: 'Sample: Payroll', debitCents: 80000, creditCents: 80000 },
];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  const forbidden = await assertUserCanAccessTenant(request, tenantId);
  if (forbidden) return forbidden;
  const userRows = await getRequestUserTenantRows(request);
  const role = userRows.find((r) => r.tenantId === tenantId)?.role ?? 'VIEWER';
  if (role === 'VIEWER') {
    return NextResponse.json(
      { error: 'Forbidden: only EDITOR or OWNER can populate sample data.' },
      { status: 403 }
    );
  }

  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error('DATABASE_URL is not defined');

    const pg = await import('pg');
    const client = new pg.default.Client({ connectionString: dbUrl }) as unknown as PgClient & { connect(): Promise<void>; end(): Promise<void> };
    await client.connect();

    try {
      const entitiesRes = await client.query(
        `SELECT id FROM entities WHERE tenant_id = $1 ORDER BY (parent_entity_id IS NULL) DESC, name LIMIT 1`,
        [tenantId]
      );
      const entityId = (entitiesRes.rows[0] as { id?: string } | undefined)?.id;
      if (!entityId) {
        return NextResponse.json(
          { error: 'No entity found. Create an entity first (e.g. from the Entities page).' },
          { status: 400 }
        );
      }

      const accountsRes = await client.query(
        `SELECT id, code, account_type FROM accounts WHERE tenant_id = $1 AND deleted_at IS NULL ORDER BY code`,
        [tenantId]
      );
      const accounts = accountsRes.rows as unknown as { id: string; code: string; account_type: string }[];
      if (accounts.length < 2) {
        return NextResponse.json(
          { error: 'At least two accounts are required. Add accounts in Chart of Accounts first.' },
          { status: 400 }
        );
      }

      const now = new Date();
      const todayStr = toLocalDateString(now);
      const periodRes = await client.query(
        `SELECT id, start_date, end_date, status FROM accounting_periods WHERE tenant_id = $1 AND $2::date >= start_date AND $2::date <= end_date AND status = 'OPEN' ORDER BY end_date DESC LIMIT 1`,
        [tenantId, todayStr]
      );
      let postingDateStr = todayStr;
      if (periodRes.rows.length === 0) {
        const recentStart = toLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1));
        const recentEnd = toLocalDateString(new Date(now.getFullYear(), now.getMonth() + 1, 0));
        const fallbackId = '00000000-0000-0000-0000-000000000001';
        await client.query(
          `INSERT INTO accounting_periods (id, tenant_id, name, start_date, end_date, status)
           VALUES ($1, $2, $3, $4::date, $5::date, 'OPEN')
           ON CONFLICT (tenant_id, name) DO UPDATE SET start_date = $4::date, end_date = $5::date`,
          [fallbackId, tenantId, 'Current (fallback)', recentStart, recentEnd]
        );
      }

      const assetCodes = accounts.filter((a) => (a.account_type || '').toLowerCase() === 'asset').map((a) => a.code);
      const expenseCodes = accounts.filter((a) => (a.account_type || '').toLowerCase() === 'expense').map((a) => a.code);
      const revenueCodes = accounts.filter((a) => (a.account_type || '').toLowerCase() === 'revenue').map((a) => a.code);
      const liabilityCodes = accounts.filter((a) => (a.account_type || '').toLowerCase() === 'liability').map((a) => a.code);
      const codeA = assetCodes[0] ?? accounts[0].code;
      const codeB = expenseCodes[0] ?? revenueCodes[0] ?? liabilityCodes[0] ?? accounts[1].code;

      const journalEntryRepo = createJournalEntryRepo(client);
      const accountRepo = createAccountRepo(client, tenantId);
      const periodRepo = createPeriodRepo(client, tenantId);
      const auditLogRepo = createAuditLogRepo(client);
      const idempotencyRepo = { findByKey: async () => null, save: async () => {} };
      const eventBus = { publish: async () => {} };
      const temporalBalanceService: IApplyJournalEntry = { applyJournalEntry: async () => {} };
      const journalEntryService = new JournalEntryService(periodRepo);
      const auditLogger = new AuditLoggerService(auditLogRepo);
      const handler = new CreateJournalEntryCommandHandler(
        journalEntryRepo,
        accountRepo,
        periodRepo,
        temporalBalanceService,
        eventBus,
        new IdempotencyService(idempotencyRepo),
        journalEntryService,
        auditLogger
      );

      const journalEntryIds: string[] = [];
      for (let i = 0; i < SAMPLE_ENTRIES.length; i++) {
        const sample = SAMPLE_ENTRIES[i];
        const debitCode = i % 2 === 0 ? codeB : codeA;
        const creditCode = i % 2 === 0 ? codeA : codeB;
        const command = {
          tenantId,
          entityId,
          postingDate: new Date(postingDateStr),
          sourceModule: 'MANUAL' as const,
          sourceDocumentId: `seed-sample-${i + 1}-${crypto.randomUUID()}`,
          sourceDocumentType: 'JOURNAL',
          description: sample.description,
          currency: 'USD' as const,
          lines: [
            { accountCode: debitCode, debitAmountCents: sample.debitCents, creditAmountCents: 0 },
            { accountCode: creditCode, debitAmountCents: 0, creditAmountCents: sample.creditCents },
          ],
        };
        const validation = CreateJournalEntryCommandValidator.validate(command);
        if (!validation.isValid) continue;
        const result = await handler.handle(command);
        if (result.isSuccess && result.journalEntryId) journalEntryIds.push(result.journalEntryId);
      }

      return NextResponse.json({
        created: journalEntryIds.length,
        journalEntryIds,
        message: `Created ${journalEntryIds.length} sample journal entries.`,
      });
    } finally {
      await client.end();
    }
  } catch (error: unknown) {
    console.error('Seed sample API error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    const isClientError =
      error instanceof AccountNotFoundError ||
      error instanceof PeriodClosedError ||
      (error instanceof JournalEntryError && (error as { code?: string }).code === 'NO_PERIOD_FOUND');
    return NextResponse.json(
      { error: message },
      { status: isClientError ? 400 : 500 }
    );
  }
}
