/**
 * Analyze ledger health: variance outliers, compliance (missing metadata), currency risk.
 * POST /v1/ai/analyze-ledger-health
 */

export type LedgerLineInput = {
  lineId: string;
  accountCode: string;
  accountType?: string;
  amountCents: number;
  metadata?: Record<string, unknown> | null;
  transactionCurrencyCode?: string | null;
  exchangeRate?: number | null;
};

export type LedgerEntryInput = {
  id: string;
  postingDate: string;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  lines: LedgerLineInput[];
};

export type AnalyzeLedgerHealthInput = {
  entries: LedgerEntryInput[];
  /** Current FX rate (e.g. 1 JPY = 0.0067 USD) per transaction currency code. */
  currentRates?: Record<string, number>;
};

export type LedgerException = {
  type: 'variance' | 'compliance' | 'currency_risk';
  entryId: string;
  lineId?: string;
  accountCode?: string;
  reason: string;
  humanReadable: string;
};

export type AnalyzeLedgerHealthResult = {
  exceptions: LedgerException[];
  closeReadinessScore: number;
};

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function std(arr: number[], m?: number): number {
  if (arr.length < 2) return 0;
  const avg = m ?? mean(arr);
  const sqDiffs = arr.map((x) => (x - avg) ** 2);
  return Math.sqrt(sqDiffs.reduce((a, b) => a + b, 0) / arr.length);
}

export function analyzeLedgerHealth(input: AnalyzeLedgerHealthInput): AnalyzeLedgerHealthResult {
  const { entries, currentRates = {} } = input;
  const exceptions: LedgerException[] = [];

  const amountByAccount = new Map<string, number[]>();
  for (const entry of entries) {
    for (const line of entry.lines) {
      const amount = Math.abs(line.amountCents);
      if (amount === 0) continue;
      const list = amountByAccount.get(line.accountCode) ?? [];
      list.push(amount);
      amountByAccount.set(line.accountCode, list);
    }
  }

  for (const entry of entries) {
    for (const line of entry.lines) {
      const amount = Math.abs(line.amountCents);
      if (amount === 0) continue;

      const list = amountByAccount.get(line.accountCode) ?? [];
      if (list.length >= 3) {
        const m = mean(list);
        const s = std(list, m);
        if (s > 0 && Math.abs(amount - m) > 2 * s) {
          exceptions.push({
            type: 'variance',
            entryId: entry.id,
            lineId: line.lineId,
            accountCode: line.accountCode,
            reason: `amount_cents=${amount} is >2σ from mean for account ${line.accountCode}`,
            humanReadable: `Amount ${(amount / 100).toFixed(2)} is an outlier for account ${line.accountCode} compared to typical activity.`,
          });
        }
      }

      const accountType = (line.accountType || '').toLowerCase();
      if (accountType === 'expense') {
        const meta = line.metadata && typeof line.metadata === 'object' ? line.metadata : {};
        if (meta.Project === undefined || meta.Project === null || String(meta.Project).trim() === '') {
          exceptions.push({
            type: 'compliance',
            entryId: entry.id,
            lineId: line.lineId,
            accountCode: line.accountCode,
            reason: `Expense line missing 'Project' metadata`,
            humanReadable: `Expense on account ${line.accountCode} is missing required "Project" tag for compliance.`,
          });
        }
      }

      const txCurrency = line.transactionCurrencyCode?.trim();
      const histRate = line.exchangeRate != null ? Number(line.exchangeRate) : null;
      if (txCurrency && histRate != null && histRate > 0) {
        const currentRate = currentRates[txCurrency];
        if (typeof currentRate === 'number' && currentRate > 0) {
          const pctDiff = Math.abs(histRate - currentRate) / currentRate;
          if (pctDiff > 0.05) {
            exceptions.push({
              type: 'currency_risk',
              entryId: entry.id,
              lineId: line.lineId,
              accountCode: line.accountCode,
              reason: `exchange_rate ${histRate} differs >5% from current ${currentRate} for ${txCurrency}`,
              humanReadable: `FX rate used at posting (${txCurrency}) is more than 5% different from current rate; consider revaluing.`,
            });
          }
        }
      }
    }
  }

  const maxPenalty = 100;
  const penaltyPerException = 15;
  const closeReadinessScore = Math.max(0, 100 - Math.min(maxPenalty, exceptions.length * penaltyPerException));

  return { exceptions, closeReadinessScore };
}
