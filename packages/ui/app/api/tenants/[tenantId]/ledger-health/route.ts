import { NextRequest, NextResponse } from 'next/server';
import { assertUserCanAccessTenant } from '@/app/lib/tenant-guard';
import { getRate } from '../../../../lib/currency-service';

const AI_SERVICE_URL =
  typeof process.env.NEXT_PUBLIC_AI_SERVICE_URL === 'string' && process.env.NEXT_PUBLIC_AI_SERVICE_URL
    ? process.env.NEXT_PUBLIC_AI_SERVICE_URL
    : 'http://localhost:8090';

const RECENT_DAYS = 90;

/**
 * GET /api/tenants/[tenantId]/ledger-health?parentEntityId=XXX
 * Fetches recent journal entries with lines and metadata, calls AI service to analyze
 * (variance, compliance, currency risk), returns exceptions and close readiness score.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  const forbidden = await assertUserCanAccessTenant(request, tenantId);
  if (forbidden) return forbidden;
  const { searchParams } = new URL(request.url);
  const parentEntityId = searchParams.get('parentEntityId');

  if (!parentEntityId?.trim()) {
    return NextResponse.json({ error: 'parentEntityId is required' }, { status: 400 });
  }

  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error('DATABASE_URL is not defined');

    const pg = await import('pg');
    const client = new pg.default.Client({ connectionString: dbUrl });
    await client.connect();

    try {
      const entityIdsRes = await client.query(
        `WITH RECURSIVE tree AS (
          SELECT id FROM entities WHERE tenant_id = $1 AND id = $2
          UNION ALL
          SELECT e.id FROM entities e INNER JOIN tree t ON e.parent_entity_id = t.id WHERE e.tenant_id = $1
        )
        SELECT id FROM tree`,
        [tenantId, parentEntityId.trim()]
      );
      const entityIds = (entityIdsRes.rows as { id: string }[]).map((r) => r.id);
      if (entityIds.length === 0) {
        return NextResponse.json({ exceptions: [], closeReadinessScore: 100 });
      }

      const since = new Date();
      since.setDate(since.getDate() - RECENT_DAYS);
      const sinceStr = since.toISOString().slice(0, 10);
      const placeholders = entityIds.map((_, i) => `$${i + 3}`).join(',');

      const entriesRes = await client.query(
        `SELECT je.id, je.posting_date, je.description, je.metadata AS entry_metadata
         FROM journal_entries je
         WHERE je.tenant_id = $1 AND je.entity_id IN (${placeholders}) AND je.posting_date::date >= $2
         ORDER BY je.posting_date DESC`,
        [tenantId, sinceStr, ...entityIds]
      );

      const entryIds = (entriesRes.rows as { id: string }[]).map((r) => r.id);
      if (entryIds.length === 0) {
        return NextResponse.json({ exceptions: [], closeReadinessScore: 100 });
      }

      const linePlaceholders = entryIds.map((_, i) => `$${i + 1}`).join(',');
      const linesRes = await client.query(
        `SELECT jel.id, jel.entry_id, jel.account_code, jel.debit_amount_cents, jel.credit_amount_cents,
                jel.metadata AS line_metadata, jel.transaction_currency_code, jel.exchange_rate
         FROM journal_entry_lines jel
         WHERE jel.entry_id IN (${linePlaceholders})`,
        entryIds
      );

      const accountCodes = [...new Set((linesRes.rows as { account_code: string }[]).map((r) => r.account_code))];
      let accountTypes: Record<string, string> = {};
      if (accountCodes.length > 0) {
        const accPlaceholders = accountCodes.map((_, i) => `$${i + 2}`).join(',');
        const accRes = await client.query(
          `SELECT code, account_type FROM accounts WHERE tenant_id = $1 AND code IN (${accPlaceholders}) AND deleted_at IS NULL`,
          [tenantId, ...accountCodes]
        );
        for (const r of accRes.rows as { code: string; account_type: string }[]) {
          accountTypes[r.code] = r.account_type;
        }
      }

      const entryMeta: Record<string, { posting_date: string; description: string | null; entry_metadata: unknown }> = {};
      for (const r of entriesRes.rows as { id: string; posting_date: string; description: string | null; entry_metadata: unknown }[]) {
        entryMeta[r.id] = {
          posting_date: r.posting_date,
          description: r.description,
          entry_metadata: r.entry_metadata,
        };
      }

      const linesByEntry = new Map<string, { id: string; account_code: string; debit_amount_cents: number; credit_amount_cents: number; line_metadata: unknown; transaction_currency_code: string | null; exchange_rate: number | null }[]>();
      for (const r of linesRes.rows as {
        id: string;
        entry_id: string;
        account_code: string;
        debit_amount_cents: number;
        credit_amount_cents: number;
        line_metadata: unknown;
        transaction_currency_code: string | null;
        exchange_rate: number | null;
      }[]) {
        const list = linesByEntry.get(r.entry_id) ?? [];
        list.push({
          id: r.id,
          account_code: r.account_code,
          debit_amount_cents: Number(r.debit_amount_cents) || 0,
          credit_amount_cents: Number(r.credit_amount_cents) || 0,
          line_metadata: r.line_metadata,
          transaction_currency_code: r.transaction_currency_code,
          exchange_rate: r.exchange_rate != null ? Number(r.exchange_rate) : null,
        });
        linesByEntry.set(r.entry_id, list);
      }

      const currencies = new Set<string>();
      for (const rows of linesByEntry.values()) {
        for (const l of rows) {
          if (l.transaction_currency_code?.trim()) currencies.add(l.transaction_currency_code.trim());
        }
      }
      const currentRates: Record<string, number> = {};
      for (const cc of currencies) {
        try {
          currentRates[cc] = await getRate(cc, 'USD');
        } catch {
          currentRates[cc] = 1;
        }
      }

      const entries = entryIds.map((id) => {
        const meta = entryMeta[id];
        const lines = (linesByEntry.get(id) ?? []).map((l) => {
          const amountCents = Math.abs(l.debit_amount_cents) + Math.abs(l.credit_amount_cents);
          const metaObj = l.line_metadata && typeof l.line_metadata === 'object' ? (l.line_metadata as Record<string, unknown>) : {};
          return {
            lineId: l.id,
            accountCode: l.account_code,
            accountType: accountTypes[l.account_code],
            amountCents,
            metadata: metaObj,
            transactionCurrencyCode: l.transaction_currency_code,
            exchangeRate: l.exchange_rate,
          };
        });
        return {
          id,
          postingDate: meta?.posting_date ?? '',
          description: meta?.description ?? null,
          metadata: meta?.entry_metadata && typeof meta.entry_metadata === 'object' ? (meta.entry_metadata as Record<string, unknown>) : undefined,
          lines,
        };
      });

      const aiRes = await fetch(`${AI_SERVICE_URL}/v1/ai/analyze-ledger-health`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries, currentRates }),
      });
      const data = await aiRes.json().catch(() => ({ exceptions: [], closeReadinessScore: 100 }));
      if (!aiRes.ok) {
        return NextResponse.json(
          { exceptions: data.exceptions ?? [], closeReadinessScore: data.closeReadinessScore ?? 100, error: data.error },
          { status: 502 }
        );
      }
      return NextResponse.json({
        exceptions: data.exceptions ?? [],
        closeReadinessScore: typeof data.closeReadinessScore === 'number' ? data.closeReadinessScore : 100,
      });
    } finally {
      await client.end();
    }
  } catch (error: unknown) {
    console.error('Ledger health API error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message, exceptions: [], closeReadinessScore: 0 }, { status: 500 });
  }
}
