'use client';

import Link from 'next/link';
import { useTenantStore } from '../store/tenant-store';

export default function AutomatedReversalsPage() {
  const activeTenantId = useTenantStore((s) => s.activeTenantId);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="text-xl font-semibold text-slate-900">Automated Reversals</h1>
      <p className="mt-2 text-slate-600">
        Configure and manage automated reversal entries. This view is under construction.
      </p>
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
