'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTenantStore } from '../store/tenant-store';
import { OryensSpinner } from '../components/OryensSpinner';

type AccountItem = { id: string; code: string; name: string; accountType: string };

export default function ChartOfAccountsPage() {
  const activeTenantId = useTenantStore((s) => s.activeTenantId);
  const isLoadingDiscovery = useTenantStore((s) => s.isLoadingDiscovery);
  const tenantsLoaded = useTenantStore((s) => s.tenantsLoaded);

  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeTenantId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const accountsRes = await fetch(`/api/tenants/${encodeURIComponent(activeTenantId)}/accounts`);
        const accountsData = accountsRes.ok ? await accountsRes.json() : { accounts: [] };
        if (!cancelled && accountsData?.accounts) setAccounts(accountsData.accounts);
      } catch {
        if (!cancelled) setError('Failed to load.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activeTenantId]);

  const loadingState = !tenantsLoaded || isLoadingDiscovery || loading;

  if (loadingState) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-3 px-6 py-12" aria-label="Loading">
        <OryensSpinner className="oryens-spinner" />
        <span className="text-sm text-slate-500">Loading chart of accounts…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-12">
        <p className="text-red-600">{error}</p>
        <Link href="/" className="mt-4 inline-block text-indigo-600 hover:underline">Back to Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Chart of Accounts</h1>
        <p className="mt-1 text-sm text-slate-500">All accounts for this tenant.</p>
      </header>
      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white/80 shadow-sm">
        <table className="saas-table">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80">
              <th className="px-5 py-3 font-semibold text-slate-600">Code</th>
              <th className="px-5 py-3 font-semibold text-slate-600">Name</th>
              <th className="px-5 py-3 font-semibold text-slate-600">Type</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id} className="border-b border-slate-100 last:border-b-0">
                <td className="px-5 py-3 font-mono text-slate-700">{a.code}</td>
                <td className="px-5 py-3 text-slate-800">{a.name}</td>
                <td className="px-5 py-3">
                  <span className="oryens-status-badge">{a.accountType}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
