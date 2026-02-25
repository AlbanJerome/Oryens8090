'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { GlobalSearch } from './GlobalSearch';

type TenantOption = { tenantId: string; name: string };

const MOCK_USER_NAME = 'Alex Morgan';

const navItems = [
  { href: '/', label: 'Dashboard', icon: DashboardIcon },
  { href: '/audit', label: 'Audit Log', icon: AuditIcon },
  { href: '/chart-of-accounts', label: 'Chart of Accounts', icon: ChartIcon },
  { href: '/settings', label: 'Settings', icon: SettingsIcon },
];

function DashboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  );
}
function AuditIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  );
}
function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}
function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [currentTenantId, setCurrentTenantId] = useState<string | null>(null);
  const [currentTenantName, setCurrentTenantName] = useState<string>('');
  const [userOpen, setUserOpen] = useState(false);
  const [tenantOpen, setTenantOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const tenantIdFromUrl = searchParams.get('tenantId');

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const syncDiscovery = useCallback(() => {
    const url = tenantIdFromUrl
      ? `/api/discovery?tenantId=${encodeURIComponent(tenantIdFromUrl)}`
      : '/api/discovery';
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { tenantId?: string; parentEntityName?: string } | null) => {
        if (d?.tenantId) {
          setCurrentTenantId(d.tenantId);
          setCurrentTenantName(d.parentEntityName ?? d.tenantId);
        }
      })
      .catch(() => {});
  }, [tenantIdFromUrl]);

  useEffect(() => {
    fetch('/api/tenants')
      .then((r) => (r.ok ? r.json() : { tenants: [] }))
      .then((d: { tenants?: TenantOption[] }) => setTenants(d.tenants ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (tenantIdFromUrl) {
      syncDiscovery();
    } else if (tenants.length > 0) {
      setCurrentTenantId(tenants[0].tenantId);
      setCurrentTenantName(tenants[0].name);
    } else {
      syncDiscovery();
    }
  }, [tenantIdFromUrl, tenants.length, syncDiscovery]);

  const setTenant = (tenantId: string) => {
    setTenantOpen(false);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tenantId', tenantId);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex min-h-screen bg-slate-50/95 text-slate-900">
      <aside className="sidebar flex w-56 flex-col border-r border-slate-200/80 bg-white/80 shadow-sm backdrop-blur-sm">
        <div className="border-b border-slate-200/80 px-4 py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight text-slate-900">
            Oryens Ledger
          </Link>
        </div>
        <div className="relative flex-1 px-3 py-4">
          <nav className="space-y-0.5">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href + (tenantIdFromUrl ? `?tenantId=${encodeURIComponent(tenantIdFromUrl)}` : '')}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                  }`}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-6 border-t border-slate-200/80 pt-4">
            <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Tenant
            </p>
            <div className="relative">
              <button
                type="button"
                onClick={() => { setTenantOpen((o) => !o); setUserOpen(false); }}
                className="flex w-full items-center gap-2 rounded-lg border border-slate-200/80 bg-white/80 px-3 py-2 text-left text-sm text-slate-700 shadow-sm hover:bg-slate-50/80"
              >
                <span className="min-w-0 truncate">{currentTenantName || 'Select tenant'}</span>
                <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {tenantOpen && (
                <>
                  <div className="fixed inset-0 z-10" aria-hidden onClick={() => setTenantOpen(false)} />
                  <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                    {tenants.map((t) => (
                      <li key={t.tenantId}>
                        <button
                          type="button"
                          onClick={() => setTenant(t.tenantId)}
                          className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                            currentTenantId === t.tenantId ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700'
                          }`}
                        >
                          {t.name}
                        </button>
                      </li>
                    ))}
                    {tenants.length === 0 && (
                      <li className="px-3 py-2 text-sm text-slate-500">No tenants</li>
                    )}
                  </ul>
                </>
              )}
            </div>
          </div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col min-w-0">
        <header className="flex shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/80 px-6 py-3 shadow-sm backdrop-blur-sm">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white/80 px-3 py-2 text-sm text-slate-500 shadow-sm hover:bg-slate-50/80 hover:text-slate-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span>Search accounts…</span>
            <kbd className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-xs text-slate-400">⌘K</kbd>
          </button>
          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                type="button"
                onClick={() => { setUserOpen((o) => !o); setTenantOpen(false); }}
                className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white/80 px-3 py-2 text-sm text-slate-700 shadow-sm hover:bg-slate-50/80"
              >
                <span className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-medium">
                  {MOCK_USER_NAME.slice(0, 1)}
                </span>
                <span className="hidden sm:inline">Logged in as {MOCK_USER_NAME}</span>
                <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {userOpen && (
                <>
                  <div className="fixed inset-0 z-10" aria-hidden onClick={() => setUserOpen(false)} />
                  <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-lg border border-slate-200 bg-white py-2 shadow-lg">
                    <div className="border-b border-slate-100 px-4 py-2 text-sm text-slate-500">
                      Logged in as <span className="font-medium text-slate-700">{MOCK_USER_NAME}</span>
                    </div>
                    <button
                      type="button"
                      className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                      onClick={() => setUserOpen(false)}
                    >
                      Profile (mock)
                    </button>
                    <button
                      type="button"
                      className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                      onClick={() => setUserOpen(false)}
                    >
                      Sign out (mock)
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
