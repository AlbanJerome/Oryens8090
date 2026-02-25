import { NextResponse } from 'next/server';
import { getRate } from '../../../../lib/currency-service';

const REPORTING_CURRENCY = 'USD';

export type RevalueItem = {
  lineId: string;
  entryId: string;
  accountCode: string;
  transactionAmountCents: number;
  transactionCurrencyCode: string;
  historicalRate: number;
  currentRate: number;
  reportingAmountCents: number;
  currentValueCents: number;
  unrealizedCents: number;
};

export type RevalueResponse = {
  items: RevalueItem[];
  totalUnrealizedGainLossCents: number;
  reportingCurrency: string;
  insight: string;
};

/**
 * GET /api/tenants/[tenantId]/revalue
 * Compares historical exchange rates with current rates for multi-currency lines;
 * returns unrealized gain/loss and an AI-style insight.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  if (!tenantId) {
    return NextResponse.json({ error: 'tenantId required' }, { status: 400 });
  }

  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      return NextResponse.json({
        items: [],
        totalUnrealizedGainLossCents: 0,
        reportingCurrency: REPORTING_CURRENCY,
        insight: 'Database not configured; revaluation skipped.',
      });
    }

    const pg = await import('pg');
    const client = new pg.default.Client({ connectionString: dbUrl });
    await client.connect();

    try {
      const res = await client.query(
        `SELECT jel.id, jel.entry_id, jel.account_code,
                jel.transaction_amount_cents, jel.transaction_currency_code, jel.exchange_rate,
                jel.debit_amount_cents, jel.credit_amount_cents
         FROM journal_entry_lines jel
         JOIN journal_entries je ON je.id = jel.entry_id
         WHERE je.tenant_id = $1
           AND jel.transaction_currency_code IS NOT NULL
           AND jel.transaction_amount_cents IS NOT NULL
           AND jel.exchange_rate IS NOT NULL`,
        [tenantId]
      );

      const rows = res.rows as Array<{
        id: string;
        entry_id: string;
        account_code: string;
        transaction_amount_cents: number;
        transaction_currency_code: string;
        exchange_rate: number;
        debit_amount_cents: number;
        credit_amount_cents: number;
      }>;

      const items: RevalueItem[] = [];
      for (const r of rows) {
        const debit = Number(r.debit_amount_cents) || 0;
        const credit = Number(r.credit_amount_cents) || 0;
        const reportingAmountCents = debit > 0 ? debit : credit;
        const historicalRate = Number(r.exchange_rate);
        const txCents = Number(r.transaction_amount_cents);
        const txCurrency = String(r.transaction_currency_code).toUpperCase();
        const currentRate = await getRate(txCurrency, REPORTING_CURRENCY);
        const currentValueCents = Math.round(txCents * currentRate * 100);
        const unrealizedCents = currentValueCents - reportingAmountCents;

        items.push({
          lineId: r.id,
          entryId: r.entry_id,
          accountCode: r.account_code,
          transactionAmountCents: txCents,
          transactionCurrencyCode: txCurrency,
          historicalRate,
          currentRate,
          reportingAmountCents,
          currentValueCents,
          unrealizedCents,
        });
      }

      const totalUnrealizedGainLossCents = items.reduce((sum, i) => sum + i.unrealizedCents, 0);
      const totalFormatted = totalUnrealizedGainLossCents >= 0
        ? `$${(totalUnrealizedGainLossCents / 100).toFixed(2)}`
        : `-$${Math.abs(totalUnrealizedGainLossCents) / 100}`;
      const insight = items.length === 0
        ? 'No multi-currency lines to revalue. Post entries with a transaction currency different from reporting to see unrealized gain/loss.'
        : `Revaluation at current FX: total unrealized ${totalUnrealizedGainLossCents >= 0 ? 'gain' : 'loss'} is ${totalFormatted} (reporting currency ${REPORTING_CURRENCY}). This compares ${items.length} line(s) at posting rate vs. current rate.`;

      const body: RevalueResponse = {
        items,
        totalUnrealizedGainLossCents,
        reportingCurrency: REPORTING_CURRENCY,
        insight,
      };
      return NextResponse.json(body);
    } finally {
      await client.end().catch(() => {});
    }
  } catch (err) {
    console.error('Revalue API error:', err);
    return NextResponse.json(
      {
        items: [],
        totalUnrealizedGainLossCents: 0,
        reportingCurrency: REPORTING_CURRENCY,
        insight: 'Revaluation failed. Please try again.',
      },
      { status: 500 }
    );
  }
}
