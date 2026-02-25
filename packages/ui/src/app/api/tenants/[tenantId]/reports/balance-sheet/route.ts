import { NextRequest, NextResponse } from 'next/server';
import {
  GetConsolidatedBalanceSheetQueryHandler,
  ConsolidationService,
  EntityRepositoryPostgres,
  type PgClient,
  type TrialBalanceAccount,
} from '@oryens/core';

// ────────────────────────────────────────────────
// Direct import for the interface (avoids barrel re-export issue in Turbopack)
import { ClosingEntryResult } from '@oryens/core/src/application/services/ClosingService';
// ────────────────────────────────────────────────
// If your alias @oryens/core points to packages/core/src (not src/application),
// use one of these instead:
// import { ClosingEntryResult } from '@oryens/core/application/services/ClosingService';
// or relative: import { ClosingEntryResult } from '../../../../core/src/application/services/ClosingService';

function createTrialBalanceRepo(client: PgClient) {
  return {
    getTrialBalance: async (
      tenantId: string,
      entityId: string,
      asOfDate: Date
    ): Promise<TrialBalanceAccount[]> => {
      const dateStr = asOfDate.toISOString().slice(0, 10);
      const res = await client.query(
        `SELECT jel.account_code,
                a.name AS account_name,
                SUM(jel.debit_amount_cents - jel.credit_amount_cents) AS balance_cents,
                'USD' AS currency,
                a.account_type AS account_type
         FROM journal_entry_lines jel
         JOIN journal_entries je ON je.id = jel.entry_id
         LEFT JOIN accounts a ON a.tenant_id = je.tenant_id AND a.code = jel.account_code
         WHERE je.tenant_id = $1 AND je.entity_id = $2 AND je.posting_date <= $3::date
         GROUP BY jel.account_code, a.name, a.account_type`,
        [tenantId, entityId, dateStr]
      );
      return res.rows.map((r) => ({
        accountCode: r.account_code as string,
        accountName: (r.account_name as string) ?? undefined,
        balanceCents: Number(r.balance_cents),
        currency: (r.currency as string) ?? 'USD',
        accountType: (r.account_type as string) ?? undefined,
      }));
    },
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { tenantId: string } }
) {
  const { tenantId } = params;
  const { searchParams } = new URL(request.url);
  const parentEntityId = searchParams.get('parentEntityId');
  if (!parentEntityId) {
    return NextResponse.json({ error: 'parentEntityId query param is required' }, { status: 400 });
  }

  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error('DATABASE_URL is not defined in environment');

    const pg = await import('pg');
    const client = new pg.default.Client({ connectionString: dbUrl });
    await client.connect();

    try {
      const entityRepo = new EntityRepositoryPostgres(client as unknown as PgClient);
      const trialBalanceRepo = createTrialBalanceRepo(client as unknown as PgClient);

      const handler = new GetConsolidatedBalanceSheetQueryHandler(
        entityRepo,
        trialBalanceRepo,
        new ConsolidationService()
      );

      const report = await handler.execute({
        tenantId,
        parentEntityId,
        asOfDate: new Date(),
      });

      return NextResponse.json(report);
    } finally {
      await client.end();
    }
  } catch (error: unknown) {
    console.error('Balance Sheet API Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
