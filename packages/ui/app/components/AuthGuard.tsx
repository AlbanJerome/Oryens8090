'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '../lib/supabase-browser';
import { OryensSpinner } from './OryensSpinner';

const PUBLIC_PATHS = ['/login', '/signup'];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    if (!supabase) {
      setAllowed(true);
      setChecking(false);
      return;
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setAllowed(true);
      } else if (PUBLIC_PATHS.includes(pathname ?? '')) {
        setAllowed(true);
      } else {
        router.replace('/login');
        setAllowed(false);
      }
      setChecking(false);
    });
  }, [pathname, router]);

  if (checking) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50" aria-label="Loading">
        <OryensSpinner className="oryens-spinner" />
        <span className="text-sm text-slate-500">Loading…</span>
      </div>
    );
  }
  if (!allowed) {
    return null;
  }
  return <>{children}</>;
}
