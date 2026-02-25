import { NextRequest, NextResponse } from 'next/server';
import {
  GetConsolidatedBalanceSheetQueryHandler,
  ConsolidationService,
  EntityRepositoryPostgres,
  type PgClient,
  type TrialBalanceAccount,
} from '@oryens/core';

interface TrialBalanceRow {
  account_code: string;
  account_name: string | null;
  balance_cents: string | number;
  currency: string | null;
  account_type: string | null;
}

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
      const rows = res.rows as unknown as TrialBalanceRow[];
      return rows.map((r) => ({
        accountCode: r.account_code,
        accountName: r.account_name ?? undefined,
        balanceCents: Number(r.balance_cents),
        currency: r.currency ?? 'USD',
        accountType: r.account_type ?? undefined,
      }));
    },
  };
}

function computeIsBalanced(accounts: TrialBalanceAccount[]): boolean {
  let assets = 0,
    liabilities = 0,
    equity = 0;
  for (const a of accounts) {
    const type = (a.accountType ?? '').toLowerCase();
    const cents = a.balanceCents ?? 0;
    if (type === 'asset') assets += cents;
    else if (type === 'liability') liabilities += cents;
    else if (type === 'equity') equity += cents;
  }
  return assets - liabilities - equity === 0;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  const { searchParams } = new URL(request.url);
  const parentEntityId = searchParams.get('parentEntityId');
  const reportingMode = searchParams.get('reportingMode') ?? 'consolidated';

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
      const asOfDate = new Date();

      if (reportingMode === 'entity') {
        const accounts = await trialBalanceRepo.getTrialBalance(
          tenantId,
          parentEntityId,
          asOfDate
        );
        const lines = accounts.map((a) => ({
          accountCode: a.accountCode,
          accountName: a.accountName,
          amountCents: a.balanceCents,
          currency: a.currency ?? 'USD',
          accountType: a.accountType,
        }));
        const report = {
          parentEntityId,
          asOfDate: asOfDate.toISOString(),
          currency: 'USD',
          consolidationMethod: 'None' as const,
          lines,
          isBalanced: computeIsBalanced(accounts),
        };
        return NextResponse.json(report);
      }

      const handler = new GetConsolidatedBalanceSheetQueryHandler(
        entityRepo,
        trialBalanceRepo,
        new ConsolidationService()
      );

      const report = await handler.execute({
        tenantId,
        parentEntityId,
        asOfDate,
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
