'use client';

import { useEffect, useRef } from 'react';
import { useTenantStore } from '../store/tenant-store';

/**
 * Runs once on app load: fetches user tenants, hydrates active tenant from cookie (or first in list), loads discovery.
 * Renders nothing; the rest of the app reads from useTenantStore().
 * Effect runs only once (ref guard) so a second load cannot overwrite optimistic state after onboarding.
 */
export function TenantLoader() {
  const loadUserTenants = useTenantStore((s) => s.loadUserTenants);
  const didLoad = useRef(false);

  useEffect(() => {
    if (didLoad.current) return;
    didLoad.current = true;
    loadUserTenants();
  }, [loadUserTenants]);

  return null;
}
