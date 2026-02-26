'use client';

import Link from 'next/link';

const BG = 'var(--oryens-slate-950)';
const PRIMARY = 'var(--oryens-emerald-500)';

type NoTenantOnboardingProps = {
  onCreateFirstLedger?: () => void;
  authConfigured?: boolean;
};

/**
 * Oryens-branded empty state when the user has no company/tenant.
 * Offers "Create your first Ledger" when auth is configured; otherwise signup/dev hint.
 */
export function NoTenantOnboarding({ onCreateFirstLedger, authConfigured }: NoTenantOnboardingProps) {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-4 py-12"
      style={{ backgroundColor: BG }}
    >
      <div className="w-full max-w-md text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Welcome to Oryens
        </h1>
        <p className="mt-3 text-slate-400">
          Create your first ledger to start managing your company&apos;s books.
        </p>
        <div className="mt-8">
          {authConfigured && onCreateFirstLedger ? (
            <button
              type="button"
              onClick={onCreateFirstLedger}
              className="rounded-xl px-6 py-3 text-base font-medium text-white shadow-lg transition hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-[var(--oryens-emerald-muted)] focus:ring-offset-2 focus:ring-offset-[var(--oryens-slate-950)]"
              style={{ backgroundColor: PRIMARY }}
            >
              Create your first Ledger
            </button>
          ) : (
            <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-6 text-left">
              <p className="text-sm text-slate-300">
                Sign in or sign up to create a company. With Supabase auth, your first ledger is created automatically.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href="/signup"
                  className="rounded-lg px-4 py-2 text-sm font-medium text-white"
                  style={{ backgroundColor: PRIMARY }}
                >
                  Sign up
                </Link>
                <Link
                  href="/login"
                  className="rounded-lg border border-slate-600 bg-slate-800/80 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700/80"
                >
                  Sign in
                </Link>
              </div>
              <p className="mt-4 text-xs text-slate-500">
                For local development without auth, set <code className="rounded bg-slate-700/60 px-1">MOCK_USER_TENANT_ID</code> and ensure a root entity exists.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
