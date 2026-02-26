'use client';

import { useState } from 'react';
import { useTenantStore } from '../store/tenant-store';

type OnboardingModalProps = { onClose?: () => void };

export function OnboardingModal({ onClose }: OnboardingModalProps) {
  const [companyName, setCompanyName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setTenantFromOnboard = useTenantStore((s) => s.setTenantFromOnboard);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = companyName.trim();
    if (!name) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Failed to create company');
        return;
      }
      // Optimistic update so UI shows the app immediately; avoids GET /api/tenants overwriting with empty
      const tenantId = data.tenantId ?? data.tenant_id;
      const company = data.companyName ?? name;
      if (tenantId) setTenantFromOnboard(tenantId, company);
      onClose?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      onClick={onClose ? (e) => e.target === e.currentTarget && onClose() : undefined}
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 id="onboarding-title" className="text-xl font-semibold text-slate-900">
          Create your company
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Enter a name for your first ledger. You can add more later.
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="company-name" className="block text-sm font-medium text-slate-700">
              Company name
            </label>
            <input
              id="company-name"
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
              placeholder="e.g. Acme Inc"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-[var(--oryens-indigo)] focus:outline-none focus:ring-1 focus:ring-[var(--oryens-indigo)]"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-lg bg-[var(--oryens-indigo)] px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:opacity-95 disabled:opacity-70"
            >
              {submitting ? 'Creating…' : 'Continue'}
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
