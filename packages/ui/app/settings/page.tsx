'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTenantStore } from '../store/tenant-store';

export default function SettingsPage() {
  const activeTenantId = useTenantStore((s) => s.activeTenantId);
  const [seeding, setSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function handlePopulateSample() {
    if (!activeTenantId || seeding) return;
    setSeeding(true);
    setSeedMessage(null);
    try {
      const res = await fetch(`/api/tenants/${encodeURIComponent(activeTenantId)}/seed-sample`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSeedMessage({
          type: 'success',
          text: data.message ?? `Created ${data.created ?? 0} sample journal entries.`,
        });
      } else {
        setSeedMessage({
          type: 'error',
          text: data.error ?? `Request failed (${res.status}).`,
        });
      }
    } catch (e) {
      setSeedMessage({
        type: 'error',
        text: e instanceof Error ? e.message : 'Network error',
      });
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Application and tenant settings.</p>
      </header>
      <div className="space-y-4">
        <Link
          href="/settings/team"
          className="block rounded-xl border border-slate-200/80 bg-white/80 p-6 shadow-sm hover:bg-slate-50/80"
        >
          <h2 className="font-medium text-slate-900">Team</h2>
          <p className="mt-1 text-sm text-slate-500">Manage users and roles for this company.</p>
        </Link>

        <div className="rounded-xl border border-slate-200/80 bg-white/80 p-6 shadow-sm">
          <h2 className="font-medium text-slate-900">Sample data</h2>
          <p className="mt-1 text-sm text-slate-500">
            Add sample journal entries to test reports, trial balance, and the Transaction Assistant. Requires at least one entity and two accounts.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handlePopulateSample}
              disabled={!activeTenantId || seeding}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {seeding ? 'Adding…' : 'Populate sample entries'}
            </button>
            {seedMessage && (
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  seedMessage.type === 'success'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {seedMessage.text}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
