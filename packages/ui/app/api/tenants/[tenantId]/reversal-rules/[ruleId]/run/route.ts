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
  type AuditLogEntry,
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
            null,
            null,
            null,
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
      return r ? rowToAccount(r as PgAccountRow) : null;
    },
    findByCode: async (_t: string, accountCode: string) => {
      const res = await client.query(
        'SELECT id, tenant_id, code, name, account_type, normal_balance, created_by FROM accounts WHERE tenant_id = $1 AND code = $2 AND deleted_at IS NULL',
        [tenantId, accountCode]
      );
      const r = res.rows[0];
      return r ? rowToAccount(r as PgAccountRow) : null;
    },
    findByCodes: async (_t: string, codes: string[]) => {
      if (codes.length === 0) return [];
      const res = await client.query(
        `SELECT id, tenant_id, code, name, account_type, normal_balance, created_by FROM accounts WHERE tenant_id = $1 AND code = ANY($2) AND deleted_at IS NULL`,
        [tenantId, codes]
      );
      return (res.rows as PgAccountRow[]).map(rowToAccount);
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
    append: async (entry: AuditLogEntry) => {
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

/**
 * POST /api/tenants/[tenantId]/reversal-rules/[ruleId]/run
 * Execute the reversal rule: create a journal entry with debits/credits swapped.
 * Body: { entityId: string, postingDate: string (YYYY-MM-DD) }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string; ruleId: string }> }
) {
  const { tenantId, ruleId } = await params;
  const forbidden = await assertUserCanAccessTenant(request, tenantId);
  if (forbidden) return forbidden;

  const userRows = await getRequestUserTenantRows(request);
  const role = userRows.find((r) => r.tenantId === tenantId)?.role ?? 'VIEWER';
  if (role === 'VIEWER') {
    return NextResponse.json(
      { error: 'Forbidden: only EDITOR or OWNER can run reversal rules.' },
      { status: 403 }
    );
  }

  let body: { entityId?: string; postingDate?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const entityId = typeof body.entityId === 'string' ? body.entityId.trim() : '';
  const postingDateStr = typeof body.postingDate === 'string' ? body.postingDate.trim() : '';
  if (!entityId || !postingDateStr) {
    return NextResponse.json({ error: 'entityId and postingDate are required' }, { status: 400 });
  }
  const postingDate = new Date(postingDateStr);
  if (Number.isNaN(postingDate.getTime())) {
    return NextResponse.json({ error: 'Invalid postingDate' }, { status: 400 });
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 500 });
  }

  try {
    const pg = await import('pg');
    const client = new pg.default.Client({ connectionString: dbUrl }) as unknown as PgClient & { connect(): Promise<void>; end(): Promise<void> };
    await client.connect();

    try {
      const ruleRes = await client.query<{ name: string; template: unknown }>(
        'SELECT name, template FROM reversal_rules WHERE tenant_id = $1 AND id = $2',
        [tenantId, ruleId]
      );
      if (ruleRes.rows.length === 0) {
        return NextResponse.json({ error: 'Reversal rule not found' }, { status: 404 });
      }
      const rule = ruleRes.rows[0];
      const template = rule.template as { lines?: Array<{ accountCode: string; debitCents: number; creditCents: number }> } | null;
      const lines = Array.isArray(template?.lines) ? template.lines : [];
      if (lines.length < 2) {
        return NextResponse.json({ error: 'Rule template must have at least 2 lines' }, { status: 400 });
      }

      const reversedLines = lines.map((l) => ({
        accountCode: String(l.accountCode).trim(),
        debitAmountCents: Number(l.creditCents) || 0,
        creditAmountCents: Number(l.debitCents) || 0,
      }));

      const command = {
        tenantId,
        entityId,
        postingDate,
        sourceModule: 'AUTOMATED_REVERSAL' as const,
        sourceDocumentId: ruleId,
        sourceDocumentType: 'REVERSAL_RULE',
        description: `${rule.name} (reversal)`,
        currency: 'USD' as const,
        lines: reversedLines.map((l) => ({
          accountCode: l.accountCode,
          debitAmountCents: l.debitAmountCents,
          creditAmountCents: l.creditAmountCents,
          description: undefined,
          metadata: undefined,
          transactionAmountCents: undefined,
          transactionCurrencyCode: undefined,
          exchangeRate: undefined,
        })),
        createdBy: undefined,
        metadata: undefined,
      };

      const validation = CreateJournalEntryCommandValidator.validate(command);
      if (!validation.isValid) {
        return NextResponse.json({ error: validation.errors.join('; '), errors: validation.errors }, { status: 400 });
      }

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

      const result = await handler.handle(command);
      if (result.isSuccess && result.journalEntryId) {
        await client.query(
          'UPDATE reversal_rules SET last_run_at = NOW() WHERE tenant_id = $1 AND id = $2',
          [tenantId, ruleId]
        );
      }

      return NextResponse.json({
        journalEntryId: result.journalEntryId,
        isSuccess: result.isSuccess,
        wasIdempotent: result.wasIdempotent,
        error: result.isSuccess ? undefined : (result as { error?: string }).error,
      });
    } finally {
      await client.end();
    }
  } catch (error: unknown) {
    console.error('Reversal run error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    const isClientError =
      error instanceof AccountNotFoundError ||
      error instanceof PeriodClosedError ||
      (error instanceof JournalEntryError && (error as { code?: string }).code === 'NO_PERIOD_FOUND');
    const status = isClientError ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
