'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTenantStore } from '../store/tenant-store';
import { OryensSpinner } from '../components/OryensSpinner';

type EntityItem = {
  id: string;
  name: string;
  parentEntityId: string | null;
  parentEntityName: string | null;
  ownershipPercentage: number;
  consolidationMethod: string;
  currency: string;
  isRoot: boolean;
};

export default function EntitiesPage() {
  const activeTenantId = useTenantStore((s) => s.activeTenantId);
  const tenantsLoaded = useTenantStore((s) => s.tenantsLoaded);
  const isLoadingDiscovery = useTenantStore((s) => s.isLoadingDiscovery);

  const [entities, setEntities] = useState<EntityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formParentId, setFormParentId] = useState<string>('');
  const [formOwnership, setFormOwnership] = useState(100);
  const [formMethod, setFormMethod] = useState<'Full' | 'Proportional' | 'Equity'>('Full');
  const [formCurrency, setFormCurrency] = useState('USD');

  const loadEntities = async () => {
    if (!activeTenantId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/tenants/${encodeURIComponent(activeTenantId)}/entities`);
      if (!res.ok) throw new Error(res.status === 401 ? 'Unauthorized' : 'Failed to load entities');
      const data = await res.json();
      setEntities(data.entities ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!activeTenantId) {
      setLoading(false);
      return;
    }
    loadEntities();
  }, [activeTenantId]);

  const openAddModal = () => {
    setFormName('');
    setFormParentId('');
    setFormOwnership(100);
    setFormMethod('Full');
    setFormCurrency('USD');
    setSubmitError(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenantId || !formName.trim()) return;
    setSubmitError(null);
    setSubmitLoading(true);
    try {
      const res = await fetch(`/api/tenants/${encodeURIComponent(activeTenantId)}/entities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          parentEntityId: formParentId.trim() || undefined,
          ownershipPercentage: formParentId ? formOwnership : 100,
          consolidationMethod: formMethod,
          currency: formCurrency.trim() || 'USD',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitError(data.error ?? `Request failed (${res.status})`);
        return;
      }
      setEntities((prev) => [...prev, data.entity]);
      setModalOpen(false);
    } finally {
      setSubmitLoading(false);
    }
  };

  const loadingState = !tenantsLoaded || isLoadingDiscovery || loading;

  if (loadingState) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-3 px-6 py-12" aria-label="Loading">
        <OryensSpinner className="oryens-spinner" />
        <span className="text-sm text-slate-500">Loading entities…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-12">
        <p className="text-red-600">{error}</p>
        {activeTenantId && (
          <Link
            href={`/?tenantId=${encodeURIComponent(activeTenantId)}`}
            className="mt-4 inline-block text-sm font-medium text-[var(--oryens-indigo)] hover:underline"
          >
            ← Back to Dashboard
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          {activeTenantId && (
            <Link
              href={`/?tenantId=${encodeURIComponent(activeTenantId)}`}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              ← Back to Dashboard
            </Link>
          )}
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Entities</h1>
          <p className="mt-1 text-sm text-slate-500">Legal entities and consolidation structure.</p>
        </div>
        <button
          type="button"
          onClick={openAddModal}
          className="rounded-lg bg-[var(--oryens-emerald)] px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-95"
        >
          Add entity
        </button>
      </header>

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white/80 shadow-sm">
        <table className="saas-table">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80">
              <th className="px-5 py-3 font-semibold text-slate-600">Name</th>
              <th className="px-5 py-3 font-semibold text-slate-600">Parent</th>
              <th className="px-5 py-3 font-semibold text-slate-600">Ownership %</th>
              <th className="px-5 py-3 font-semibold text-slate-600">Method</th>
              <th className="px-5 py-3 font-semibold text-slate-600">Currency</th>
            </tr>
          </thead>
          <tbody>
            {entities.map((e) => (
              <tr key={e.id} className="border-b border-slate-100 last:border-b-0">
                <td className="px-5 py-3 text-slate-800">
                  {e.name}
                  {e.isRoot && (
                    <span className="ml-2 text-xs text-slate-500">(root)</span>
                  )}
                </td>
                <td className="px-5 py-3 text-slate-600">{e.parentEntityName ?? '—'}</td>
                <td className="px-5 py-3 text-slate-700">{e.ownershipPercentage}%</td>
                <td className="px-5 py-3">
                  <span className="oryens-status-badge">{e.consolidationMethod}</span>
                </td>
                <td className="px-5 py-3 font-mono text-slate-600">{e.currency}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-entity-title"
        >
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 id="add-entity-title" className="text-lg font-semibold text-slate-900">
              Add entity
            </h2>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label htmlFor="entity-name" className="block text-sm font-medium text-slate-700">
                  Name *
                </label>
                <input
                  id="entity-name"
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label htmlFor="entity-parent" className="block text-sm font-medium text-slate-700">
                  Parent entity (optional; leave empty for root)
                </label>
                <select
                  id="entity-parent"
                  value={formParentId}
                  onChange={(e) => setFormParentId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                >
                  <option value="">— None (root) —</option>
                  {entities.filter((e) => e.isRoot).map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </div>
              {formParentId && (
                <>
                  <div>
                    <label htmlFor="entity-ownership" className="block text-sm font-medium text-slate-700">
                      Ownership %
                    </label>
                    <input
                      id="entity-ownership"
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      value={formOwnership}
                      onChange={(e) => setFormOwnership(Number(e.target.value))}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                    />
                  </div>
                  <div>
                    <label htmlFor="entity-method" className="block text-sm font-medium text-slate-700">
                      Consolidation method
                    </label>
                    <select
                      id="entity-method"
                      value={formMethod}
                      onChange={(e) => setFormMethod(e.target.value as 'Full' | 'Proportional' | 'Equity')}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                    >
                      <option value="Full">Full</option>
                      <option value="Proportional">Proportional</option>
                      <option value="Equity">Equity</option>
                    </select>
                  </div>
                </>
              )}
              <div>
                <label htmlFor="entity-currency" className="block text-sm font-medium text-slate-700">
                  Currency
                </label>
                <input
                  id="entity-currency"
                  type="text"
                  value={formCurrency}
                  onChange={(e) => setFormCurrency(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                  placeholder="USD"
                />
              </div>
              {submitError && (
                <p className="text-sm text-red-600">{submitError}</p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitLoading || !formName.trim()}
                  className="rounded-lg bg-[var(--oryens-emerald)] px-4 py-2 text-sm font-medium text-white shadow-sm disabled:opacity-60"
                >
                  {submitLoading ? 'Saving…' : 'Add entity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
