'use client';

import { TenantLoader } from './TenantLoader';
import { AppShell } from './AppShell';
import { LocaleProvider } from '../context/LocaleContext';
import { useTenantStore } from '../store/tenant-store';

export function AppWithTenant({ children }: { children: React.ReactNode }) {
  const activeTenantId = useTenantStore((s) => s.activeTenantId);

  return (
    <>
      <TenantLoader />
      <LocaleProvider tenantId={activeTenantId ?? undefined}>
        <AppShell>{children}</AppShell>
      </LocaleProvider>
    </>
  );
}
