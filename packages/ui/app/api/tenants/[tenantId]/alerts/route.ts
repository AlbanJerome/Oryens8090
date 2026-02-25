import { NextRequest, NextResponse } from 'next/server';
import { assertUserCanAccessTenant } from '@/app/lib/tenant-guard';

export type AlertItem = {
  id: string;
  type: 'missing_source_document' | 'retroactive_posting' | 'anomaly';
  title: string;
  description: string;
  entryId?: string;
  postingDate?: string;
  accountCode?: string;
  amountCents?: number;
  entityId?: string;
};

/**
 * GET /api/tenants/[tenantId]/alerts?parentEntityId=XXX
 * Returns AI-style exception alerts: missing sourceDocumentId, retroactive postings, anomalies.
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

  if (!parentEntityId) {
    return NextResponse.json({ error: 'parentEntityId is required' }, { status: 400 });
  }

  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error('DATABASE_URL is not defined');

    const pg = await import('pg');
    const client = new pg.default.Client({ connectionString: dbUrl });
    await client.connect();

    try {
      const alerts: AlertItem[] = [];

      const entityIdsRes = await client.query(
        `WITH RECURSIVE tree AS (
          SELECT id FROM entities WHERE tenant_id = $1 AND id = $2
          UNION ALL
          SELECT e.id FROM entities e INNER JOIN tree t ON e.parent_entity_id = t.id WHERE e.tenant_id = $1
        )
        SELECT id FROM tree`,
        [tenantId, parentEntityId]
      );
      const entityIds = (entityIdsRes.rows as { id: string }[]).map((r) => r.id);
      if (entityIds.length === 0) {
        return NextResponse.json({ alerts: [] });
      }

      const placeholders = entityIds.map((_, i) => `$${i + 2}`).join(',');

      const missingDocRes = await client.query(
        `SELECT je.id, je.posting_date, je.description, je.entity_id, je.source_document_id
         FROM journal_entries je
         WHERE je.tenant_id = $1 AND je.entity_id IN (${placeholders})
           AND (je.source_document_id IS NULL OR TRIM(je.source_document_id) = '')`,
        [tenantId, ...entityIds]
      );
      for (const r of missingDocRes.rows as { id: string; posting_date: string; description: string | null; entity_id: string }[]) {
        alerts.push({
          id: `missing-${r.id}`,
          type: 'missing_source_document',
          title: 'Missing source document',
          description: r.description || 'Journal entry has no source document ID.',
          entryId: r.id,
          postingDate: r.posting_date?.slice?.(0, 10),
          entityId: r.entity_id,
        });
      }

      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const retroRes = await client.query(
        `SELECT je.id, je.posting_date, je.description, je.entity_id
         FROM journal_entries je
         WHERE je.tenant_id = $1 AND je.entity_id IN (${placeholders})
           AND je.posting_date::text < $${entityIds.length + 2}`,
        [tenantId, ...entityIds, currentMonthStart]
      );
      for (const r of retroRes.rows as { id: string; posting_date: string; description: string | null; entity_id: string }[]) {
        alerts.push({
          id: `retro-${r.id}`,
          type: 'retroactive_posting',
          title: 'Retroactive posting',
          description: `Entry posted to a prior period (${r.posting_date?.slice?.(0, 10)}). ${r.description || ''}`.trim(),
          entryId: r.id,
          postingDate: r.posting_date?.slice?.(0, 10),
          entityId: r.entity_id,
        });
      }

      const linesRes = await client.query(
        `SELECT jel.account_code, jel.debit_amount_cents, jel.credit_amount_cents, jel.entry_id, je.posting_date
         FROM journal_entry_lines jel
         JOIN journal_entries je ON je.id = jel.entry_id
         WHERE je.tenant_id = $1 AND je.entity_id IN (${placeholders})`,
        [tenantId, ...entityIds]
      );
      const lines = linesRes.rows as { account_code: string; debit_amount_cents: number; credit_amount_cents: number; entry_id: string; posting_date: string }[];
      const byAccount = new Map<string, number[]>();
      for (const l of lines) {
        const amount = (Number(l.debit_amount_cents) || 0) - (Number(l.credit_amount_cents) || 0);
        const absCents = Math.abs(amount);
        if (absCents > 0) {
          const list = byAccount.get(l.account_code) ?? [];
          list.push(absCents);
          byAccount.set(l.account_code, list);
        }
      }
      const mean = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
      const std = (arr: number[], m: number) =>
        arr.length > 1 ? Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1)) : 0;
      const anomalyEntries = new Set<string>();
      for (const [code, amounts] of byAccount.entries()) {
        const m = mean(amounts);
        const s = std(amounts, m);
        if (s === 0) continue;
        const threshold = m + 2 * s;
        for (const l of lines) {
          if (l.account_code !== code) continue;
          const amount = Math.abs((Number(l.debit_amount_cents) || 0) - (Number(l.credit_amount_cents) || 0));
          if (amount >= threshold) {
            anomalyEntries.add(l.entry_id);
            if (!alerts.some((a) => a.entryId === l.entry_id && a.type === 'anomaly')) {
              alerts.push({
                id: `anomaly-${l.entry_id}-${code}`,
                type: 'anomaly',
                title: 'Unusual amount',
                description: `Transaction amount (${(amount / 100).toFixed(2)} USD) is unusually high for account ${code}.`,
                entryId: l.entry_id,
                accountCode: code,
                amountCents: amount,
                postingDate: l.posting_date?.slice?.(0, 10),
              });
            }
          }
        }
      }

      return NextResponse.json({ alerts });
    } finally {
      await client.end();
    }
  } catch (error: unknown) {
    console.error('Alerts API error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
