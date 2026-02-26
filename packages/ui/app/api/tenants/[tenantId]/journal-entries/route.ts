import { NextRequest, NextResponse } from 'next/server';
import { assertUserCanAccessTenant, getRequestUserId } from '@/app/lib/tenant-guard';
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
} from '@oryens/core';

/** Shape used by repo save(); avoids InstanceType on class with private constructor. */
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
  const rowToAccount = (r: {
    id: string;
    tenant_id: string;
    code: string;
    name: string;
    account_type: string;
    normal_balance: string;
    created_by: string;
  }) =>
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
      return r ? rowToAccount(r as any) : null;
    },
    findByCode: async (_t: string, accountCode: string) => {
      const res = await client.query(
        'SELECT id, tenant_id, code, name, account_type, normal_balance, created_by FROM accounts WHERE tenant_id = $1 AND code = $2 AND deleted_at IS NULL',
        [tenantId, accountCode]
      );
      const r = res.rows[0];
      return r ? rowToAccount(r as any) : null;
    },
    findByCodes: async (_t: string, codes: string[]) => {
      if (codes.length === 0) return [];
      const res = await client.query(
        `SELECT id, tenant_id, code, name, account_type, normal_balance, created_by FROM accounts WHERE tenant_id = $1 AND code = ANY($2) AND deleted_at IS NULL`,
        [tenantId, codes]
      );
      return (res.rows as any[]).map(rowToAccount);
    },
  };
}

function createPeriodRepo(client: PgClient, tenantId: string) {
  return {
    canPostToDate: async (_t: string, date: Date) => {
      const dateStr = date.toISOString().slice(0, 10);
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  const forbidden = await assertUserCanAccessTenant(request, tenantId);
  if (forbidden) return forbidden;
  let body: {
    entityId: string;
    postingDate: string;
    description: string;
    sourceDocumentId?: string;
    sourceModule?: 'MANUAL' | 'AI_REVIEW';
    lines: Array<{
      accountCode: string;
      debitAmountCents: number;
      creditAmountCents: number;
      description?: string;
      metadata?: Record<string, string | number | boolean>;
      transactionAmountCents?: number;
      transactionCurrencyCode?: string;
      exchangeRate?: number;
    }>;
    createdBy?: string;
    metadata?: Record<string, string | number | boolean>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { entityId, postingDate, description, lines, createdBy, metadata } = body;
  if (!entityId || !postingDate || !description || !lines || !Array.isArray(lines) || lines.length < 2) {
    return NextResponse.json(
      { error: 'entityId, postingDate, description, and at least 2 lines are required' },
      { status: 400 }
    );
  }

  const sourceModule = body.sourceModule === 'AI_REVIEW' ? 'AI_REVIEW' : 'MANUAL';
  const command = {
    tenantId,
    entityId,
    postingDate: new Date(postingDate),
    sourceModule,
    sourceDocumentId: (body.sourceDocumentId != null && String(body.sourceDocumentId).trim() !== '')
      ? String(body.sourceDocumentId).trim()
      : crypto.randomUUID(),
    sourceDocumentType: 'JOURNAL',
    description: description.trim(),
    currency: 'USD' as const,
    lines: lines.map((l) => ({
      accountCode: String(l.accountCode).trim(),
      debitAmountCents: Number(l.debitAmountCents) || 0,
      creditAmountCents: Number(l.creditAmountCents) || 0,
      description: l.description?.trim(),
      metadata: l.metadata && typeof l.metadata === 'object' ? l.metadata : undefined,
      transactionAmountCents: l.transactionAmountCents != null ? Number(l.transactionAmountCents) : undefined,
      transactionCurrencyCode: l.transactionCurrencyCode?.trim() || undefined,
      exchangeRate: l.exchangeRate != null ? Number(l.exchangeRate) : undefined,
    })),
    createdBy: createdBy?.trim() || undefined,
    metadata: metadata && typeof metadata === 'object' ? metadata : undefined,
  };

  const validation = CreateJournalEntryCommandValidator.validate(command);
  if (!validation.isValid) {
    return NextResponse.json({ error: validation.errors.join('; '), errors: validation.errors }, { status: 400 });
  }

  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error('DATABASE_URL is not defined');

    const pg = await import('pg');
    const client = new pg.default.Client({ connectionString: dbUrl }) as unknown as PgClient & { connect(): Promise<void>; end(): Promise<void> };
    await client.connect();

    try {
      const journalEntryRepo = createJournalEntryRepo(client);
      const accountRepo = createAccountRepo(client, tenantId);
      const periodRepo = createPeriodRepo(client, tenantId);
      const auditLogRepo = createAuditLogRepo(client);
      const idempotencyRepo = { findByKey: async () => null, save: async () => {} };
      const eventBus = { publish: async () => {} };
      const temporalBalanceService = { applyJournalEntry: async () => {} } as any;
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
      if (sourceModule === 'AI_REVIEW' && result.isSuccess && result.journalEntryId) {
        const userId = await getRequestUserId(request);
        await auditLogRepo.append({
          tenantId,
          userId: userId ?? undefined,
          action: 'AI_GENERATED_HUMAN_APPROVED',
          entityType: 'JournalEntry',
          entityId: result.journalEntryId,
          payload: { journalEntryId: result.journalEntryId, entityId, description: description.trim() },
        });
      }
      return NextResponse.json({
        journalEntryId: result.journalEntryId,
        isSuccess: result.isSuccess,
        wasIdempotent: result.wasIdempotent,
        affectedAccounts: result.affectedAccounts,
        totalAmountCents: result.totalAmountCents,
      });
    } finally {
      await client.end();
    }
  } catch (error: unknown) {
    console.error('Journal entry API error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    const isClientError =
      error instanceof AccountNotFoundError ||
      error instanceof PeriodClosedError ||
      (error instanceof JournalEntryError && error.code === 'NO_PERIOD_FOUND');
    const status = isClientError ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
