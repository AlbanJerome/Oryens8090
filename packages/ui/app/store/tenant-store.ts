'use client';

import { create } from 'zustand';
import {
  getActiveTenantIdFromCookie,
  setActiveTenantIdCookie,
} from '../lib/cookies';

export type TenantRole = 'OWNER' | 'EDITOR' | 'VIEWER';
export type TenantOption = { tenantId: string; name: string; role?: TenantRole };

export type DiscoveryState = {
  tenantId: string;
  parentEntityId: string;
  parentEntityName: string;
};

type TenantState = {
  userTenants: TenantOption[];
  activeTenantId: string | null;
  discovery: DiscoveryState | null;
  isLoadingTenants: boolean;
  isLoadingDiscovery: boolean;
  tenantsLoaded: boolean;
  loadUserTenants: () => Promise<void>;
  setActiveTenantId: (tenantId: string) => void;
  loadDiscovery: (tenantId: string) => Promise<void>;
  hydrateFromCookieAndTenants: () => void;
};

export const useTenantStore = create<TenantState>((set, get) => ({
  userTenants: [],
  activeTenantId: null,
  discovery: null,
  isLoadingTenants: false,
  isLoadingDiscovery: false,
  tenantsLoaded: false,

  loadUserTenants: async () => {
    set({ isLoadingTenants: true });
    try {
      const res = await fetch('/api/tenants');
      const data = (await res.ok ? res.json() : { tenants: [] }) as { tenants?: TenantOption[] };
      const list = (data.tenants ?? []).map((t) => ({ ...t, role: t.role ?? 'VIEWER' as TenantRole }));
      const singleTenantId = list.length === 1 ? list[0].tenantId : null;
      const { activeTenantId: prevActive } = get();
      const fromCookie = getActiveTenantIdFromCookie();
      const current = prevActive ?? fromCookie;
      const inList = list.length > 0 && list.some((t) => t.tenantId === current);
      const resolvedActive = singleTenantId ?? (inList ? current : list[0]?.tenantId ?? null) ?? null;
      set({
        userTenants: list,
        tenantsLoaded: true,
        activeTenantId: resolvedActive,
      });
      if (resolvedActive) {
        setActiveTenantIdCookie(resolvedActive);
      }
      const { loadDiscovery } = get();
      if (resolvedActive) {
        await loadDiscovery(resolvedActive);
      }
    } catch {
      set({ userTenants: [], tenantsLoaded: true });
    } finally {
      set({ isLoadingTenants: false });
    }
  },

  setActiveTenantId: (tenantId: string) => {
    setActiveTenantIdCookie(tenantId);
    set({ activeTenantId: tenantId, discovery: null });
    get().loadDiscovery(tenantId);
  },

  loadDiscovery: async (tenantId: string) => {
    set({ isLoadingDiscovery: true });
    try {
      const res = await fetch(`/api/discovery?tenantId=${encodeURIComponent(tenantId)}`);
      const data = res.ok ? (await res.json()) : null;
      if (data?.tenantId) {
        set({
          discovery: {
            tenantId: data.tenantId,
            parentEntityId: data.parentEntityId ?? data.tenantId,
            parentEntityName: data.parentEntityName ?? data.tenantId,
          },
        });
      } else {
        set({ discovery: null });
      }
    } catch {
      set({ discovery: null });
    } finally {
      set({ isLoadingDiscovery: false });
    }
  },

  hydrateFromCookieAndTenants: () => {
    const { userTenants, activeTenantId } = get();
    const fromCookie = getActiveTenantIdFromCookie();
    const current = activeTenantId ?? fromCookie;
    const inList = userTenants.some((t) => t.tenantId === current);
    const nextId = inList ? current : (userTenants[0]?.tenantId ?? fromCookie ?? null);
    if (nextId) {
      setActiveTenantIdCookie(nextId);
      set({ activeTenantId: nextId });
    }
  },
}));
