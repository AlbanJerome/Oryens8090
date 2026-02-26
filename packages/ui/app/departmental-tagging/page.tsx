'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTenantStore } from '../store/tenant-store';
import { OryensSpinner } from '../components/OryensSpinner';

type Department = { id: string; name: string; code: string | null };
type Account = {
  id: string;
  code: string;
  name: string;
  accountType: string;
  departmentId?: string | null;
  departmentName?: string | null;
};

export default function DepartmentalTaggingPage() {
  const activeTenantId = useTenantStore((s) => s.activeTenantId);
  const tenantsLoaded = useTenantStore((s) => s.tenantsLoaded);
  const isLoadingDiscovery = useTenantStore((s) => s.isLoadingDiscovery);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const [deptName, setDeptName] = useState('');
  const [deptCode, setDeptCode] = useState('');
  const [deptSubmitLoading, setDeptSubmitLoading] = useState(false);
  const [deptSubmitError, setDeptSubmitError] = useState<string | null>(null);
  const [updatingAccountId, setUpdatingAccountId] = useState<string | null>(null);

  const load = async () => {
    if (!activeTenantId) return;
    try {
      setLoading(true);
      setError(null);
      const [deptRes, accRes] = await Promise.all([
        fetch(`/api/tenants/${encodeURIComponent(activeTenantId)}/departments`),
        fetch(`/api/tenants/${encodeURIComponent(activeTenantId)}/accounts`),
      ]);
      if (!deptRes.ok || !accRes.ok) throw new Error('Failed to load');
      const deptData = await deptRes.json();
      const accData = await accRes.json();
      setDepartments(deptData.departments ?? []);
      setAccounts(accData.accounts ?? []);
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
    load();
  }, [activeTenantId]);

  const handleAddDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenantId || !deptName.trim()) return;
    setDeptSubmitError(null);
    setDeptSubmitLoading(true);
    try {
      const res = await fetch(`/api/tenants/${encodeURIComponent(activeTenantId)}/departments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: deptName.trim(), code: deptCode.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeptSubmitError(data.error ?? `Request failed (${res.status})`);
        return;
      }
      setDepartments((prev) => [...prev, data.department]);
      setDeptModalOpen(false);
      setDeptName('');
      setDeptCode('');
    } finally {
      setDeptSubmitLoading(false);
    }
  };

  const handleAccountDepartmentChange = async (accountId: string, departmentId: string | null) => {
    if (!activeTenantId) return;
    setUpdatingAccountId(accountId);
    try {
      const res = await fetch(
        `/api/tenants/${encodeURIComponent(activeTenantId)}/accounts/${encodeURIComponent(accountId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ departmentId }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error(data.error ?? res.status);
        return;
      }
      setAccounts((prev) =>
        prev.map((a) => {
          if (a.id !== accountId) return a;
          const dept = departmentId ? departments.find((d) => d.id === departmentId) : null;
          return { ...a, departmentId: departmentId ?? null, departmentName: dept?.name ?? null };
        })
      );
    } finally {
      setUpdatingAccountId(null);
    }
  };

  const loadingState = !tenantsLoaded || isLoadingDiscovery || loading;

  if (loadingState) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-3 px-6 py-12" aria-label="Loading">
        <OryensSpinner className="oryens-spinner" />
        <span className="text-sm text-slate-500">Loading…</span>
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
      <header className="mb-8">
        {activeTenantId && (
          <Link
            href={`/?tenantId=${encodeURIComponent(activeTenantId)}`}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            ← Back to Dashboard
          </Link>
        )}
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Departmental Tagging</h1>
        <p className="mt-1 text-sm text-slate-500">Tag accounts by department for reporting.</p>
      </header>

      <section className="mb-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-medium text-slate-800">Departments</h2>
          <button
            type="button"
            onClick={() => { setDeptModalOpen(true); setDeptSubmitError(null); setDeptName(''); setDeptCode(''); }}
            className="rounded-lg bg-[var(--oryens-emerald)] px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-95"
          >
            Add department
          </button>
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white/80 shadow-sm">
          <table className="saas-table">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80">
                <th className="px-5 py-3 font-semibold text-slate-600">Name</th>
                <th className="px-5 py-3 font-semibold text-slate-600">Code</th>
              </tr>
            </thead>
            <tbody>
              {departments.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-5 py-4 text-center text-slate-500">
                    No departments yet. Add one to start tagging accounts.
                  </td>
                </tr>
              ) : (
                departments.map((d) => (
                  <tr key={d.id} className="border-b border-slate-100 last:border-b-0">
                    <td className="px-5 py-3 text-slate-800">{d.name}</td>
                    <td className="px-5 py-3 font-mono text-slate-600">{d.code ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-medium text-slate-800">Tag accounts</h2>
        <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white/80 shadow-sm">
          <table className="saas-table">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80">
                <th className="px-5 py-3 font-semibold text-slate-600">Code</th>
                <th className="px-5 py-3 font-semibold text-slate-600">Name</th>
                <th className="px-5 py-3 font-semibold text-slate-600">Type</th>
                <th className="px-5 py-3 font-semibold text-slate-600">Department</th>
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
                  <td className="px-5 py-3">
                    <select
                      value={a.departmentId ?? ''}
                      onChange={(e) => handleAccountDepartmentChange(a.id, e.target.value || null)}
                      disabled={updatingAccountId === a.id}
                      className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 disabled:opacity-60"
                    >
                      <option value="">— None —</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {deptModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-dept-title"
        >
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 id="add-dept-title" className="text-lg font-semibold text-slate-900">
              Add department
            </h2>
            <form onSubmit={handleAddDepartment} className="mt-4 space-y-4">
              <div>
                <label htmlFor="dept-name" className="block text-sm font-medium text-slate-700">
                  Name *
                </label>
                <input
                  id="dept-name"
                  type="text"
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label htmlFor="dept-code" className="block text-sm font-medium text-slate-700">
                  Code (optional)
                </label>
                <input
                  id="dept-code"
                  type="text"
                  value={deptCode}
                  onChange={(e) => setDeptCode(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                />
              </div>
              {deptSubmitError && <p className="text-sm text-red-600">{deptSubmitError}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeptModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deptSubmitLoading || !deptName.trim()}
                  className="rounded-lg bg-[var(--oryens-emerald)] px-4 py-2 text-sm font-medium text-white shadow-sm disabled:opacity-60"
                >
                  {deptSubmitLoading ? 'Saving…' : 'Add department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
