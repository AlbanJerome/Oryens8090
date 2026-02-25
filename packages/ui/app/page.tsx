'use client';

import { useEffect, useState } from 'react';

type DiscoveryResponse = {
  tenantId: string;
  parentEntityId: string;
};

type BalanceSheetLine = {
  accountCode: string;
  accountName?: string;
  amountCents: number;
  currency: string;
  accountType?: string;
};

type BalanceSheetResponse = {
  parentEntityId: string;
  asOfDate: string;
  currency: string;
  consolidationMethod: string;
  lines: BalanceSheetLine[];
  totalNciCents?: number;
  isBalanced?: boolean;
};

function formatCentsAsDollars(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export default function Home() {
  const [discovery, setDiscovery] = useState<DiscoveryResponse | null>(null);
  const [report, setReport] = useState<BalanceSheetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setError(null);
        const discoveryRes = await fetch('/api/discovery');
        if (!discoveryRes.ok) {
          if (discoveryRes.status === 404) {
            setError('No root entity found. Run setup and seed data first.');
          } else {
            setError('Failed to load discovery.');
          }
          setLoading(false);
          return;
        }
        const discoveryData: DiscoveryResponse = await discoveryRes.json();
        if (cancelled) return;

        const reportRes = await fetch(
          `/api/tenants/${encodeURIComponent(discoveryData.tenantId)}/reports/balance-sheet?parentEntityId=${encodeURIComponent(discoveryData.parentEntityId)}`
        );
        if (!reportRes.ok) {
          setError('Failed to load balance sheet.');
          setLoading(false);
          return;
        }
        const reportData: BalanceSheetResponse = await reportRes.json();
        if (cancelled) return;

        setDiscovery(discoveryData);
        setReport(reportData);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Something went wrong.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <div className="mx-auto max-w-4xl px-6 py-12">
          <p className="text-slate-500">Loading consolidated balance sheet…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <div className="mx-auto max-w-4xl px-6 py-12">
          <h1 className="text-xl font-semibold text-slate-900">Oryens Ledger</h1>
          <p className="mt-4 text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  const isBalanced = report?.isBalanced ?? false;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <header className="mb-8 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Oryens Ledger
          </h1>
          {isBalanced && (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-800">
              Balanced
            </span>
          )}
        </header>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Account Name
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Code
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody>
                {report?.lines.map((line) => {
                  const isNci = line.accountCode === 'NCI';
                  return (
                    <tr
                      key={line.accountCode}
                      className={
                        isNci
                          ? 'border-b border-slate-100 bg-amber-50/70'
                          : 'border-b border-slate-100 last:border-b-0'
                      }
                    >
                      <td className="px-5 py-3 text-slate-800">
                        {line.accountName ?? '—'}
                      </td>
                      <td className="px-5 py-3 font-mono text-sm text-slate-600">
                        {line.accountCode}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-sm tabular-nums text-slate-800">
                        {formatCentsAsDollars(line.amountCents)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {report?.asOfDate && (
          <p className="mt-4 text-sm text-slate-500">
            As of {new Date(report.asOfDate).toLocaleDateString('en-US', { dateStyle: 'medium' })}
          </p>
        )}
      </div>
    </div>
  );
}
