'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { CreateJournalEntryCommandValidator } from '@oryens/core';
import { useLocale } from '../context/LocaleContext';
import { getRate } from '../lib/currency-service';

function dollarStringToCents(s: string): number {
  const cleaned = s.replace(/[$\s,]/g, '').trim();
  if (!cleaned) return 0;
  const parsed = parseFloat(cleaned);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 100);
}

const CURRENCY_OPTIONS = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'CNY'] as const;

function toSmallestUnit(amount: number, currencyCode: string): number {
  const noSubunit = ['JPY', 'CNY'];
  return noSubunit.includes(currencyCode.toUpperCase()) ? Math.round(amount) : Math.round(amount * 100);
}

export type JournalEntryLineDraft = {
  id: string;
  accountCode: string;
  debitAmountCents: number;
  creditAmountCents: number;
  transactionAmountCents?: number;
  transactionCurrencyCode?: string;
  exchangeRate?: number;
};

export type CustomField = { key: string; value: string };

type AccountItem = {
  id: string;
  code: string;
  name: string;
  accountType: string;
};

type OpenPeriodItem = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
};

function accountTypeBadgeClass(accountType: string): string {
  const t = (accountType || '').toLowerCase();
  if (t === 'asset') return 'bg-slate-100 text-slate-700';
  if (t === 'liability') return 'bg-amber-100 text-amber-800';
  if (t === 'equity') return 'bg-emerald-100 text-emerald-800';
  if (t === 'revenue') return 'bg-blue-100 text-blue-800';
  if (t === 'expense') return 'bg-rose-100 text-rose-800';
  return 'bg-slate-100 text-slate-600';
}

/** Mock AI: parses natural language and returns a suggested journal entry. */
type SuggestedLine = { accountCode: string; debitAmountCents: number; creditAmountCents: number };
type SuggestionResult = { description: string; lines: SuggestedLine[]; confidence: number; postingDate?: string };

function parseAmountCentsFallback(raw: string): number {
  const noCommas = raw.replace(/,/g, '');
  const kMatch = noCommas.match(/\$?\s*(\d+(?:\.\d+)?)\s*k\b/i);
  if (kMatch) return Math.round(parseFloat(kMatch[1]) * 1000 * 100);
  const mMatch = noCommas.match(/\$?\s*(\d+(?:\.\d+)?)\s*m\b/i);
  if (mMatch) return Math.round(parseFloat(mMatch[1]) * 1000000 * 100);
  // Do not match bare number when followed by k/m (e.g. 5k → 5000, not 5)
  const match =
    noCommas.match(/\$?\s*(\d+(?:\.\d{1,2})?)(?!\s*k\b)(?!\s*m\b)\s*(?:dollars?|usd)?/i) ||
    noCommas.match(/(\d+(?:\.\d{1,2})?)(?!\s*k\b)(?!\s*m\b)\s*\$?/i);
  if (!match) return 0;
  return Math.round(parseFloat(match[1]) * 100);
}

function extractDateFallback(raw: string): string | null {
  const dmy = raw.match(/(?:on|due|date)?\s*(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/i);
  if (dmy) {
    const a = parseInt(dmy[1], 10);
    const b = parseInt(dmy[2], 10);
    const c = parseInt(dmy[3], 10);
    const year = c < 100 ? (c >= 50 ? 1900 + c : 2000 + c) : c;
    if (a >= 1 && a <= 31 && b >= 1 && b <= 12) {
      const d = new Date(year, b - 1, a);
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
    if (b >= 1 && b <= 31 && a >= 1 && a <= 12) {
      const d = new Date(year, a - 1, b);
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
  }
  const months: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  const ord = raw.match(/(?:on|due)?\s*(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{2,4})\b/i);
  if (ord) {
    const day = parseInt(ord[1], 10);
    const month = months[ord[2].toLowerCase().slice(0, 3)];
    const y = parseInt(ord[3], 10);
    const year = y < 100 ? (y >= 50 ? 1900 + y : 2000 + y) : y;
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  // "12 of may", "12 of may this year"
  const dayOfMonth = raw.match(/(\d{1,2})\s+of\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*(?:this\s+year|(\d{2,4}))?\b/i);
  if (dayOfMonth) {
    const day = parseInt(dayOfMonth[1], 10);
    const month = months[dayOfMonth[2].toLowerCase().slice(0, 3)];
    const yearVal = dayOfMonth[3];
    const year = yearVal
      ? (() => {
          const y = parseInt(yearVal, 10);
          return y < 100 ? (y >= 50 ? 1900 + y : 2000 + y) : y;
        })()
      : new Date().getFullYear();
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return null;
}

function suggestJournalEntryFromText(
  userInput: string,
  availableAccounts: AccountItem[]
): Promise<SuggestionResult> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const trimmed = userInput.trim();
      const amountCents = parseAmountCentsFallback(trimmed);
      const postingDate = extractDateFallback(trimmed);
      const description = trimmed || 'Transaction';
      const assets = availableAccounts.filter((a) => a.accountType.toLowerCase() === 'asset');
      const expenses = availableAccounts.filter((a) => a.accountType.toLowerCase() === 'expense');
      const equity = availableAccounts.filter((a) => a.accountType.toLowerCase() === 'equity');

      const creditAccount = assets[0];
      const debitAccount = expenses[0] ?? equity[0] ?? assets[1] ?? assets[0];

      const lines: SuggestedLine[] =
        amountCents > 0 && creditAccount && debitAccount
          ? [
              { accountCode: debitAccount.code, debitAmountCents: amountCents, creditAmountCents: 0 },
              { accountCode: creditAccount.code, debitAmountCents: 0, creditAmountCents: amountCents },
            ]
          : [
              { accountCode: assets[0]?.code ?? '', debitAmountCents: 0, creditAmountCents: 0 },
              { accountCode: assets[1]?.code ?? equity[0]?.code ?? '', debitAmountCents: 0, creditAmountCents: 0 },
            ];

      const confidence = Math.round(85 + Math.random() * 12);
      resolve({ description, lines, confidence, ...(postingDate ? { postingDate } : {}) });
    }, 400);
  });
}

function AccountCombobox({
  accounts,
  loading,
  value,
  onChange,
  placeholder,
  id,
  disabled,
}: {
  accounts: AccountItem[];
  loading: boolean;
  value: string;
  onChange: (code: string) => void;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => accounts.find((a) => a.code === value),
    [accounts, value]
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return accounts;
    const q = query.toLowerCase();
    return accounts.filter(
      (a) =>
        a.code.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        (a.accountType && a.accountType.toLowerCase().includes(q))
    );
  }, [accounts, query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayText = selected
    ? `${selected.name} (${selected.code}) · ${selected.accountType || '—'}`
    : value || '';

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <input
          id={id}
          type="text"
          value={open ? query : displayText}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setOpen(false);
              setQuery('');
            }
            if (e.key === 'Enter' && filtered.length === 1) {
              onChange(filtered[0].code);
              setOpen(false);
              setQuery('');
            }
          }}
          placeholder={loading ? 'Loading accounts…' : placeholder ?? 'Search by account name, code, or category…'}
          disabled={disabled || loading}
          className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 pr-8 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-500"
          autoComplete="off"
        />
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </div>
      {open && !loading && (
        <ul
          className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          role="listbox"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-500">No accounts match</li>
          ) : (
            filtered.map((account) => (
              <li
                key={account.id}
                role="option"
                aria-selected={account.code === value}
                onClick={() => {
                  onChange(account.code);
                  setOpen(false);
                  setQuery('');
                }}
                className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-slate-50 ${account.code === value ? 'bg-indigo-50' : ''}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="font-medium text-slate-800">{account.name}</span>
                  <span className="ml-1.5 font-mono text-slate-500">({account.code})</span>
                </span>
                {account.accountType && (
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${accountTypeBadgeClass(account.accountType)}`}
                    title={`Category: ${account.accountType}`}
                  >
                    {account.accountType}
                  </span>
                )}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

type Props = {
  open: boolean;
  onClose: () => void;
  tenantId: string;
  entityId: string;
  onSuccess: (info?: { postingDate: string }) => void;
};

export function NewJournalEntry({ open, onClose, tenantId, entityId, onSuccess }: Props) {
  const { formatCurrency, formatDate, currencyCode: baseCurrency } = useLocale();
  const centsToDisplay = (cents: number) => (cents === 0 ? '' : formatCurrency(cents));

  const [entryTransactionCurrency, setEntryTransactionCurrency] = useState<string>('USD');
  const [entryExchangeRate, setEntryExchangeRate] = useState<number | null>(null);
  const [rateLoading, setRateLoading] = useState(false);

  useEffect(() => {
    if (entryTransactionCurrency === baseCurrency || !entryTransactionCurrency) {
      setEntryExchangeRate(1);
      return;
    }
    let cancelled = false;
    setRateLoading(true);
    getRate(entryTransactionCurrency, baseCurrency)
      .then((rate) => {
        if (!cancelled) setEntryExchangeRate(rate);
      })
      .catch(() => {
        if (!cancelled) setEntryExchangeRate(null);
      })
      .finally(() => {
        if (!cancelled) setRateLoading(false);
      });
    return () => { cancelled = true; };
  }, [entryTransactionCurrency, baseCurrency]);

  const [postingDate, setPostingDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<JournalEntryLineDraft[]>([
    { id: crypto.randomUUID(), accountCode: '', debitAmountCents: 0, creditAmountCents: 0 },
    { id: crypto.randomUUID(), accountCode: '', debitAmountCents: 0, creditAmountCents: 0 },
  ]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [openPeriods, setOpenPeriods] = useState<OpenPeriodItem[]>([]);
  const [periodsLoading, setPeriodsLoading] = useState(false);
  const [assistantInput, setAssistantInput] = useState('');
  const [suggesting, setSuggesting] = useState(false);
  const [confidenceScore, setConfidenceScore] = useState<number | null>(null);
  const [magicFillActive, setMagicFillActive] = useState(false);

  useEffect(() => {
    if (!open || !tenantId) return;
    let cancelled = false;
    setAccountsLoading(true);
    setPeriodsLoading(true);
    Promise.all([
      fetch(`/api/tenants/${encodeURIComponent(tenantId)}/accounts`).then((r) => r.json()),
      fetch(`/api/tenants/${encodeURIComponent(tenantId)}/accounting-periods`).then((r) => r.json()),
    ])
      .then(([accountsData, periodsData]) => {
        if (cancelled) return;
        setAccounts(accountsData.accounts ?? []);
        setOpenPeriods(periodsData.periods ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setAccounts([]);
          setOpenPeriods([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAccountsLoading(false);
          setPeriodsLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [open, tenantId]);

  const dateInOpenPeriod = useMemo(() => {
    if (openPeriods.length === 0) return true;
    const d = postingDate;
    if (!d || d.length < 10) return false;
    return openPeriods.some(
      (p) => d >= p.startDate && d <= p.endDate
    );
  }, [postingDate, openPeriods]);

  const firstOpenPeriodTip = useMemo(() => {
    if (openPeriods.length === 0) return null;
    const p = openPeriods[0];
    const start = formatDate(p.startDate);
    const end = formatDate(p.endDate);
    return `Tip: Use a date between ${start} and ${end}`;
  }, [openPeriods, formatDate]);

  const draftCommand = useMemo(() => ({
    tenantId,
    entityId,
    postingDate: new Date(postingDate),
    sourceModule: 'MANUAL',
    sourceDocumentId: '',
    sourceDocumentType: 'JOURNAL',
    description: description.trim(),
    currency: (baseCurrency === 'USD' ? 'USD' : 'USD') as 'USD',
    lines: lines.map((l) => ({
      accountCode: l.accountCode.trim(),
      debitAmountCents: l.debitAmountCents,
      creditAmountCents: l.creditAmountCents,
      transactionAmountCents: l.transactionAmountCents,
      transactionCurrencyCode: l.transactionCurrencyCode,
      exchangeRate: l.exchangeRate,
    })),
  }), [tenantId, entityId, postingDate, description, lines, baseCurrency]);

  const validation = useMemo(
    () => CreateJournalEntryCommandValidator.validate(draftCommand),
    [draftCommand]
  );

  const totalDebitsCents = useMemo(
    () => lines.reduce((s, l) => s + l.debitAmountCents, 0),
    [lines]
  );
  const totalCreditsCents = useMemo(
    () => lines.reduce((s, l) => s + l.creditAmountCents, 0),
    [lines]
  );
  const isBalanced = totalDebitsCents === totalCreditsCents && totalDebitsCents > 0;
  const canSave =
    validation.isValid &&
    isBalanced &&
    dateInOpenPeriod;

  const updateLine = (id: string, patch: Partial<JournalEntryLineDraft>) => {
    setLines((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...patch } : l))
    );
  };

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        accountCode: '',
        debitAmountCents: 0,
        creditAmountCents: 0,
      },
    ]);
  };

  const removeLine = (id: string) => {
    setLines((prev) => (prev.length > 2 ? prev.filter((l) => l.id !== id) : prev));
  };

  const handleSuggestLines = async () => {
    const text = assistantInput.trim();
    if (!text || accounts.length === 0) return;
    setSuggesting(true);
    setConfidenceScore(null);
    try {
      const aiServiceUrl = typeof process.env.NEXT_PUBLIC_AI_SERVICE_URL === 'string' && process.env.NEXT_PUBLIC_AI_SERVICE_URL
        ? process.env.NEXT_PUBLIC_AI_SERVICE_URL
        : 'http://localhost:8090';
      let result: {
        description: string;
        lines: SuggestedLine[];
        confidence: number;
        confidenceScore?: number;
        postingDate?: string;
      };
      try {
        const res = await fetch(`${aiServiceUrl}/v1/ai/interpret-transaction`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rawInput: text,
            accounts: accounts.map((a) => ({ code: a.code, name: a.name, accountType: a.accountType })),
          }),
        });
        if (res.ok) {
          const data = await res.json();
          result = {
            description: data.description ?? text,
            lines: Array.isArray(data.lines) ? data.lines : [],
            confidence: typeof data.confidenceScore === 'number' ? data.confidenceScore : 75,
            postingDate: typeof data.postingDate === 'string' ? data.postingDate : undefined,
          };
        } else {
          result = await suggestJournalEntryFromText(text, accounts);
        }
      } catch {
        result = await suggestJournalEntryFromText(text, accounts);
      }
      setDescription(result.description);
      setConfidenceScore(result.confidenceScore ?? result.confidence);
      if (result.postingDate) setPostingDate(result.postingDate);
      const newLines: JournalEntryLineDraft[] = result.lines.slice(0, 2).map((l) => ({
        id: crypto.randomUUID(),
        accountCode: l.accountCode,
        debitAmountCents: l.debitAmountCents,
        creditAmountCents: l.creditAmountCents,
      }));
      if (newLines.length < 2) {
        while (newLines.length < 2) {
          newLines.push({
            id: crypto.randomUUID(),
            accountCode: '',
            debitAmountCents: 0,
            creditAmountCents: 0,
          });
        }
      }
      setTimeout(() => {
        setLines(newLines);
        setMagicFillActive(true);
        setTimeout(() => setMagicFillActive(false), 600);
      }, 220);
    } finally {
      setSuggesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    setSubmitError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/tenants/${encodeURIComponent(tenantId)}/journal-entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityId,
          postingDate,
          description: description.trim(),
          lines: lines.map((l) => ({
            accountCode: l.accountCode.trim(),
            debitAmountCents: l.debitAmountCents,
            creditAmountCents: l.creditAmountCents,
            ...(l.transactionAmountCents != null && l.transactionCurrencyCode && l.exchangeRate != null
              ? {
                  transactionAmountCents: l.transactionAmountCents,
                  transactionCurrencyCode: l.transactionCurrencyCode,
                  exchangeRate: l.exchangeRate,
                }
              : {}),
          })),
          metadata: customFields.length > 0
            ? customFields.reduce<Record<string, string>>((acc, { key, value }) => {
                if (key.trim()) acc[key.trim()] = value;
                return acc;
              }, {})
            : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitError(data.error || `Request failed (${res.status})`);
        return;
      }
      onSuccess({ postingDate });
      onClose();
      setDescription('');
      setPostingDate(new Date().toISOString().slice(0, 10));
      setLines([
        { id: crypto.randomUUID(), accountCode: '', debitAmountCents: 0, creditAmountCents: 0 },
        { id: crypto.randomUUID(), accountCode: '', debitAmountCents: 0, creditAmountCents: 0 },
      ]);
      setCustomFields([]);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-slate-900/30"
        aria-hidden
        onClick={onClose}
      />
      <div
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col border-l border-slate-200 bg-white shadow-xl sm:w-[28rem]"
        role="dialog"
        aria-labelledby="new-entry-title"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 id="new-entry-title" className="text-lg font-semibold text-slate-900">
            New Journal Entry
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <span className="sr-only">Close</span>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className={`flex-1 overflow-y-auto px-5 py-4 ${magicFillActive ? 'animate-magic-fill' : ''}`}>
            <div className="space-y-4">
              <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-3">
                <label htmlFor="assistant-input" className="mb-1.5 block text-sm font-medium text-indigo-900">
                  Transaction Assistant
                </label>
                <textarea
                  id="assistant-input"
                  value={assistantInput}
                  onChange={(e) => setAssistantInput(e.target.value)}
                  placeholder="e.g. Paid $200 for coffee"
                  rows={2}
                  className="mb-2 w-full resize-none rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  disabled={suggesting || accountsLoading}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSuggestLines}
                    disabled={!assistantInput.trim() || suggesting || accounts.length === 0}
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {suggesting ? 'Suggesting…' : 'Suggest Lines'}
                  </button>
                  {confidenceScore != null && (
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                      {confidenceScore}% match with historical data
                    </span>
                  )}
                </div>
              </div>
              <div>
                <label htmlFor="je-date" className="mb-1 block text-sm font-medium text-slate-700">
                  Date
                </label>
                <input
                  id="je-date"
                  type="date"
                  value={postingDate}
                  onChange={(e) => setPostingDate(e.target.value)}
                  className={`w-full rounded-lg border px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 ${
                    !periodsLoading && openPeriods.length > 0 && !dateInOpenPeriod
                      ? 'border-amber-500 focus:border-amber-500 focus:ring-amber-500'
                      : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500'
                  }`}
                />
                {!periodsLoading && firstOpenPeriodTip && (
                  <p className="mt-1 text-xs text-slate-500">{firstOpenPeriodTip}</p>
                )}
                {!periodsLoading && openPeriods.length > 0 && !dateInOpenPeriod && (
                  <p className="mt-1 text-sm text-amber-700">
                    Selected date is not within an open accounting period.
                  </p>
                )}
                {!periodsLoading && openPeriods.length === 0 && (
                  <p className="mt-1 text-xs text-slate-500">
                    No open periods found; posting may fail until one is created.
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="je-desc" className="mb-1 block text-sm font-medium text-slate-700">
                  Description
                </label>
                <input
                  id="je-desc"
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Monthly rent"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                />
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Transaction currency</label>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={entryTransactionCurrency}
                    onChange={(e) => setEntryTransactionCurrency(e.target.value)}
                    className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                  >
                    {CURRENCY_OPTIONS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  {entryTransactionCurrency !== baseCurrency && (
                    <span className="text-xs text-slate-600">
                      {rateLoading ? 'Loading rate…' : entryExchangeRate != null ? `1 ${entryTransactionCurrency} = ${entryExchangeRate.toFixed(6)} ${baseCurrency}` : 'Rate unavailable'}
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-700">Custom Fields</label>
                  <button
                    type="button"
                    onClick={() => setCustomFields((prev) => [...prev, { key: '', value: '' }])}
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
                  >
                    + Add field
                  </button>
                </div>
                <p className="mb-2 text-xs text-slate-500">
                  Optional key-value pairs (e.g. Department, Project, ReferenceID) stored in entry metadata.
                </p>
                <div className="space-y-2">
                  {customFields.map((cf, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input
                        type="text"
                        value={cf.key}
                        onChange={(e) =>
                          setCustomFields((prev) =>
                            prev.map((f, i) => (i === idx ? { ...f, key: e.target.value } : f))
                          )
                        }
                        placeholder="Key"
                        className="flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
                      />
                      <input
                        type="text"
                        value={cf.value}
                        onChange={(e) =>
                          setCustomFields((prev) =>
                            prev.map((f, i) => (i === idx ? { ...f, value: e.target.value } : f))
                          )
                        }
                        placeholder="Value"
                        className="flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setCustomFields((prev) => prev.filter((_, i) => i !== idx))}
                        className="shrink-0 rounded p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                        aria-label="Remove field"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs text-slate-500">
                  Select by account name or code; category (Asset, Liability, etc.) is shown.
                </p>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">Lines</span>
                  <button
                    type="button"
                    onClick={addLine}
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
                  >
                    + Add line
                  </button>
                </div>
                <div className="space-y-3">
                  {lines.map((line) => (
                    <div
                      key={line.id}
                      className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3"
                    >
                      <div className="min-w-0 flex-1 basis-40">
                        <label className="mb-1 block text-xs text-slate-500">Account</label>
                        <AccountCombobox
                          accounts={accounts}
                          loading={accountsLoading}
                          value={line.accountCode}
                          onChange={(code) => updateLine(line.id, { accountCode: code })}
                          placeholder="Search by code or name…"
                          id={`account-${line.id}`}
                          disabled={saving}
                        />
                      </div>
                      {entryTransactionCurrency !== baseCurrency && entryExchangeRate != null && (
                        <div className="w-20 shrink-0">
                          <label className="mb-1 block text-xs text-slate-500">Original ({entryTransactionCurrency})</label>
                          <input
                            type="text"
                            value={line.transactionAmountCents != null ? (line.transactionCurrencyCode === 'JPY' || line.transactionCurrencyCode === 'CNY' ? line.transactionAmountCents : (line.transactionAmountCents / 100).toFixed(2)) : ''}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[,\s]/g, '').trim();
                              if (!raw) {
                                updateLine(line.id, { transactionAmountCents: undefined, transactionCurrencyCode: undefined, exchangeRate: undefined });
                                return;
                              }
                              const amount = parseFloat(raw);
                              if (!Number.isFinite(amount) || amount < 0) return;
                              const txCents = toSmallestUnit(amount, entryTransactionCurrency);
                              const reportingCents = Math.round(txCents * entryExchangeRate * 100);
                              updateLine(line.id, {
                                transactionAmountCents: txCents,
                                transactionCurrencyCode: entryTransactionCurrency,
                                exchangeRate: entryExchangeRate,
                                debitAmountCents: reportingCents,
                                creditAmountCents: 0,
                              });
                            }}
                            placeholder="—"
                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-right font-mono text-sm tabular-nums"
                          />
                        </div>
                      )}
                      <div className="w-24 shrink-0">
                        <label className="mb-1 block text-xs text-slate-500">Debit</label>
                        <input
                          type="text"
                          value={centsToDisplay(line.debitAmountCents)}
                          onChange={(e) =>
                            updateLine(line.id, {
                              debitAmountCents: dollarStringToCents(e.target.value),
                              creditAmountCents: 0,
                            })
                          }
                          placeholder="0.00"
                          className="w-full rounded border border-slate-300 px-2 py-1.5 text-right font-mono text-sm tabular-nums"
                        />
                      </div>
                      <div className="w-24 shrink-0">
                        <label className="mb-1 block text-xs text-slate-500">Credit</label>
                        <input
                          type="text"
                          value={centsToDisplay(line.creditAmountCents)}
                          onChange={(e) =>
                            updateLine(line.id, {
                              creditAmountCents: dollarStringToCents(e.target.value),
                              debitAmountCents: 0,
                            })
                          }
                          placeholder="0.00"
                          className="w-full rounded border border-slate-300 px-2 py-1.5 text-right font-mono text-sm tabular-nums"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeLine(line.id)}
                        disabled={lines.length <= 2}
                        className="shrink-0 rounded p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 disabled:opacity-40"
                        aria-label="Remove line"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
                {validation.errors.length > 0 && (
                  <ul className="mt-2 list-inside list-disc text-sm text-amber-700">
                    {validation.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 bg-slate-50/80 px-5 py-4">
            <div className="mb-3 flex items-center justify-between text-sm">
              <span className="text-slate-600">Live Balance</span>
              {isBalanced ? (
                <span className="font-medium text-emerald-700">Balanced</span>
              ) : (
                <span className="font-mono tabular-nums text-slate-700">
                  Debits {formatCurrency(totalDebitsCents)} — Credits {formatCurrency(totalCreditsCents)}
                  {totalDebitsCents !== totalCreditsCents && (
                    <span className="ml-1 text-amber-700">
                      (diff {formatCurrency(totalDebitsCents - totalCreditsCents)})
                    </span>
                  )}
                </span>
              )}
            </div>
            {submitError && (
              <p className="mb-2 text-sm text-red-600">{submitError}</p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canSave || saving}
                className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}
