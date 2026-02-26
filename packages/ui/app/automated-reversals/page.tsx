'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTenantStore } from '../store/tenant-store';
import { OryensSpinner } from '../components/OryensSpinner';

type ReversalRule = {
  id: string;
  name: string;
  description: string | null;
  scheduleType: string;
  template: { lines: Array<{ accountCode: string; debitCents: number; creditCents: number }> };
  lastRunAt: string | null;
  createdAt: string;
};
type EntityItem = { id: string; name: string };
type AccountItem = { id: string; code: string; name: string };

export default function AutomatedReversalsPage() {
  const activeTenantId = useTenantStore((s) => s.activeTenantId);
  const tenantsLoaded = useTenantStore((s) => s.tenantsLoaded);
  const isLoadingDiscovery = useTenantStore((s) => s.isLoadingDiscovery);

  const [rules, setRules] = useState<ReversalRule[]>([]);
  const [entities, setEntities] = useState<EntityItem[]>([]);
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formSchedule, setFormSchedule] = useState<'MANUAL' | 'MONTH_END' | 'QUARTER_END'>('MANUAL');
  const [formLines, setFormLines] = useState<Array<{ accountCode: string; debitCents: number; creditCents: number }>>([
    { accountCode: '', debitCents: 0, creditCents: 0 },
    { accountCode: '', debitCents: 0, creditCents: 0 },
  ]);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [runRuleId, setRunRuleId] = useState<string | null>(null);
  const [runEntityId, setRunEntityId] = useState('');
  const [runPostingDate, setRunPostingDate] = useState('');
  const [runLoading, setRunLoading] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const load = async () => {
    if (!activeTenantId) return;
    try {
      setLoading(true);
      setError(null);
      const [rulesRes, entitiesRes, accountsRes] = await Promise.all([
        fetch(`/api/tenants/${encodeURIComponent(activeTenantId)}/reversal-rules`),
        fetch(`/api/tenants/${encodeURIComponent(activeTenantId)}/entities`),
        fetch(`/api/tenants/${encodeURIComponent(activeTenantId)}/accounts`),
      ]);
      if (!rulesRes.ok || !entitiesRes.ok || !accountsRes.ok) throw new Error('Failed to load');
      const [rulesData, entitiesData, accountsData] = await Promise.all([
        rulesRes.json(),
        entitiesRes.json(),
        accountsRes.json(),
      ]);
      setRules(rulesData.rules ?? []);
      setEntities(entitiesData.entities ?? []);
      setAccounts(accountsData.accounts ?? []);
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

  const openAddModal = () => {
    setFormName('');
    setFormDescription('');
    setFormSchedule('MANUAL');
    setFormLines([
      { accountCode: '', debitCents: 0, creditCents: 0 },
      { accountCode: '', debitCents: 0, creditCents: 0 },
    ]);
    setSubmitError(null);
    setModalOpen(true);
  };

  const addLine = () => {
    setFormLines((prev) => [...prev, { accountCode: '', debitCents: 0, creditCents: 0 }]);
  };

  const updateLine = (index: number, field: 'accountCode' | 'debitCents' | 'creditCents', value: string | number) => {
    setFormLines((prev) => {
      const next = [...prev];
      const line = { ...next[index] };
      if (field === 'accountCode') line.accountCode = String(value);
      else if (field === 'debitCents') line.debitCents = Number(value) || 0;
      else line.creditCents = Number(value) || 0;
      next[index] = line;
      return next;
    });
  };

  const removeLine = (index: number) => {
    if (formLines.length <= 2) return;
    setFormLines((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmitRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenantId || !formName.trim()) return;
    const lines = formLines
      .filter((l) => l.accountCode.trim())
      .map((l) => ({ accountCode: l.accountCode.trim(), debitCents: Number(l.debitCents) || 0, creditCents: Number(l.creditCents) || 0 }));
    if (lines.length < 2) {
      setSubmitError('At least 2 lines with account code are required');
      return;
    }
    setSubmitError(null);
    setSubmitLoading(true);
    try {
      const res = await fetch(`/api/tenants/${encodeURIComponent(activeTenantId)}/reversal-rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          description: formDescription.trim() || undefined,
          scheduleType: formSchedule,
          template: { lines },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitError(data.error ?? `Request failed (${res.status})`);
        return;
      }
      setRules((prev) => [...prev, data.rule]);
      setModalOpen(false);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleRun = async (ruleId: string) => {
    if (!activeTenantId || !runEntityId || !runPostingDate) {
      setRunError('Select entity and posting date');
      return;
    }
    setRunError(null);
    setRunLoading(true);
    setRunRuleId(ruleId);
    try {
      const res = await fetch(
        `/api/tenants/${encodeURIComponent(activeTenantId)}/reversal-rules/${encodeURIComponent(ruleId)}/run`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entityId: runEntityId, postingDate: runPostingDate }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRunError(data.error ?? `Request failed (${res.status})`);
        return;
      }
      if (data.isSuccess) {
        setRules((prev) =>
          prev.map((r) => (r.id === ruleId ? { ...r, lastRunAt: new Date().toISOString() } : r))
        );
        setRunRuleId(null);
        setRunEntityId('');
        setRunPostingDate('');
      } else {
        setRunError(data.error ?? 'Run did not succeed');
      }
    } finally {
      setRunLoading(false);
      setRunRuleId(null);
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

  const defaultDate = (() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  })();

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
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Automated Reversals</h1>
          <p className="mt-1 text-sm text-slate-500">Configure and run reversal rules (template entries with debits/credits swapped).</p>
        </div>
        <button
          type="button"
          onClick={openAddModal}
          className="rounded-lg bg-[var(--oryens-emerald)] px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-95"
        >
          Add rule
        </button>
      </header>

      {runError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          {runError}
        </div>
      )}

      <div className="mb-6 rounded-xl border border-slate-200/80 bg-slate-50/50 p-4">
        <h2 className="text-sm font-medium text-slate-700">Run rule</h2>
        <p className="mt-1 text-xs text-slate-500">Select entity and posting date, then click &quot;Run now&quot; on a rule.</p>
        <div className="mt-3 flex flex-wrap gap-4">
          <div>
            <label htmlFor="run-entity" className="block text-xs font-medium text-slate-600">Entity</label>
            <select
              id="run-entity"
              value={runEntityId}
              onChange={(e) => setRunEntityId(e.target.value)}
              className="mt-1 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            >
              <option value="">— Select —</option>
              {entities.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="run-date" className="block text-xs font-medium text-slate-600">Posting date</label>
            <input
              id="run-date"
              type="date"
              value={runPostingDate || defaultDate}
              onChange={(e) => setRunPostingDate(e.target.value)}
              className="mt-1 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white/80 shadow-sm">
        <table className="saas-table">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80">
              <th className="px-5 py-3 font-semibold text-slate-600">Name</th>
              <th className="px-5 py-3 font-semibold text-slate-600">Schedule</th>
              <th className="px-5 py-3 font-semibold text-slate-600">Lines</th>
              <th className="px-5 py-3 font-semibold text-slate-600">Last run</th>
              <th className="px-5 py-3 font-semibold text-slate-600">Action</th>
            </tr>
          </thead>
          <tbody>
            {rules.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-6 text-center text-slate-500">
                  No reversal rules yet. Add a rule to define a template entry; running it creates a reversal (debits/credits swapped).
                </td>
              </tr>
            ) : (
              rules.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 last:border-b-0">
                  <td className="px-5 py-3">
                    <span className="font-medium text-slate-800">{r.name}</span>
                    {r.description && <p className="text-xs text-slate-500">{r.description}</p>}
                  </td>
                  <td className="px-5 py-3">
                    <span className="oryens-status-badge">{r.scheduleType}</span>
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-600">
                    {r.template.lines.length} line(s)
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-500">
                    {r.lastRunAt ? new Date(r.lastRunAt).toLocaleString() : '—'}
                  </td>
                  <td className="px-5 py-3">
                    <button
                      type="button"
                      onClick={() => handleRun(r.id)}
                      disabled={runLoading || !runEntityId || !runPostingDate}
                      className="rounded bg-slate-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                    >
                      {runRuleId === r.id && runLoading ? 'Running…' : 'Run now'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-rule-title"
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <h2 id="add-rule-title" className="text-lg font-semibold text-slate-900">
              Add reversal rule
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Define the template entry. When you run the rule, a new journal entry is created with debits and credits swapped.
            </p>
            <form onSubmit={handleSubmitRule} className="mt-4 space-y-4">
              <div>
                <label htmlFor="rule-name" className="block text-sm font-medium text-slate-700">Name *</label>
                <input
                  id="rule-name"
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label htmlFor="rule-desc" className="block text-sm font-medium text-slate-700">Description (optional)</label>
                <input
                  id="rule-desc"
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                />
              </div>
              <div>
                <label htmlFor="rule-schedule" className="block text-sm font-medium text-slate-700">Schedule</label>
                <select
                  id="rule-schedule"
                  value={formSchedule}
                  onChange={(e) => setFormSchedule(e.target.value as 'MANUAL' | 'MONTH_END' | 'QUARTER_END')}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                >
                  <option value="MANUAL">Manual only</option>
                  <option value="MONTH_END">Month end</option>
                  <option value="QUARTER_END">Quarter end</option>
                </select>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-slate-700">Template lines (debit/credit in cents)</label>
                  <button type="button" onClick={addLine} className="text-sm text-[var(--oryens-indigo)] hover:underline">
                    + Add line
                  </button>
                </div>
                <div className="mt-2 space-y-2">
                  {formLines.map((line, idx) => (
                    <div key={idx} className="flex flex-wrap items-center gap-2">
                      <select
                        value={line.accountCode}
                        onChange={(e) => updateLine(idx, 'accountCode', e.target.value)}
                        className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                      >
                        <option value="">— Account —</option>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.code}>{a.code} – {a.name}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={0}
                        placeholder="Debit cents"
                        value={line.debitCents || ''}
                        onChange={(e) => updateLine(idx, 'debitCents', e.target.value)}
                        className="w-28 rounded border border-slate-300 px-2 py-1.5 text-sm"
                      />
                      <input
                        type="number"
                        min={0}
                        placeholder="Credit cents"
                        value={line.creditCents || ''}
                        onChange={(e) => updateLine(idx, 'creditCents', e.target.value)}
                        className="w-28 rounded border border-slate-300 px-2 py-1.5 text-sm"
                      />
                      {formLines.length > 2 && (
                        <button type="button" onClick={() => removeLine(idx)} className="text-red-600 hover:underline">
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              {submitError && <p className="text-sm text-red-600">{submitError}</p>}
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
                  disabled={submitLoading}
                  className="rounded-lg bg-[var(--oryens-emerald)] px-4 py-2 text-sm font-medium text-white shadow-sm disabled:opacity-60"
                >
                  {submitLoading ? 'Saving…' : 'Add rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
