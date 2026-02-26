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
export async function getRequestUserId(request: NextRequest): Promise<string | null> {
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

export type TenantRole = 'OWNER' | 'EDITOR' | 'VIEWER';

export type UserTenantRow = { tenantId: string; role: TenantRole };

/**
 * Query user_tenants for the given user id. Returns list of tenant_id strings.
 */
async function getTenantIdsForUser(userId: string): Promise<string[]> {
  const rows = await getTenantRowsForUser(userId);
  return rows.map((r) => r.tenantId);
}

/**
 * Query user_tenants for the given user id. Returns tenant_id and role (default OWNER if column missing).
 */
async function getTenantRowsForUser(userId: string): Promise<UserTenantRow[]> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return [];
  const pg = await import('pg');
  const client = new pg.default.Client({ connectionString: dbUrl });
  try {
    await client.connect();
    const res = await client.query<{ tenant_id: string; role: string | null }>(
      `SELECT tenant_id, COALESCE(role, 'OWNER') AS role FROM user_tenants WHERE user_id = $1 ORDER BY tenant_id`,
      [userId]
    );
    return res.rows.map((r) => ({
      tenantId: r.tenant_id,
      role: (r.role === 'EDITOR' || r.role === 'VIEWER' ? r.role : 'OWNER') as TenantRole,
    }));
  } finally {
    await client.end();
  }
}

/**
 * Returns (tenantId, role)[] for the current user. Used for RBAC and tenant list with role.
 */
export async function getRequestUserTenantRows(request: NextRequest): Promise<UserTenantRow[]> {
  if (DEBUG_MODE && MOCK_USER_TENANT_ID) {
    return [{ tenantId: MOCK_USER_TENANT_ID, role: 'OWNER' }];
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    const one = getRequestUserTenantIdFallback(request);
    return one ? [{ tenantId: one, role: 'OWNER' }] : [];
  }
  const userId = await getRequestUserId(request);
  if (!userId) return [];
  return getTenantRowsForUser(userId);
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
  const userId = await getRequestUserId(request);
  if (!userId) return [];
  const ids = await getTenantIdsForUser(userId);
  return ids;
}

/** Returns a 401 NextResponse; return from route handlers when received. */
function unauthorized401(): NextResponse {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

/**
 * Resolves the current user's single tenant ID for the request (security bridge).
 * - Gets the Supabase session from the request.
 * - Queries public.user_tenants for the tenant_id belonging to auth.uid().
 * - When Supabase is configured: returns a 401 response if no session or no user_tenants link (caller must return it).
 * - When Supabase is not configured (or DEBUG_MODE with mock): returns fallback or null for dev.
 */
export async function getRequestUserTenantId(request: NextRequest): Promise<string | null | NextResponse> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return getRequestUserTenantIdFallback(request);
  }
  if (DEBUG_MODE && MOCK_USER_TENANT_ID) {
    return MOCK_USER_TENANT_ID;
  }
  const userId = await getRequestUserId(request);
  if (!userId) {
    return unauthorized401();
  }
  const ids = await getTenantIdsForUser(userId);
  if (ids.length === 0) {
    return unauthorized401();
  }
  return ids[0];
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
  if (userTenantIds.length === 0) {
    return NextResponse.json(
      { error: 'Forbidden: you do not have access to any tenant.' },
      { status: 403 }
    );
  }
  if (userTenantIds.includes(requestTenantId)) return null;
  return NextResponse.json(
    { error: 'Forbidden: you do not have access to this tenant.' },
    { status: 403 }
  );
}
