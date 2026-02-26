'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '../lib/supabase-browser';
import { validatePassword } from '../lib/password-validation';
import { AuthLayout } from '../components/AuthLayout';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);

  const passwordValidation = useMemo(() => validatePassword(password), [password]);
  const canSubmit = passwordValidation.valid && email.trim().length > 0;

  const supabase = getSupabaseBrowser();
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) {
      setError('Auth is not configured.');
      return;
    }
    if (!passwordValidation.valid) {
      setError('Please meet all password requirements.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.signUp({ email, password });
      if (err) {
        setError(err.message);
        return;
      }
      router.push('/');
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleOAuth() {
    if (!supabase) return;
    setError(null);
    setOauthLoading('google');
    try {
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${origin}/auth/callback?next=/` },
      });
      if (err) {
        setError(err.message);
        return;
      }
    } finally {
      setOauthLoading(null);
    }
  }

  if (!supabase) {
    return (
      <AuthLayout title="Create account" subtitle="Auth is not configured.">
        <Link href="/login" className="inline-block text-sm font-medium text-[var(--oryens-emerald-500)] hover:underline">
          Back to login
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Create account" subtitle="Your default ledger will be created automatically.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-700">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 placeholder-slate-400 shadow-sm focus:border-[var(--oryens-emerald-500)] focus:outline-none focus:ring-1 focus:ring-[var(--oryens-emerald-500)]"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-700">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 placeholder-slate-400 shadow-sm focus:border-[var(--oryens-emerald-500)] focus:outline-none focus:ring-1 focus:ring-[var(--oryens-emerald-500)]"
            placeholder="Strong password (see requirements below)"
          />
          <ul className="mt-2 space-y-1 text-xs text-slate-600" aria-live="polite">
            {passwordValidation.rules.map((r) => (
              <li key={r.key} className={r.met ? 'text-emerald-600' : 'text-slate-500'}>
                {r.met ? '✓' : '○'} {r.label}
              </li>
            ))}
          </ul>
        </div>
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading || !canSubmit}
          className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-emerald-900/20 transition-all hover:bg-emerald-500 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {loading ? 'Creating account…' : 'Sign up'}
        </button>
      </form>
      <div className="mt-6">
        <p className="text-center text-xs text-slate-500">Or continue with</p>
        <div className="mt-3">
          <button
            type="button"
            onClick={() => handleOAuth()}
            disabled={!!oauthLoading}
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            {oauthLoading ? '…' : 'Google'}
          </button>
        </div>
      </div>
      <p className="mt-6 text-center text-sm text-slate-500">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-[var(--oryens-emerald-500)] hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
