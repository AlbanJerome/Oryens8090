'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale } from '../context/LocaleContext';
import { useTenantStore } from '../store/tenant-store';
import { OryensSpinner } from '../components/OryensSpinner';

type DiscoveryResponse = {
  tenantId: string;
  parentEntityId: string;
  parentEntityName?: string;
};

type AuditLogRow = {
  id: string;
  tenantId: string;
  userId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
  entityName?: string | null;
};

type AccountItem = { id: string; code: string; name: string; accountType: string };

type AuditLine = { accountCode: string; debitAmountCents: number; creditAmountCents: number };

/** Details string: 'Manual Entry: [Description]' */
function buildDetailsString(
  row: AuditLogRow,
  accountCodeToName: Map<string, string>,
  formatCurrency: (cents: number) => string,
  formatDate: (d: Date | string) => string
): string {
  const { action, payload } = row;
  if (action !== 'JournalEntryCreated') {
    return `${action}`;
  }
  const totalCents = payload.totalAmountCents as number | undefined;
  const affectedAccounts = (payload.affectedAccounts as string[] | undefined) ?? [];
  const sourceModule = (payload.sourceModule as string | undefined) ?? 'Manual';
  const postingDate = payload.postingDate as string | undefined;
  const amountStr =
    typeof totalCents === 'number' ? formatCurrency(totalCents) : '—';
  const accountNames = affectedAccounts
    .map((code) => accountCodeToName.get(code) ?? code)
    .filter(Boolean);
  const accountList =
    accountNames.length > 0 ? accountNames.join(' and ') : affectedAccounts.join(', ') || '—';
  const dateStr = postingDate ? formatDate(postingDate) : '';
  const description = `${amountStr} affecting ${accountList}${dateStr ? `. Dated ${dateStr}` : ''}.`;
  const isManual = String(sourceModule).toLowerCase() === 'manual';
  const prefix = isManual ? 'Manual Entry' : `Entry (${sourceModule})`;
  return `${prefix}: ${description}`;
}

/** Entity display name: use API entityName or discovery parent name when entity is parent */
function getEntityDisplayName(
  row: AuditLogRow,
  discovery: DiscoveryResponse | null
): string {
  if (row.entityName) return row.entityName;
  const payload = row.payload as Record<string, unknown>;
  const entityId = payload.entityId as string | undefined;
  if (discovery && entityId && entityId === discovery.parentEntityId && discovery.parentEntityName) {
    return discovery.parentEntityName;
  }
  return '—';
}

/** Small table: account code/name and signed impact (+$X or -$X) */
function ChangesTable({
  payload,
  accountCodeToName,
  formatCurrency,
}: {
  payload: Record<string, unknown>;
  accountCodeToName: Map<string, string>;
  formatCurrency: (cents: number) => string;
}) {
  const lines = (payload.lines as AuditLine[] | undefined) ?? [];
  const affectedAccounts = (payload.affectedAccounts as string[] | undefined) ?? [];
  if (lines.length === 0) {
    if (affectedAccounts.length === 0) return <span className="text-slate-400">—</span>;
    return (
      <div className="min-w-[8rem] rounded border border-slate-200 bg-slate-50/50 px-2 py-1.5 text-xs text-slate-600">
        {affectedAccounts.map((code) => (
          <div key={code}>
            {accountCodeToName.get(code) ? `${code} (${accountCodeToName.get(code)})` : code}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="min-w-[12rem] rounded border border-slate-200 bg-slate-50/50 px-2 py-1.5">
      <table className="w-full text-xs">
        <tbody>
          {lines.map((line, i) => {
            const debit = line.debitAmountCents > 0;
            const cents = debit ? line.debitAmountCents : line.creditAmountCents;
            const signed = debit ? `+${formatCurrency(cents)}` : `-${formatCurrency(cents)}`;
            const name = accountCodeToName.get(line.accountCode);
            const accountLabel = name ? `${line.accountCode} (${name})` : line.accountCode;
            return (
              <tr key={i} className="border-b border-slate-100 last:border-b-0">
                <td className="py-0.5 font-medium text-slate-700">{accountLabel}</td>
                <td className="py-0.5 text-right tabular-nums text-slate-800">{signed}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MiniLedger({
  payload,
  accountCodeToName,
  formatCurrency,
}: {
  payload: Record<string, unknown>;
  accountCodeToName: Map<string, string>;
  formatCurrency: (cents: number) => string;
}) {
  const lines = (payload.lines as AuditLine[] | undefined) ?? [];
  if (lines.length === 0) {
    const affectedAccounts = (payload.affectedAccounts as string[] | undefined) ?? [];
    return (
      <div className="rounded border border-slate-200 bg-slate-50/50 p-3 font-mono text-xs">
        <p className="mb-2 font-semibold text-slate-600">Affected accounts</p>
        <ul className="list-inside list-disc text-slate-700">
          {affectedAccounts.map((code) => (
            <li key={code}>
              {accountCodeToName.get(code) ?? code}
            </li>
          ))}
          {affectedAccounts.length === 0 && <li className="text-slate-400">—</li>}
        </ul>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded border border-slate-200 bg-slate-50/50">
      <table className="w-full min-w-[20rem] text-left text-xs">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-100/80">
            <th className="px-3 py-2 font-semibold text-slate-600">Account</th>
            <th className="px-3 py-2 font-semibold text-slate-600 text-right">Debit</th>
            <th className="px-3 py-2 font-semibold text-slate-600 text-right">Credit</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => (
            <tr key={i} className="border-b border-slate-100 last:border-b-0">
              <td className="px-3 py-2 text-slate-800">
                {accountCodeToName.get(line.accountCode) ?? line.accountCode}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                {line.debitAmountCents > 0 ? formatCurrency(line.debitAmountCents) : '—'}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                {line.creditAmountCents > 0 ? formatCurrency(line.creditAmountCents) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AuditPage() {
  const { formatCurrency, formatDate } = useLocale();
  const discovery = useTenantStore((s) => s.discovery);
  const isLoadingDiscovery = useTenantStore((s) => s.isLoadingDiscovery);
  const tenantsLoaded = useTenantStore((s) => s.tenantsLoaded);

  const [entries, setEntries] = useState<AuditLogRow[]>([]);
  const [accountCodeToName, setAccountCodeToName] = useState<Map<string, string>>(new Map());
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!discovery?.tenantId) {
      setDataLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        setDataLoading(true);
        const [auditRes, accountsRes] = await Promise.all([
          fetch(`/api/tenants/${encodeURIComponent(discovery.tenantId)}/audit?limit=200`),
          fetch(`/api/tenants/${encodeURIComponent(discovery.tenantId)}/accounts`),
        ]);
        if (cancelled) return;
        if (!auditRes.ok) {
          setError('Failed to load audit log.');
          return;
        }
        const auditData = await auditRes.json();
        setEntries(auditData.entries ?? []);
        const map = new Map<string, string>();
        if (accountsRes.ok) {
          const accData = await accountsRes.json();
          const accounts: AccountItem[] = accData.accounts ?? [];
          accounts.forEach((a) => map.set(a.code, a.name));
        }
        if (!cancelled) setAccountCodeToName(map);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Something went wrong.');
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [discovery?.tenantId]);

  const loading = !tenantsLoaded || isLoadingDiscovery || dataLoading;

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-6 py-12" aria-label="Loading">
        <OryensSpinner className="oryens-spinner" />
        <span className="text-sm text-slate-500">Loading audit log…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <p className="text-red-600">{error}</p>
          <Link href="/" className="mt-4 inline-block text-indigo-600 hover:underline">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              ← Back to Dashboard
            </Link>
            <span className="text-slate-400">|</span>
            <Link href="/" className="text-2xl font-semibold tracking-tight text-slate-900 hover:underline">
              {discovery?.parentEntityName ? `${discovery.parentEntityName} Ledger` : 'Ledger'}
            </Link>
            <span className="text-slate-500">/</span>
            <h1 className="text-xl font-semibold text-slate-800">Audit Log</h1>
          </div>
        </header>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="saas-table w-full min-w-[56rem] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-slate-500">
                    Date
                  </th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-slate-500">
                    User
                  </th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-slate-500">
                    Action
                  </th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-slate-500">
                    Entity
                  </th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-slate-500">
                    Posting date
                  </th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-slate-500">
                    Details
                  </th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-slate-500">
                    Changes
                  </th>
                  <th className="w-10 px-2 py-3" aria-label="Expand" />
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                      No audit entries yet.
                    </td>
                  </tr>
                ) : (
                  entries.map((row) => {
                    const payload = row.payload as Record<string, unknown>;
                    const postingDate = payload.postingDate as string | undefined;
                    const isExpanded = expandedId === row.id;
                    const hasLines =
                      (payload.lines as AuditLine[] | undefined)?.length ??
                      (payload.affectedAccounts as string[] | undefined)?.length ??
                      0;
                    const canExpand = row.action === 'JournalEntryCreated' && hasLines > 0;
                    return (
                      <React.Fragment key={row.id}>
                        <tr
                          className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50"
                        >
                          <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                            {formatDate(row.createdAt)}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-700">
                            {row.userId ?? '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span className="oryens-status-badge">{row.action}</span>
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {getEntityDisplayName(row, discovery)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                            {postingDate ? formatDate(postingDate) : '—'}
                          </td>
                          <td className="max-w-md px-4 py-3 text-slate-700">
                            {buildDetailsString(row, accountCodeToName, formatCurrency, formatDate)}
                          </td>
                          <td className="px-4 py-3">
                            <ChangesTable payload={payload} accountCodeToName={accountCodeToName} formatCurrency={formatCurrency} />
                          </td>
                          <td className="px-2 py-3">
                            {canExpand ? (
                              <button
                                type="button"
                                onClick={() => setExpandedId(isExpanded ? null : row.id)}
                                className="rounded p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800"
                                aria-expanded={isExpanded}
                                title={isExpanded ? 'Collapse' : 'Show ledger'}
                              >
                                {isExpanded ? '▼' : '▶'}
                              </button>
                            ) : (
                              <span className="inline-block w-8" />
                            )}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="oryens-row-active border-b border-slate-100">
                            <td colSpan={8} className="px-4 py-3">
                              <MiniLedger payload={row.payload} accountCodeToName={accountCodeToName} formatCurrency={formatCurrency} />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
