'use client';

import { useState, useEffect, useCallback } from 'react';

export type CascadingSelectOptions<TParent = string, TChild = Record<string, unknown>> = {
  /** Current parent value (e.g. selected customer id). */
  parentValue: TParent | null | undefined;
  /** Fetches child data when parent changes (e.g. address, credit_limit, default_currency). */
  fetchChildren: (parentId: TParent) => Promise<TChild>;
  /** Only run when parent is truthy. */
  enabled?: boolean;
};

export type CascadingSelectResult<TChild = Record<string, unknown>> = {
  /** Child data keyed by field name (e.g. { address, creditLimit, defaultCurrency }). */
  childValues: TChild | null;
  loading: boolean;
  error: string | null;
  /** Manually refetch child data for current parent. */
  refetch: () => Promise<void>;
};

/**
 * Handles "depends on" / cascading selects: when the parent field changes (e.g. Customer),
 * automatically fetches and exposes child fields (e.g. Address, Credit Limit, Default Currency).
 */
export function useCascadingSelect<TParent = string, TChild = Record<string, unknown>>({
  parentValue,
  fetchChildren,
  enabled = true,
}: CascadingSelectOptions<TParent, TChild>): CascadingSelectResult<TChild> {
  const [childValues, setChildValues] = useState<TChild | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const doFetch = useCallback(async () => {
    if (!enabled || parentValue == null || parentValue === '') {
      setChildValues(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchChildren(parentValue);
      setChildValues(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      setChildValues(null);
    } finally {
      setLoading(false);
    }
  }, [parentValue, fetchChildren, enabled]);

  useEffect(() => {
    doFetch();
  }, [doFetch]);

  return { childValues, loading, error, refetch: doFetch };
}
