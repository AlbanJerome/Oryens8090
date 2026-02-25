'use client';

import { useEffect, useState } from 'react';
import { useLocale } from '../context/LocaleContext';

type AlertItem = {
  id: string;
  type: 'missing_source_document' | 'retroactive_posting' | 'anomaly';
  title: string;
  description: string;
  entryId?: string;
  postingDate?: string;
  accountCode?: string;
  amountCents?: number;
  entityId?: string;
};

function alertIcon(type: AlertItem['type']) {
  switch (type) {
    case 'missing_source_document':
      return (
        <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    case 'retroactive_posting':
      return (
        <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'anomaly':
      return (
        <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      );
    default:
      return null;
  }
}

export function DashboardAlerts({ tenantId, parentEntityId }: { tenantId: string; parentEntityId: string }) {
  const { formatCurrency, formatDateMedium } = useLocale();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const formatDate = (iso: string | undefined) => (iso ? formatDateMedium(iso) : '—');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(
      `/api/tenants/${encodeURIComponent(tenantId)}/alerts?parentEntityId=${encodeURIComponent(parentEntityId)}`
    )
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load alerts');
        return r.json();
      })
      .then((data: { alerts?: AlertItem[] }) => {
        if (!cancelled) setAlerts(data.alerts ?? []);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tenantId, parentEntityId]);

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200/80 bg-white/95 p-8 text-center text-slate-500">
        Loading AI alerts…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-amber-800">
        {error}
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200/80 bg-white/95 p-8 text-center">
        <p className="text-slate-600">No exceptions detected.</p>
        <p className="mt-1 text-sm text-slate-500">Transactions are within normal range; source documents and posting dates look good.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        {alerts.length} alert{alerts.length !== 1 ? 's' : ''} detected by background check.
      </p>
      <ul className="space-y-3">
        {alerts.map((alert) => (
          <li
            key={alert.id}
            className="flex gap-4 rounded-xl border border-slate-200/80 bg-white/95 p-4 shadow-sm"
          >
            <div className="shrink-0">{alertIcon(alert.type)}</div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-slate-900">{alert.title}</p>
              <p className="mt-1 text-sm text-slate-600">{alert.description}</p>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                {alert.postingDate && <span>Posted: {formatDate(alert.postingDate)}</span>}
                {alert.accountCode && <span>Account: {alert.accountCode}</span>}
                {alert.amountCents != null && (
                  <span>Amount: {formatCurrency(alert.amountCents!)}</span>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
