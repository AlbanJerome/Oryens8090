'use client';

import React, { createContext, useCallback, useContext, useMemo, useState, useEffect } from 'react';

export interface LocaleContextValue {
  locale: string;
  currencyCode: string;
  formatCurrency: (amountCents: number) => string;
  formatDate: (date: Date | string) => string;
  formatDateMedium: (date: Date | string) => string;
  isLoading: boolean;
}

const defaults: LocaleContextValue = {
  locale: 'en-US',
  currencyCode: 'USD',
  formatCurrency: (cents) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100);
  },
  formatDate: (d) => {
    const date = typeof d === 'string' ? new Date(d) : d;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },
  formatDateMedium: (d) => {
    const date = typeof d === 'string' ? new Date(d) : d;
    return date.toLocaleDateString('en-US', { dateStyle: 'medium' });
  },
  isLoading: false,
};

const LocaleContext = createContext<LocaleContextValue>(defaults);

export function LocaleProvider({
  tenantId,
  children,
  defaultLocale = 'en-US',
  defaultCurrencyCode = 'USD',
}: {
  tenantId?: string | null;
  children: React.ReactNode;
  defaultLocale?: string;
  defaultCurrencyCode?: string;
}) {
  const [locale, setLocale] = useState(defaultLocale);
  const [currencyCode, setCurrencyCode] = useState(defaultCurrencyCode);
  const [isLoading, setIsLoading] = useState(!!tenantId);

  useEffect(() => {
    if (!tenantId) {
      setLocale(defaultLocale);
      setCurrencyCode(defaultCurrencyCode);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    fetch(`/api/tenants/${encodeURIComponent(tenantId)}/settings`)
      .then((r) => r.json())
      .then((data: { locale?: string; currencyCode?: string }) => {
        if (cancelled) return;
        setLocale(data.locale ?? defaultLocale);
        setCurrencyCode(data.currencyCode ?? defaultCurrencyCode);
      })
      .catch(() => {
        if (!cancelled) {
          setLocale(defaultLocale);
          setCurrencyCode(defaultCurrencyCode);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [tenantId, defaultLocale, defaultCurrencyCode]);

  const formatCurrency = useCallback(
    (amountCents: number) => {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amountCents / 100);
    },
    [locale, currencyCode]
  );

  const formatDate = useCallback(
    (d: Date | string) => {
      const date = typeof d === 'string' ? new Date(d) : d;
      return date.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
    },
    [locale]
  );

  const formatDateMedium = useCallback(
    (d: Date | string) => {
      const date = typeof d === 'string' ? new Date(d) : d;
      return date.toLocaleDateString(locale, { dateStyle: 'medium' });
    },
    [locale]
  );

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      currencyCode,
      formatCurrency,
      formatDate,
      formatDateMedium,
      isLoading,
    }),
    [locale, currencyCode, formatCurrency, formatDate, formatDateMedium, isLoading]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext);
}
