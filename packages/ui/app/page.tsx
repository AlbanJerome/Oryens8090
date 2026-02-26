'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { NewJournalEntry } from './components/NewJournalEntry';
import { AIEntryReview } from './components/AIEntryReview';
import { AccountDrillDown } from './components/AccountDrillDown';
import { DashboardAlerts } from './components/DashboardAlerts';
import { LoadingSkeleton } from './components/LoadingSkeleton';
import { usePermissions } from './hooks/usePermissions';
import { PermissionGuard } from './components/PermissionGuard';
import { useLocale } from './context/LocaleContext';
import { useTenantStore } from './store/tenant-store';
import { toLocalDateString } from './lib/date-utils';

type DiscoveryResponse = {
  tenantId: string;
  parentEntityId: string;
  parentEntityName?: string;
};

type BalanceSheetLine = {
  accountCode: string;
  accountName?: string;
  amountCents: number;
  currency: string;
  accountType?: string;
};

type BalanceSheetResponse = {
  parentEntityId: string;
  asOfDate: string;
  currency: string;
  consolidationMethod: string;
  lines: BalanceSheetLine[];
  totalNciCents?: number;
  isBalanced?: boolean;
};

type ReportingMode = 'consolidated' | 'entity';

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function downloadBalanceSheetCsv(lines: BalanceSheetLine[], formatCurrency: (cents: number) => string): void {
  const header = ['Account Name', 'Code', 'Balance'];
  const rows = lines.map((line) => [
    line.accountName ?? '',
    line.accountCode,
    formatCurrency(line.amountCents),
  ]);
  const csvContent = [header.map(escapeCsvCell).join(','), ...rows.map((r) => r.map(escapeCsvCell).join(','))].join(
    '\r\n'
  );
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `balance-sheet-${toLocalDateString(new Date())}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function NoRootEntityScreen({
  tenantId,
  companyName,
}: {
  tenantId: string | null;
  companyName: string;
}) {
  const loadDiscovery = useTenantStore((s) => s.loadDiscovery);
  const [initializing, setInitializing] = useState(false);
  const [repairError, setRepairError] = useState<string | null>(null);

  const handleInitialize = async () => {
    if (!tenantId) return;
    setRepairError(null);
    setInitializing(true);
    try {
      const res = await fetch(`/api/tenants/${encodeURIComponent(tenantId)}/ensure-root-entity`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRepairError(data.error || `Request failed (${res.status})`);
        return;
      }
      await loadDiscovery(tenantId);
    } finally {
      setInitializing(false);
    }
  };

  if (!tenantId) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-xl font-semibold text-[var(--oryens-slate)]">{companyName}</h1>
        <p className="mt-4 text-[var(--oryens-slate-muted)]">No root entity found for {companyName}.</p>
        <p className="mt-2 text-sm text-slate-500">
          You can initialize the ledger for this company to continue.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleInitialize}
            disabled={initializing}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-70"
          >
            {initializing ? 'Initializing…' : 'Initialize ledger'}
          </button>
          {repairError && (
            <span className="text-sm text-red-600">{repairError}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const drillCode = searchParams.get('drill');
  const drillName = searchParams.get('drillName');

  const discovery = useTenantStore((s) => s.discovery);
  const activeTenantId = useTenantStore((s) => s.activeTenantId);
  const userTenants = useTenantStore((s) => s.userTenants);
  const isLoadingDiscovery = useTenantStore((s) => s.isLoadingDiscovery);
  const tenantsLoaded = useTenantStore((s) => s.tenantsLoaded);

  const currentTenantName = userTenants.find((t) => t.tenantId === activeTenantId)?.name ?? null;

  const [report, setReport] = useState<BalanceSheetResponse | null>(null);
  const [reportingMode, setReportingMode] = useState<ReportingMode>('consolidated');
  const [tableLoading, setTableLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newEntryOpen, setNewEntryOpen] = useState(false);
  const [aiReviewOpen, setAiReviewOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [tableError, setTableError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [syncBanner, setSyncBanner] = useState<{ postingDate: string } | null>(null);
  const [drillDown, setDrillDown] = useState<{ accountCode: string; accountName?: string } | null>(null);
  const appliedDrillRef = useRef<string | null>(null);
  const [dashboardTab, setDashboardTab] = useState<'balance-sheet' | 'alerts'>('balance-sheet');
  const [monthsBack, setMonthsBack] = useState(0);
  const [revalueResult, setRevalueResult] = useState<{ insight: string; totalUnrealizedGainLossCents: number } | null>(null);
  const [revalueLoading, setRevalueLoading] = useState(false);
  type LedgerException = { type: string; entryId: string; lineId?: string; accountCode?: string; reason: string; humanReadable: string };
  const [ledgerHealth, setLedgerHealth] = useState<{ exceptions: LedgerException[]; closeReadinessScore: number } | null>(null);
  const [ledgerHealthLoading, setLedgerHealthLoading] = useState(false);

  const loading = !tenantsLoaded || isLoadingDiscovery;

  const asOfDate = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - monthsBack);
    return toLocalDateString(d);
  }, [monthsBack]);

  useEffect(() => {
    setDrillDown(null);
    appliedDrillRef.current = null;
  }, [activeTenantId]);

  useEffect(() => {
    if (!drillCode) {
      appliedDrillRef.current = null;
      return;
    }
    if (!discovery || appliedDrillRef.current === drillCode) return;
    appliedDrillRef.current = drillCode;
    setDrillDown({ accountCode: drillCode, accountName: drillName ?? undefined });
    const params = new URLSearchParams(searchParams.toString());
    params.delete('drill');
    params.delete('drillName');
    const q = params.toString();
    router.replace(q ? `/?${q}` : '/', { scroll: false });
  }, [drillCode, drillName, discovery, searchParams, router]);

  useEffect(() => {
    if (!discovery) return;
    const { tenantId, parentEntityId } = discovery;
    let cancelled = false;
    setTableLoading(true);
    setTableError(null);

    async function loadReport() {
      try {
        const reportRes = await fetch(
          `/api/tenants/${encodeURIComponent(tenantId)}/reports/balance-sheet?parentEntityId=${encodeURIComponent(parentEntityId)}&reportingMode=${reportingMode}&asOfDate=${encodeURIComponent(asOfDate)}`
        );
        if (!reportRes.ok) {
          if (!cancelled) setTableError('Failed to load balance sheet.');
          return;
        }
        const reportData: BalanceSheetResponse = await reportRes.json();
        if (cancelled) return;
        setReport(reportData);
        setTableError(null);
      } catch (e) {
        if (!cancelled) setTableError(e instanceof Error ? e.message : 'Something went wrong.');
      } finally {
        if (!cancelled) setTableLoading(false);
      }
    }

    loadReport();
    return () => {
      cancelled = true;
    };
  }, [discovery, reportingMode, refreshTrigger, asOfDate]);

  useEffect(() => {
    if (!discovery) return;
    let cancelled = false;
    setLedgerHealthLoading(true);
    setLedgerHealth(null);
    (async () => {
      try {
        const res = await fetch(
          `/api/tenants/${encodeURIComponent(discovery.tenantId)}/ledger-health?parentEntityId=${encodeURIComponent(discovery.parentEntityId)}`
        );
        const data = await res.json().catch(() => ({ exceptions: [], closeReadinessScore: 100 }));
        if (cancelled) return;
        setLedgerHealth({
          exceptions: Array.isArray(data.exceptions) ? data.exceptions : [],
          closeReadinessScore: typeof data.closeReadinessScore === 'number' ? data.closeReadinessScore : 100,
        });
      } catch {
        if (!cancelled) setLedgerHealth({ exceptions: [], closeReadinessScore: 100 });
      } finally {
        if (!cancelled) setLedgerHealthLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [discovery, refreshTrigger]);

  useEffect(() => {
    if (!successToast) return;
    const t = setTimeout(() => setSuccessToast(null), 5000);
    return () => clearTimeout(t);
  }, [successToast]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <LoadingSkeleton />
      </div>
    );
  }

  if (tenantsLoaded && !discovery) {
    return (
      <NoRootEntityScreen
        tenantId={activeTenantId}
        companyName={currentTenantName ?? 'this company'}
      />
    );
  }

  if (error) {
    const title = currentTenantName ? `${currentTenantName}` : 'Oryens Ledger';
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <div className="mx-auto max-w-4xl px-6 py-12">
          <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
          <p className="mt-4 text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  const hasLines = (report?.lines?.length ?? 0) > 0;
  const isBalanced = report?.isBalanced ?? false;
  const showUnbalanced = hasLines && report != null && !isBalanced;

  const todayYmd = toLocalDateString(new Date());
  const syncBannerOutOfRange =
    syncBanner &&
    syncBanner.postingDate !== todayYmd;

  return (
    <DashboardContent
      discovery={discovery}
        report={report}
        reportingMode={reportingMode}
        setReportingMode={setReportingMode}
        dashboardTab={dashboardTab}
        setDashboardTab={setDashboardTab}
        monthsBack={monthsBack}
        setMonthsBack={setMonthsBack}
        asOfDate={asOfDate}
        hasLines={hasLines ?? false}
        isBalanced={isBalanced ?? false}
        showUnbalanced={showUnbalanced ?? false}
        tableLoading={tableLoading}
        tableError={tableError}
        setRefreshTrigger={setRefreshTrigger}
        successToast={successToast}
        syncBanner={syncBanner}
        syncBannerOutOfRange={syncBannerOutOfRange ?? false}
        todayYmd={todayYmd}
        newEntryOpen={newEntryOpen}
        setNewEntryOpen={setNewEntryOpen}
        aiReviewOpen={aiReviewOpen}
        setAiReviewOpen={setAiReviewOpen}
        setSuccessToast={setSuccessToast}
        setSyncBanner={setSyncBanner}
        drillDown={drillDown}
        setDrillDown={setDrillDown}
        setReport={setReport}
        revalueResult={revalueResult}
        setRevalueResult={setRevalueResult}
        revalueLoading={revalueLoading}
        setRevalueLoading={setRevalueLoading}
        ledgerHealth={ledgerHealth}
        ledgerHealthLoading={ledgerHealthLoading}
        setLedgerHealth={setLedgerHealth}
      />
  );
}

function DashboardContent({
  discovery,
  report,
  reportingMode,
  setReportingMode,
  dashboardTab,
  setDashboardTab,
  monthsBack,
  setMonthsBack,
  asOfDate,
  hasLines,
  isBalanced,
  showUnbalanced,
  tableLoading,
  tableError,
  setRefreshTrigger,
  successToast,
  syncBanner,
  syncBannerOutOfRange,
  todayYmd,
  newEntryOpen,
  setNewEntryOpen,
  aiReviewOpen,
  setAiReviewOpen,
  setSuccessToast,
  setSyncBanner,
  drillDown,
  setDrillDown,
  setReport,
  revalueResult,
  setRevalueResult,
  revalueLoading,
  setRevalueLoading,
  ledgerHealth,
  ledgerHealthLoading,
  setLedgerHealth,
}: {
  discovery: DiscoveryResponse | null;
  report: BalanceSheetResponse | null;
  reportingMode: ReportingMode;
  setReportingMode: (m: ReportingMode) => void;
  dashboardTab: 'balance-sheet' | 'alerts';
  setDashboardTab: (t: 'balance-sheet' | 'alerts') => void;
  monthsBack: number;
  setMonthsBack: (n: number) => void;
  asOfDate: string;
  hasLines: boolean;
  isBalanced: boolean;
  showUnbalanced: boolean;
  tableLoading: boolean;
  tableError: string | null;
  setRefreshTrigger: (fn: (t: number) => number) => void;
  successToast: string | null;
  syncBanner: { postingDate: string } | null;
  syncBannerOutOfRange: boolean;
  todayYmd: string;
  newEntryOpen: boolean;
  setNewEntryOpen: (o: boolean) => void;
  aiReviewOpen: boolean;
  setAiReviewOpen: (o: boolean) => void;
  setSuccessToast: (s: string | null) => void;
  setSyncBanner: (s: { postingDate: string } | null) => void;
  drillDown: { accountCode: string; accountName?: string } | null;
  setDrillDown: (d: { accountCode: string; accountName?: string } | null) => void;
  setReport: (r: BalanceSheetResponse | null) => void;
  revalueResult: { insight: string; totalUnrealizedGainLossCents: number } | null;
  setRevalueResult: (r: { insight: string; totalUnrealizedGainLossCents: number } | null) => void;
  revalueLoading: boolean;
  setRevalueLoading: (v: boolean) => void;
  ledgerHealth: { exceptions: { type: string; entryId: string; lineId?: string; accountCode?: string; reason: string; humanReadable: string }[]; closeReadinessScore: number } | null;
  ledgerHealthLoading: boolean;
  setLedgerHealth: (h: { exceptions: { type: string; entryId: string; lineId?: string; accountCode?: string; reason: string; humanReadable: string }[]; closeReadinessScore: number } | null) => void;
}) {
  const { formatCurrency, formatDate, formatDateMedium } = useLocale();
  const { canPost } = usePermissions(); // used for conditional UI; PermissionGuard enforces button-level ACL

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {successToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-4 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-medium text-white shadow-lg"
        >
          {successToast}
        </div>
      )}
      {syncBannerOutOfRange && (
        <div className="mx-auto max-w-4xl px-4 pt-4 sm:px-6">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Entry saved! Note: This entry is dated {formatDate(syncBanner!.postingDate)}. Your
            current view is as of {formatDate(todayYmd)}.{' '}
            <button
              type="button"
              onClick={() => {
                setRefreshTrigger((t) => t + 1);
                setSyncBanner(null);
              }}
              className="font-medium text-amber-800 underline hover:no-underline"
            >
              Click here to refresh view
            </button>
          </div>
        </div>
      )}
      {discovery && drillDown && (
        <AccountDrillDown
          open={true}
          onClose={() => setDrillDown(null)}
          tenantId={discovery.tenantId}
          parentEntityId={discovery.parentEntityId}
          accountCode={drillDown.accountCode}
          accountName={drillDown.accountName}
        />
      )}
      {discovery && (
        <>
          <NewJournalEntry
            open={newEntryOpen}
            onClose={() => setNewEntryOpen(false)}
            tenantId={discovery.tenantId}
            entityId={discovery.parentEntityId}
            onSuccess={(info) => {
              setRefreshTrigger((t) => t + 1);
              const entityName = discovery.parentEntityName ?? 'Entity';
              const modeLabel = reportingMode === 'consolidated' ? 'Consolidated' : 'Individual';
              setSuccessToast(`Entry saved to ${entityName}. View it in ${modeLabel} mode.`);
              if (info?.postingDate) setSyncBanner({ postingDate: info.postingDate });
            }}
          />
          <AIEntryReview
            open={aiReviewOpen}
            onClose={() => setAiReviewOpen(false)}
            tenantId={discovery.tenantId}
            entityId={discovery.parentEntityId}
            onSuccess={(info) => {
              setRefreshTrigger((t) => t + 1);
              const entityName = discovery.parentEntityName ?? 'Entity';
              setSuccessToast(`AI-suggested entry posted to ${entityName}.`);
              if (info?.postingDate) setSyncBanner({ postingDate: info.postingDate });
            }}
          />
        </>
      )}
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <div className="no-print mb-6 flex flex-wrap items-center gap-4 border-b border-slate-200">
          <button
            type="button"
            onClick={() => setDashboardTab('balance-sheet')}
            className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
              dashboardTab === 'balance-sheet'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Balance Sheet
          </button>
          <button
            type="button"
            onClick={() => setDashboardTab('alerts')}
            className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
              dashboardTab === 'alerts'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            AI Alerts
          </button>
        </div>

        <header className="no-print header mb-8 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {discovery?.parentEntityName ? `${discovery.parentEntityName} Ledger` : 'Ledger'}
          </h1>
          {isBalanced && (
            <span className="flex-shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-800">
              Balanced
            </span>
          )}
          {showUnbalanced && (
            <span className="flex-shrink-0 rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-800">
              Unbalanced
            </span>
          )}
          {ledgerHealthLoading && (
            <span className="flex-shrink-0 rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
              Close readiness…
            </span>
          )}
          {!ledgerHealthLoading && ledgerHealth != null && (
            ledgerHealth.closeReadinessScore >= 100 ? (
              <span className="flex-shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-800">
                Books are Clean
              </span>
            ) : (
              <span className="flex-shrink-0 rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800">
                Close Readiness: {Math.round(ledgerHealth.closeReadinessScore)}%
              </span>
            )
          )}
          <div className="ml-auto flex items-center gap-2">
            <PermissionGuard requiredRole="EDITOR">
              {discovery && (
                <button
                  type="button"
                  onClick={async () => {
                    setRevalueLoading(true);
                    setRevalueResult(null);
                    try {
                      const res = await fetch(`/api/tenants/${encodeURIComponent(discovery.tenantId)}/revalue`);
                      const data = await res.json().catch(() => ({}));
                      if (res.ok && data.insight != null) {
                        setRevalueResult({
                          insight: data.insight,
                          totalUnrealizedGainLossCents: data.totalUnrealizedGainLossCents ?? 0,
                        });
                      }
                    } finally {
                      setRevalueLoading(false);
                    }
                  }}
                  disabled={revalueLoading}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                >
                  {revalueLoading ? 'Revaluing…' : 'Revalue'}
                </button>
              )}
            </PermissionGuard>
            <PermissionGuard requiredRole="EDITOR">
              <button
                type="button"
                onClick={() => setAiReviewOpen(true)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
              >
                AI Review
              </button>
              <button
                type="button"
                onClick={() => setNewEntryOpen(true)}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
              >
                New Entry
              </button>
            </PermissionGuard>
          </div>
        </header>

        {!ledgerHealthLoading && ledgerHealth != null && ledgerHealth.exceptions.length > 0 && (
          <div className="no-print mb-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">
              AI Insights &amp; Exceptions
            </h2>
            <ul className="space-y-2">
              {ledgerHealth.exceptions.map((ex, idx) => (
                <li
                  key={`${ex.entryId}-${ex.lineId ?? idx}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-100 bg-slate-50/50 px-3 py-2"
                >
                  <span className="text-sm text-slate-800">{ex.humanReadable}</span>
                  <button
                    type="button"
                    onClick={() => ex.accountCode && setDrillDown({ accountCode: ex.accountCode })}
                    disabled={!ex.accountCode}
                    className="shrink-0 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Fix
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {revalueResult && (
          <div className="no-print mx-auto max-w-4xl px-4 sm:px-6 mb-4">
            <div className="rounded-lg border border-indigo-200 bg-indigo-50/80 px-4 py-3 text-sm text-indigo-900">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-indigo-800">Unrealized Gain/Loss (AI insight)</p>
                  <p className="mt-1">{revalueResult.insight}</p>
                  <p className="mt-2 font-mono text-indigo-800">
                    Total: {formatCurrency(revalueResult.totalUnrealizedGainLossCents)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRevalueResult(null)}
                  className="shrink-0 rounded p-1 text-indigo-600 hover:bg-indigo-100"
                  aria-label="Dismiss"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {dashboardTab === 'alerts' && discovery && (
          <DashboardAlerts tenantId={discovery.tenantId} parentEntityId={discovery.parentEntityId} />
        )}

        {dashboardTab === 'balance-sheet' && (
        <>
        <div className="no-print mb-4">
          <p className="mb-2 text-sm font-medium text-slate-700">Time Travel</p>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={0}
              max={12}
              value={monthsBack}
              onChange={(e) => setMonthsBack(Number(e.target.value))}
              className="h-2 w-48 max-w-full flex-1 cursor-pointer appearance-none rounded-lg bg-slate-200 accent-indigo-600"
            />
            <span className="text-sm font-medium text-slate-600">
              {monthsBack === 0 ? 'Today' : `${monthsBack} mo. ago`} — As of {formatDateMedium(asOfDate)}
            </span>
          </div>
        </div>
        <div className="no-print mb-6 flex flex-wrap items-end gap-4">
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Reporting Mode</p>
            <div
              className="inline-flex rounded-lg border border-slate-200 bg-slate-50/80 p-0.5"
              role="tablist"
              aria-label="Reporting Mode"
            >
              <button
                type="button"
                role="tab"
                aria-selected={reportingMode === 'consolidated'}
                onClick={() => setReportingMode('consolidated')}
                className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  reportingMode === 'consolidated'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Consolidated
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={reportingMode === 'entity'}
                onClick={() => setReportingMode('entity')}
                className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  reportingMode === 'entity'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Individual Entities
              </button>
            </div>
            {tableLoading && (
              <p className="mt-2 text-sm text-slate-500">Updating…</p>
            )}
            {tableError && (
              <p className="mt-2 text-sm text-amber-700">
                {tableError}
                <button
                  type="button"
                  onClick={() => setRefreshTrigger((t) => t + 1)}
                  className="ml-2 font-medium underline hover:no-underline"
                >
                  Retry
                </button>
              </p>
            )}
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => hasLines && downloadBalanceSheetCsv(report!.lines, formatCurrency)}
              disabled={!hasLines}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
            >
              Print PDF
            </button>
          </div>
        </div>

        <h2 className="mb-2 hidden text-lg font-semibold print:block">
          Balance Sheet
        </h2>
        <div
          key={`${reportingMode}-${report?.asOfDate ?? ''}-${report?.lines?.length ?? 0}`}
          className="rounded-xl border border-slate-200/80 bg-white/95 shadow-sm backdrop-blur-sm animate-[fade-in_0.25s_ease-out] print:border-0 print:shadow-none"
        >
          <div className="overflow-x-auto">
            <table className="balance-sheet-table saas-table w-full min-w-[32rem] table-fixed text-left print:min-w-0">
              <colgroup>
                <col className="w-[45%]" />
                <col className="w-[25%]" />
                <col className="w-[30%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Account Name
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Code
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody>
                {hasLines ? (
                  report?.lines.map((line) => {
                    const isNci = line.accountCode === 'NCI';
                    return (
                      <tr
                        key={line.accountCode}
                        className={
                          isNci
                            ? 'border-b border-slate-100 bg-amber-50/70'
                            : 'border-b border-slate-100 last:border-b-0'
                        }
                      >
                        <td className="px-5 py-3 text-slate-800">
                          <button
                            type="button"
                            onClick={() => setDrillDown({ accountCode: line.accountCode, accountName: line.accountName })}
                            className="flex items-center gap-1.5 text-left font-medium text-indigo-600 hover:text-indigo-800 hover:underline focus:outline-none focus:underline"
                          >
                            <span>{line.accountName ?? '—'}</span>
                            <svg className="h-4 w-4 shrink-0 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                            </svg>
                          </button>
                        </td>
                        <td className="px-5 py-3 font-mono text-sm text-slate-600">
                          {isNci ? (
                            <span
                              className="nci-tooltip cursor-help border-b border-dotted border-amber-600/60"
                              data-tooltip="Non-controlling interest represents the portion of equity in a subsidiary not attributable to the parent."
                            >
                              {line.accountCode}
                            </span>
                          ) : (
                            line.accountCode
                          )}
                        </td>
                        <td className="px-5 py-3 text-right font-mono text-sm tabular-nums text-slate-800">
                          {formatCurrency(line.amountCents)}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-5 py-12 text-center text-slate-500"
                    >
                      No data found for this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {report?.asOfDate && (
          <p className="mt-4 text-sm text-slate-500 print:mt-2">
            As of {formatDateMedium(report.asOfDate)}
          </p>
        )}
        </>
        )}
      </div>
    </div>
  );
}
