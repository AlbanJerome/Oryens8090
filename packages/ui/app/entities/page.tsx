'use client';

import Link from 'next/link';
import { useTenantStore } from '../store/tenant-store';

export default function EntitiesPage() {
  const activeTenantId = useTenantStore((s) => s.activeTenantId);
  const discovery = useTenantStore((s) => s.discovery);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="text-xl font-semibold text-slate-900">Entities</h1>
      <p className="mt-2 text-slate-600">
        Manage legal entities and consolidation structure. This view is under construction.
      </p>
      {discovery && (
        <p className="mt-4 text-sm text-slate-500">
          Current root entity: <strong>{discovery.parentEntityName}</strong> ({discovery.tenantId})
        </p>
      )}
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
