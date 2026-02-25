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

type ReportingMode = 'consolidated' | 'entity';

const USD_FORMAT = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatCentsAsDollars(cents: number): string {
  return USD_FORMAT.format(cents / 100);
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function downloadBalanceSheetCsv(lines: BalanceSheetLine[]): void {
  const header = ['Account Name', 'Code', 'Balance'];
  const rows = lines.map((line) => [
    line.accountName ?? '',
    line.accountCode,
    formatCentsAsDollars(line.amountCents),
  ]);
  const csvContent = [header.map(escapeCsvCell).join(','), ...rows.map((r) => r.map(escapeCsvCell).join(','))].join(
    '\r\n'
  );
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `balance-sheet-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Home() {
  const [discovery, setDiscovery] = useState<DiscoveryResponse | null>(null);
  const [report, setReport] = useState<BalanceSheetResponse | null>(null);
  const [reportingMode, setReportingMode] = useState<ReportingMode>('consolidated');
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDiscovery() {
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
        setDiscovery(discoveryData);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Something went wrong.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadDiscovery();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!discovery) return;
    let cancelled = false;
    setTableLoading(true);

    async function loadReport() {
      try {
        const reportRes = await fetch(
          `/api/tenants/${encodeURIComponent(discovery.tenantId)}/reports/balance-sheet?parentEntityId=${encodeURIComponent(discovery.parentEntityId)}&reportingMode=${reportingMode}`
        );
        if (!reportRes.ok) {
          setError('Failed to load balance sheet.');
          return;
        }
        const reportData: BalanceSheetResponse = await reportRes.json();
        if (cancelled) return;
        setReport(reportData);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Something went wrong.');
        }
      } finally {
        if (!cancelled) setTableLoading(false);
      }
    }

    loadReport();
    return () => {
      cancelled = true;
    };
  }, [discovery, reportingMode]);

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

  const hasLines = (report?.lines?.length ?? 0) > 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <header className="no-print header mb-8 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Oryens Ledger
          </h1>
          {isBalanced && (
            <span className="flex-shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-800">
              Balanced
            </span>
          )}
        </header>

        <div className="no-print mb-6 flex flex-wrap items-end gap-4">
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Reporting Mode</p>
            <div
              className="inline-flex rounded-lg border border-slate-200 bg-slate-50/80 p-0.5"
              role="tablist"
              aria-label="Reporting Mode"
            >
              <button
                type="button"
                role="tab"
                aria-selected={reportingMode === 'consolidated'}
                onClick={() => setReportingMode('consolidated')}
                className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  reportingMode === 'consolidated'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Consolidated
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={reportingMode === 'entity'}
                onClick={() => setReportingMode('entity')}
                className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  reportingMode === 'entity'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Individual Entities
              </button>
            </div>
            {tableLoading && (
              <p className="mt-2 text-sm text-slate-500">Updating…</p>
            )}
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => hasLines && downloadBalanceSheetCsv(report!.lines)}
              disabled={!hasLines}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
            >
              Print PDF
            </button>
          </div>
        </div>

        <h2 className="mb-2 hidden text-lg font-semibold print:block">
          Balance Sheet
        </h2>
        <div
          key={`${reportingMode}-${report?.asOfDate ?? ''}-${report?.lines?.length ?? 0}`}
          className="rounded-xl border border-slate-200 bg-white shadow-sm animate-[fade-in_0.25s_ease-out] print:border-0 print:shadow-none"
        >
          <div className="overflow-x-auto">
            <table className="balance-sheet-table w-full min-w-[32rem] table-fixed text-left print:min-w-0">
              <colgroup>
                <col className="w-[45%]" />
                <col className="w-[25%]" />
                <col className="w-[30%]" />
              </colgroup>
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
                {hasLines ? (
                  report?.lines.map((line) => {
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
                          {isNci ? (
                            <span
                              className="nci-tooltip cursor-help border-b border-dotted border-amber-600/60"
                              data-tooltip="Non-controlling interest represents the portion of equity in a subsidiary not attributable to the parent."
                            >
                              {line.accountCode}
                            </span>
                          ) : (
                            line.accountCode
                          )}
                        </td>
                        <td className="px-5 py-3 text-right font-mono text-sm tabular-nums text-slate-800">
                          {formatCentsAsDollars(line.amountCents)}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-5 py-12 text-center text-slate-500"
                    >
                      No data found for this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {report?.asOfDate && (
          <p className="mt-4 text-sm text-slate-500 print:mt-2">
            As of {new Date(report.asOfDate).toLocaleDateString('en-US', { dateStyle: 'medium' })}
          </p>
        )}
      </div>
    </div>
  );
}
