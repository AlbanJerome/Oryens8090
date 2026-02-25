'use client';

import { useEffect } from 'react';
import { useTenantStore } from '../store/tenant-store';

/**
 * Runs once on app load: fetches user tenants, hydrates active tenant from cookie (or first in list), loads discovery.
 * Renders nothing; the rest of the app reads from useTenantStore().
 */
export function TenantLoader() {
  const loadUserTenants = useTenantStore((s) => s.loadUserTenants);

  useEffect(() => {
    loadUserTenants();
  }, [loadUserTenants]);

  return null;
}
