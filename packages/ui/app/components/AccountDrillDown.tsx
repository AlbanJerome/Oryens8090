'use client';

import { useEffect, useState, useMemo } from 'react';
import { useLocale } from '../context/LocaleContext';

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

const CURRENCY_SYMBOL: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', JPY: '¥', CHF: 'Fr', CAD: 'C$', AUD: 'A$', CNY: '¥' };
function formatTransactionAmount(amountInSmallestUnit: number, currencyCode: string): string {
  const sym = CURRENCY_SYMBOL[currencyCode] ?? currencyCode + ' ';
  const noSubunit = ['JPY', 'CNY'];
  const str = noSubunit.includes(currencyCode) ? amountInSmallestUnit.toLocaleString() : (amountInSmallestUnit / 100).toFixed(2);
  return sym + str;
}

type Props = {
  open: boolean;
  onClose: () => void;
  tenantId: string;
  parentEntityId: string;
  accountCode: string;
  accountName?: string;
};

export function AccountDrillDown({
  open,
  onClose,
  tenantId,
  parentEntityId,
  accountCode,
  accountName,
}: Props) {
  const { formatCurrency, formatDate } = useLocale();
  const [lines, setLines] = useState<JournalLineRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  useEffect(() => {
    if (!open || !tenantId || !parentEntityId || !accountCode) {
      setLines([]);
      setError(null);
      setSummary(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSummary(null);
    fetch(
      `/api/tenants/${encodeURIComponent(tenantId)}/journal-lines?accountCode=${encodeURIComponent(accountCode)}&parentEntityId=${encodeURIComponent(parentEntityId)}`
    )
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load lines');
        return r.json();
      })
      .then((data: { lines?: JournalLineRow[] }) => {
        if (!cancelled) setLines(data.lines ?? []);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, tenantId, parentEntityId, accountCode]);

  useEffect(() => {
    if (lines.length === 0) {
      setSummary(null);
      setSummaryLoading(false);
      return;
    }
    let cancelled = false;
    setSummaryLoading(true);
    const transactions = lines.map((t) => ({
      date: t.postingDate,
      description: t.description,
      entityName: t.entityName,
      debitCents: t.debitAmountCents,
      creditCents: t.creditAmountCents,
    }));
    fetch('/api/ai/summarize-account-activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountCode,
        accountName: accountName ?? undefined,
        transactions,
      }),
    })
      .then((r) => r.json())
      .then((data: { summary?: string }) => {
        if (!cancelled && data.summary) setSummary(data.summary);
      })
      .catch(() => {
        if (!cancelled) setSummary(null);
      })
      .finally(() => {
        if (!cancelled) setSummaryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lines, accountCode, accountName]);

  const rowsWithRunning = useMemo(() => {
    let runningCents = 0;
    return lines.map((line) => {
      const debit = line.debitAmountCents || 0;
      const credit = line.creditAmountCents || 0;
      runningCents += debit - credit;
      return { ...line, runningBalanceCents: runningCents };
    });
  }, [lines]);

  if (!open) return null;

  const title = accountName ? `${accountName} (${accountCode})` : accountCode;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-slate-900/30"
        aria-hidden
        onClick={onClose}
      />
      <div
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-2xl flex-col border-l border-slate-200 bg-white shadow-xl sm:w-[32rem]"
        role="dialog"
        aria-labelledby="drill-down-title"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 id="drill-down-title" className="text-lg font-semibold text-slate-900">
            Account drill-down — {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <span className="sr-only">Close</span>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          {loading && (
            <div className="px-5 py-8 text-center text-slate-500">
              Loading lines…
            </div>
          )}
          {error && (
            <div className="px-5 py-4 text-sm text-amber-700">
              {error}
            </div>
          )}
          {!loading && !error && (
            <div className="flex-1 overflow-auto px-5 py-4">
              {summaryLoading && (
                <p className="mb-3 text-sm text-slate-500">Generating summary…</p>
              )}
              {!summaryLoading && summary && (
                <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50/50 px-4 py-3 text-sm text-indigo-900">
                  <p className="font-medium text-indigo-800">AI summary</p>
                  <p className="mt-1">{summary}</p>
                </div>
              )}
              {rowsWithRunning.length === 0 ? (
                <p className="text-slate-500">No journal lines for this account.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full min-w-[28rem] text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/80">
                        <th className="px-3 py-2 font-semibold text-slate-600">Date</th>
                        <th className="px-3 py-2 font-semibold text-slate-600">Description</th>
                        <th className="px-3 py-2 font-semibold text-slate-600">Entity</th>
                        <th className="px-3 py-2 text-right font-semibold text-slate-600">Debit</th>
                        <th className="px-3 py-2 text-right font-semibold text-slate-600">Credit</th>
                        <th className="px-3 py-2 text-right font-semibold text-slate-600">Running balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rowsWithRunning.map((row) => (
                        <tr key={row.id} className="border-b border-slate-100 last:border-b-0">
                          <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                            {formatDate(row.postingDate)}
                          </td>
                          <td className="max-w-[10rem] truncate px-3 py-2 text-slate-800" title={row.description ?? undefined}>
                            {row.description ?? '—'}
                          </td>
                          <td className="px-3 py-2 text-slate-700">
                            {row.entityName ?? row.entityId}
                          </td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-800">
                            {row.debitAmountCents > 0
                              ? row.transactionAmountCents != null && row.transactionCurrencyCode
                                ? `${formatTransactionAmount(row.transactionAmountCents, row.transactionCurrencyCode)} (${formatCurrency(row.debitAmountCents)})`
                                : formatCurrency(row.debitAmountCents)
                              : '—'}
                          </td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-800">
                            {row.creditAmountCents > 0
                              ? row.transactionAmountCents != null && row.transactionCurrencyCode
                                ? `${formatTransactionAmount(row.transactionAmountCents, row.transactionCurrencyCode)} (${formatCurrency(row.creditAmountCents)})`
                                : formatCurrency(row.creditAmountCents)
                              : '—'}
                          </td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-900">
                            {formatCurrency(row.runningBalanceCents)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
