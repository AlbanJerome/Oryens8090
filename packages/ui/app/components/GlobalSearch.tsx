'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTenantStore } from '../store/tenant-store';
import { OryensSpinner } from './OryensSpinner';

type AccountOption = { code: string; name: string };

export function GlobalSearch({
  open,
  onClose,
  onSelectAccount,
}: {
  open: boolean;
  onClose: () => void;
  onSelectAccount?: (accountCode: string, accountName: string) => void;
}) {
  const router = useRouter();
  const activeTenantId = useTenantStore((s) => s.activeTenantId);
  const [query, setQuery] = useState('');
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const fetchAccounts = useCallback(() => {
    if (!activeTenantId) {
      setAccounts([]);
      return;
    }
    setLoading(true);
    fetch(`/api/tenants/${encodeURIComponent(activeTenantId)}/accounts`)
      .then((r) => r.json())
      .then((d) => {
        const list = (d?.accounts ?? []).map((a: { code: string; name: string }) => ({ code: a.code, name: a.name }));
        setAccounts(list);
      })
      .catch(() => setAccounts([]))
      .finally(() => setLoading(false));
  }, [activeTenantId]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      fetchAccounts();
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open, fetchAccounts]);

  const filtered = query.trim()
    ? accounts.filter(
        (a) =>
          a.name.toLowerCase().includes(query.toLowerCase()) ||
          a.code.toLowerCase().includes(query.toLowerCase())
      )
    : accounts.slice(0, 20);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (!el) return;
    const child = el.children[selectedIndex] as HTMLElement;
    child?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex, open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === 'Escape') {
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => (i + 1) % Math.max(1, filtered.length));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => (i - 1 + filtered.length) % Math.max(1, filtered.length));
      return;
    }
    if (e.key === 'Enter' && filtered[selectedIndex]) {
      e.preventDefault();
      const item = filtered[selectedIndex];
      if (onSelectAccount) {
        onSelectAccount(item.code, item.name);
      } else {
        const params = new URLSearchParams();
        if (activeTenantId) params.set('tenantId', activeTenantId);
        params.set('drill', item.code);
        params.set('drillName', item.name);
        router.push(`/?${params.toString()}`);
      }
      onClose();
    }
  };

  const handleSelect = (item: AccountOption) => {
    if (onSelectAccount) {
      onSelectAccount(item.code, item.name);
    } else {
      const params = new URLSearchParams();
      if (activeTenantId) params.set('tenantId', activeTenantId);
      params.set('drill', item.code);
      params.set('drillName', item.name);
      router.push(`/?${params.toString()}`);
    }
    onClose();
  };

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm"
        aria-hidden
        onClick={onClose}
      />
      <div
        className="fixed left-1/2 top-[20%] z-[101] w-full max-w-xl -translate-x-1/2 rounded-xl border border-slate-200/80 bg-white/95 p-2 shadow-2xl backdrop-blur-sm"
        role="dialog"
        aria-label="Search accounts"
      >
        <div className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-slate-50/50 px-3 py-2">
          <svg className="h-5 w-5 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search account names or codes…"
            className="min-w-0 flex-1 bg-transparent text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
          <kbd className="hidden rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500 sm:inline">⌘K</kbd>
        </div>
        <ul
          ref={listRef}
          className="mt-2 max-h-64 overflow-auto py-1"
        >
          {loading && (
            <li className="flex flex-col items-center gap-2 px-3 py-4 text-center text-sm text-slate-500">
              <OryensSpinner className="oryens-spinner" />
              Loading accounts…
            </li>
          )}
          {!loading && filtered.length === 0 && (
            <li className="px-3 py-4 text-center text-sm text-slate-500">No accounts match.</li>
          )}
          {!loading &&
            filtered.map((item, i) => (
              <li key={item.code}>
                <button
                  type="button"
                  onClick={() => handleSelect(item)}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm ${
                    i === selectedIndex ? 'bg-emerald-50 text-emerald-900' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="font-medium">{item.name}</span>
                  <span className="font-mono text-slate-500">{item.code}</span>
                </button>
              </li>
            ))}
        </ul>
      </div>
    </>
  );
}
