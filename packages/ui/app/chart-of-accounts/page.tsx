'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

type AccountItem = { id: string; code: string; name: string; accountType: string };

export default function ChartOfAccountsPage() {
  const searchParams = useSearchParams();
  const tenantIdFromUrl = searchParams.get('tenantId');
  const [discovery, setDiscovery] = useState<{ tenantId: string } | null>(null);
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const discoveryUrl = tenantIdFromUrl
      ? `/api/discovery?tenantId=${encodeURIComponent(tenantIdFromUrl)}`
      : '/api/discovery';
    (async () => {
      try {
        const discoveryRes = await fetch(discoveryUrl);
        const d = discoveryRes.ok ? await discoveryRes.json() : null;
        if (cancelled || !d?.tenantId) return;
        setDiscovery(d);
        const accountsRes = await fetch(`/api/tenants/${encodeURIComponent(d.tenantId)}/accounts`);
        const accountsData = accountsRes.ok ? await accountsRes.json() : { accounts: [] };
        if (!cancelled && accountsData?.accounts) setAccounts(accountsData.accounts);
      } catch {
        if (!cancelled) setError('Failed to load.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tenantIdFromUrl]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-12">
        <p className="text-slate-500">Loading chart of accounts…</p>
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
        <table className="w-full text-left text-sm">
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
                <td className="px-5 py-3 text-slate-600">{a.accountType}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
