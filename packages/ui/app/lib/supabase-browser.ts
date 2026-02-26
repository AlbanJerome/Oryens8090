'use client';

import { createBrowserClient } from '@supabase/ssr';

/**
 * Required env vars (in .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL     — Supabase project URL (e.g. https://xxx.supabase.co)
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY — Supabase anon/public key
 * Both must be set and non-empty for auth to work. Restart the dev server after changing .env.local.
 */
const url = typeof process.env.NEXT_PUBLIC_SUPABASE_URL === 'string' ? process.env.NEXT_PUBLIC_SUPABASE_URL.trim() : '';
const key = typeof process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === 'string' ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.trim() : '';

if (typeof window !== 'undefined' && (!url || !key)) {
  const missing = [
    !url && 'NEXT_PUBLIC_SUPABASE_URL',
    !key && 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ].filter(Boolean);
  console.warn('[Oryens] Auth not configured. Missing or empty in .env.local:', missing.join(', '));
}

let cached: ReturnType<typeof createBrowserClient> | null = null;

/** Supabase client for browser (login, signup, session). Returns null if env not configured. */
export function getSupabaseBrowser() {
  if (!url || !key) return null;
  if (cached) return cached;
  cached = createBrowserClient(url, key);
  return cached;
}
