import { NextRequest, NextResponse } from 'next/server';
import { getRequestUserTenantIds } from '@/app/lib/tenant-guard';

export type TenantOption = { tenantId: string; name: string };

const DEBUG_MODE = process.env.DEBUG_MODE === 'true';

/**
 * GET /api/tenants — returns list of tenants the user is authorized to see (from user_tenants).
 * When Supabase is configured: requires session and returns 401 if none; returns only tenants from user_tenants.
 */
export async function GET(request: NextRequest) {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return NextResponse.json({ error: 'DATABASE_URL is not configured' }, { status: 500 });
  }

  const userTenantIds = await getRequestUserTenantIds(request);

  if (!DEBUG_MODE && userTenantIds.length === 0 && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const pg = await import('pg');
    const client = new pg.default.Client({ connectionString: dbUrl });
    await client.connect();

    try {
      const res =
        userTenantIds.length > 0
          ? await client.query(
              `SELECT e.tenant_id, e.id AS root_entity_id, e.name
               FROM entities e
               WHERE e.tenant_id = ANY($1::text[]) AND e.parent_entity_id IS NULL
               ORDER BY e.created_at DESC NULLS LAST`,
              [userTenantIds]
            )
          : await client.query(
              `SELECT DISTINCT ON (e.tenant_id) e.tenant_id, e.id AS root_entity_id, e.name
               FROM entities e
               WHERE e.parent_entity_id IS NULL
               ORDER BY e.tenant_id, e.created_at DESC NULLS LAST`
            );

      const tenants: TenantOption[] = (res.rows as { tenant_id: string; name: string | null }[]).map((r) => ({
        tenantId: r.tenant_id,
        name: r.name ?? r.tenant_id,
      }));

      return NextResponse.json({ tenants });
    } finally {
      await client.end();
    }
  } catch (error) {
    console.error('Tenants API error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
