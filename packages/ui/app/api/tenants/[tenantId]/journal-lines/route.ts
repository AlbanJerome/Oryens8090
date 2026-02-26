import { NextRequest, NextResponse } from 'next/server';
import type { PgClient } from '@oryens/core';
import { assertUserCanAccessTenant } from '@/app/lib/tenant-guard';

export type JournalLineRow = {
  id: string;
  entryId: string;
  postingDate: string;
  description: string | null;
  entityId: string;
  entityName: string | null;
  accountCode: string;
  debitAmountCents: number;
  creditAmountCents: number;
  transactionAmountCents?: number | null;
  transactionCurrencyCode?: string | null;
  exchangeRate?: number | null;
};

/**
 * GET /api/tenants/[tenantId]/journal-lines?accountCode=XXX&parentEntityId=YYY
 * Returns all journal_entry_lines for the given account in the entity tree (parent + descendants).
 * Ordered by posting_date, created_at for running balance.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  const forbidden = await assertUserCanAccessTenant(request, tenantId);
  if (forbidden) return forbidden;
  const { searchParams } = new URL(request.url);
  const accountCode = searchParams.get('accountCode');
  const parentEntityId = searchParams.get('parentEntityId');

  if (!accountCode?.trim()) {
    return NextResponse.json({ error: 'accountCode is required' }, { status: 400 });
  }
  if (!parentEntityId?.trim()) {
    return NextResponse.json({ error: 'parentEntityId is required' }, { status: 400 });
  }

  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error('DATABASE_URL is not defined');

    const pg = await import('pg');
    const client = new pg.default.Client({ connectionString: dbUrl }) as unknown as PgClient & { connect(): Promise<void>; end(): Promise<void> };
    await client.connect();

    try {
      // Resolve parent + all descendants (single level: parent + direct children only for simplicity; can be recursive CTE later)
      const entityIdsRes = await client.query(
        `WITH RECURSIVE tree AS (
          SELECT id FROM entities WHERE tenant_id = $1 AND id = $2
          UNION ALL
          SELECT e.id FROM entities e
          INNER JOIN tree t ON e.parent_entity_id = t.id
          WHERE e.tenant_id = $1
        )
        SELECT id FROM tree`,
        [tenantId, parentEntityId]
      );
      const entityIds = (entityIdsRes.rows as { id: string }[]).map((r) => r.id);
      if (entityIds.length === 0) {
        return NextResponse.json({ lines: [] });
      }

      const placeholders = entityIds.map((_, i) => `$${i + 3}`).join(',');
      const query = `
        SELECT jel.id, jel.entry_id, je.posting_date, je.description,
               je.entity_id AS entity_id, e.name AS entity_name,
               jel.account_code, jel.debit_amount_cents, jel.credit_amount_cents,
               jel.transaction_amount_cents, jel.transaction_currency_code, jel.exchange_rate
        FROM journal_entry_lines jel
        JOIN journal_entries je ON je.id = jel.entry_id
        LEFT JOIN entities e ON e.id = je.entity_id AND e.tenant_id = je.tenant_id
        WHERE je.tenant_id = $1 AND jel.account_code = $2 AND je.entity_id IN (${placeholders})
        ORDER BY je.posting_date ASC, je.id ASC, jel.id ASC`;
      const res = await client.query(query, [tenantId, accountCode.trim(), ...entityIds]);

      const lines: JournalLineRow[] = (res.rows as any[]).map((r) => ({
        id: r.id,
        entryId: r.entry_id,
        postingDate: r.posting_date instanceof Date ? r.posting_date.toISOString().slice(0, 10) : String(r.posting_date),
        description: r.description ?? null,
        entityId: r.entity_id,
        entityName: r.entity_name ?? null,
        accountCode: r.account_code,
        debitAmountCents: Number(r.debit_amount_cents) || 0,
        creditAmountCents: Number(r.credit_amount_cents) || 0,
        transactionAmountCents: r.transaction_amount_cents != null ? Number(r.transaction_amount_cents) : null,
        transactionCurrencyCode: r.transaction_currency_code ?? null,
        exchangeRate: r.exchange_rate != null ? Number(r.exchange_rate) : null,
      }));

      return NextResponse.json({ lines });
    } finally {
      await client.end();
    }
  } catch (error: unknown) {
    console.error('Journal lines API error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
