import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const DEBUG_MODE = process.env.DEBUG_MODE === 'true';
const MOCK_USER_TENANT_ID = process.env.MOCK_USER_TENANT_ID ?? '';
const ACTIVE_TENANT_COOKIE = 'active_tenant_id';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getCookie(request: NextRequest, name: string): string | null {
  const raw = request.headers.get('cookie');
  if (!raw) return null;
  const match = raw.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1].trim()) : null;
}

/**
 * When Supabase is not configured, resolve tenant from header/cookie/mock (dev fallback).
 */
function getRequestUserTenantIdFallback(request: NextRequest): string | null {
  const header = request.headers.get('x-user-tenant-id')?.trim();
  if (header) return header;
  const cookie = getCookie(request, ACTIVE_TENANT_COOKIE);
  if (cookie) return cookie;
  if (MOCK_USER_TENANT_ID) return MOCK_USER_TENANT_ID;
  return null;
}

/**
 * Get Supabase user id from session using request cookies. Returns null if no session or Supabase not configured.
 */
async function getSupabaseUserId(request: NextRequest): Promise<string | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  const cookies = request.cookies;
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        const all = cookies.getAll();
        return all.map((c) => ({ name: c.name, value: c.value }));
      },
      setAll() {
        // Read-only in guard; route handlers that need to refresh session can create their own client
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/**
 * Query user_tenants for the given user id. Returns list of tenant_id strings.
 */
async function getTenantIdsForUser(userId: string): Promise<string[]> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return [];
  const pg = await import('pg');
  const client = new pg.default.Client({ connectionString: dbUrl });
  try {
    await client.connect();
    const res = await client.query<{ tenant_id: string }>(
      'SELECT tenant_id FROM user_tenants WHERE user_id = $1 ORDER BY tenant_id',
      [userId]
    );
    return res.rows.map((r) => r.tenant_id);
  } finally {
    await client.end();
  }
}

/**
 * Resolves the current user's tenant IDs from Supabase session + user_tenants table.
 * When Supabase is not configured: returns fallback single tenant (header/cookie/mock) as one-element array, or [].
 */
export async function getRequestUserTenantIds(request: NextRequest): Promise<string[]> {
  if (DEBUG_MODE && MOCK_USER_TENANT_ID) {
    return [MOCK_USER_TENANT_ID];
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    const one = getRequestUserTenantIdFallback(request);
    return one ? [one] : [];
  }
  const userId = await getSupabaseUserId(request);
  if (!userId) return [];
  const ids = await getTenantIdsForUser(userId);
  return ids;
}

/**
 * Resolves the current user's single tenant ID for the request.
 * Uses Supabase session + user_tenants; returns first tenant or null.
 * When Supabase is not configured (or DEBUG_MODE with mock): uses header/cookie/mock fallback.
 * Caller should return 401 when null if auth is required.
 */
export async function getRequestUserTenantId(request: NextRequest): Promise<string | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return getRequestUserTenantIdFallback(request);
  }
  if (DEBUG_MODE && MOCK_USER_TENANT_ID) {
    return MOCK_USER_TENANT_ID;
  }
  const ids = await getRequestUserTenantIds(request);
  if (ids.length > 0) return ids[0];
  return null;
}

/**
 * When DEBUG_MODE is not set: returns 403 if the request is for a tenant
 * the current user is not allowed to access. Uses Supabase + user_tenants when configured.
 * When DEBUG_MODE=true: always allows (returns null).
 */
export async function assertUserCanAccessTenant(
  request: NextRequest,
  requestTenantId: string
): Promise<NextResponse | null> {
  if (DEBUG_MODE) return null;
  const userTenantIds = await getRequestUserTenantIds(request);
  if (userTenantIds.length === 0) return null;
  if (userTenantIds.includes(requestTenantId)) return null;
  return NextResponse.json(
    { error: 'Forbidden: you do not have access to this tenant.' },
    { status: 403 }
  );
}
