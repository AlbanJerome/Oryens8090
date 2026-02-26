'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseBrowser } from '../lib/supabase-browser';
import { AuthLayout } from '../components/AuthLayout';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(() => {
    const e = searchParams.get('error');
    if (e === 'callback_failed') return 'Sign-in failed. Please try again.';
    if (e === 'missing_code') return 'Invalid callback. Please try again.';
    return null;
  });
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);

  const supabase = getSupabaseBrowser();
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) {
      setError('Auth is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
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
      <AuthLayout title="Sign in" subtitle="Auth is not configured.">
        <p className="text-sm text-slate-600">
          Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.
        </p>
        <p className="mt-2 text-sm text-slate-500">
          In development you can use DEBUG_MODE and MOCK_USER_TENANT_ID to skip auth.
        </p>
        <Link href="/login" className="mt-4 inline-block text-sm font-medium text-[var(--oryens-emerald-500)] hover:underline">
          Refresh
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Sign in" subtitle="Enter your email and password.">
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
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 placeholder-slate-400 shadow-sm focus:border-[var(--oryens-emerald-500)] focus:outline-none focus:ring-1 focus:ring-[var(--oryens-emerald-500)]"
          />
        </div>
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-emerald-900/20 transition-all hover:bg-emerald-500 disabled:opacity-70"
        >
          {loading ? 'Signing in…' : 'Sign in'}
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
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="font-medium text-[var(--oryens-emerald-500)] hover:underline">
          Sign up
        </Link>
      </p>
    </AuthLayout>
  );
}
