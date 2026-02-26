import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { assertUserCanAccessTenant } from '@/app/lib/tenant-guard';
import { getRequestUserTenantRows } from '@/app/lib/tenant-guard';
import type { TenantRole } from '@/app/lib/tenant-guard';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export type TeamMember = { userId: string; email: string | null; role: TenantRole };

/**
 * GET /api/tenants/[tenantId]/team
 * Returns users linked to this tenant (user_tenants) with email from Supabase Auth (service role).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  const forbidden = await assertUserCanAccessTenant(request, tenantId);
  if (forbidden) return forbidden;
  if (!tenantId) {
    return NextResponse.json({ error: 'tenantId required' }, { status: 400 });
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 500 });
  }

  try {
    const pg = await import('pg');
    const client = new pg.default.Client({ connectionString: dbUrl });
    await client.connect();
    let rows: { user_id: string; role: string }[];
    try {
      const res = await client.query<{ user_id: string; role: string | null }>(
        `SELECT user_id, COALESCE(role, 'OWNER') AS role FROM user_tenants WHERE tenant_id = $1 ORDER BY role, user_id`,
        [tenantId]
      );
      rows = res.rows.map((r) => ({ user_id: r.user_id, role: r.role ?? 'OWNER' }));
    } finally {
      await client.end();
    }

    const users: TeamMember[] = [];
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && rows.length > 0) {
      const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      for (const row of rows) {
        const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(row.user_id);
        users.push({
          userId: row.user_id,
          email: user?.email ?? null,
          role: (row.role === 'EDITOR' || row.role === 'VIEWER' ? row.role : 'OWNER') as TenantRole,
        });
      }
    } else {
      users.push(...rows.map((r) => ({
        userId: r.user_id,
        email: null as string | null,
        role: (r.role === 'EDITOR' || r.role === 'VIEWER' ? r.role : 'OWNER') as TenantRole,
      })));
    }

    return NextResponse.json({ users });
  } catch (err) {
    console.error('Team GET error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tenants/[tenantId]/team — invite user by email (add row to user_tenants).
 * Body: { email: string, role: 'EDITOR' | 'VIEWER' }. Caller must be OWNER.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  const forbidden = await assertUserCanAccessTenant(request, tenantId);
  if (forbidden) return forbidden;
  if (!tenantId) {
    return NextResponse.json({ error: 'tenantId required' }, { status: 400 });
  }

  const userRows = await getRequestUserTenantRows(request);
  const current = userRows.find((r) => r.tenantId === tenantId);
  if (current?.role !== 'OWNER') {
    return NextResponse.json(
      { error: 'Only an OWNER can invite users to this company.' },
      { status: 403 }
    );
  }

  let body: { email?: string; role?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const role = body.role === 'EDITOR' || body.role === 'VIEWER' ? body.role : 'VIEWER';
  if (!email) {
    return NextResponse.json({ error: 'email is required' }, { status: 400 });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'Supabase service role not configured; cannot look up user by email.' },
      { status: 503 }
    );
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 500 });
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: { users: list } } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  const invitedUser = list?.find((u) => u.email?.toLowerCase() === email) ?? null;
  if (!invitedUser) {
    return NextResponse.json(
      { error: 'No user found with this email. They must sign up first.' },
      { status: 404 }
    );
  }

  try {
    const pg = await import('pg');
    const client = new pg.default.Client({ connectionString: dbUrl });
    await client.connect();
    try {
      await client.query(
        `INSERT INTO user_tenants (user_id, tenant_id, role) VALUES ($1, $2, $3)
         ON CONFLICT (user_id, tenant_id) DO UPDATE SET role = EXCLUDED.role`,
        [invitedUser.id, tenantId, role]
      );
    } finally {
      await client.end();
    }
    return NextResponse.json({
      userId: invitedUser.id,
      email: invitedUser.email ?? null,
      role: role as TenantRole,
    });
  } catch (err) {
    console.error('Team invite error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
