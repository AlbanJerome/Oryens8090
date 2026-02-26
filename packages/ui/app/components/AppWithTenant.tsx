'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { AuthGuard } from './AuthGuard';
import { TenantLoader } from './TenantLoader';
import { AppShell } from './AppShell';
import { LocaleProvider } from '../context/LocaleContext';
import { useTenantStore } from '../store/tenant-store';
import { OnboardingModal } from './OnboardingModal';
import { NoTenantOnboarding } from './NoTenantOnboarding';
import { LoadingSkeleton } from './LoadingSkeleton';
import { getSupabaseBrowser } from '../lib/supabase-browser';

const PUBLIC_PATHS = ['/login', '/signup'];

export function AppWithTenant({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublic = pathname != null && PUBLIC_PATHS.includes(pathname);

  return (
    <AuthGuard>
      {isPublic ? (
        children
      ) : (
        <>
          <TenantLoader />
          <TenantInitializer>{children}</TenantInitializer>
        </>
      )}
    </AuthGuard>
  );
}

/**
 * Once tenants are loaded: if user has no tenants, show branded onboarding (with "Create your first Ledger" or signup).
 * Otherwise render app with LocaleProvider + AppShell.
 */
function TenantInitializer({ children }: { children: React.ReactNode }) {
  const userTenants = useTenantStore((s) => s.userTenants);
  const tenantsLoaded = useTenantStore((s) => s.tenantsLoaded);
  const activeTenantId = useTenantStore((s) => s.activeTenantId);
  const authConfigured = !!getSupabaseBrowser();
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);

  if (!tenantsLoaded) {
    return <LoadingSkeleton />;
  }

  if (userTenants.length === 0) {
    return (
      <>
        <NoTenantOnboarding
          authConfigured={authConfigured}
          onCreateFirstLedger={authConfigured ? () => setShowOnboardingModal(true) : undefined}
        />
        {showOnboardingModal && authConfigured && (
          <OnboardingModal onClose={() => setShowOnboardingModal(false)} />
        )}
      </>
    );
  }

  return (
    <LocaleProvider tenantId={activeTenantId ?? undefined}>
      <AppShell>{children}</AppShell>
    </LocaleProvider>
  );
}
