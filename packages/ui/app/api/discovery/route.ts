import { NextRequest, NextResponse } from 'next/server';
import { getRequestUserTenantId } from '@/app/lib/tenant-guard';

const DEBUG_MODE = process.env.DEBUG_MODE === 'true';
const MOCK_USER_TENANT_ID = process.env.MOCK_USER_TENANT_ID ?? '';

export async function GET(request: NextRequest) {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return NextResponse.json(
      { error: 'DATABASE_URL is not configured' },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const tenantIdParam = searchParams.get('tenantId');
  const userTenantIdOr401 = await getRequestUserTenantId(request);
  if (userTenantIdOr401 instanceof NextResponse) return userTenantIdOr401;
  const userTenantId = userTenantIdOr401;

  // Security: 401 if no session/link unless local dev with mock bypass or development fallback
  const allowBypass = DEBUG_MODE && !!MOCK_USER_TENANT_ID;
  const devFallback = process.env.NODE_ENV === 'development';
  if (userTenantId == null && !allowBypass && !devFallback) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Never use tenantIdParam to override session tenant; only for bypass when no session
  let effectiveTenantId: string | null = userTenantId ?? (allowBypass ? tenantIdParam : null) ?? null;
  if (userTenantId != null && tenantIdParam != null && tenantIdParam !== userTenantId) {
    return NextResponse.json(
      { error: 'Forbidden: you do not have access to this tenant.' },
      { status: 403 }
    );
  }

  try {
    const pg = await import('pg');
    const client = new pg.default.Client({ connectionString: dbUrl });
    await client.connect();

    try {
      // Local dev: if no session, use first available tenant from tenants table
      if (effectiveTenantId == null && devFallback) {
        const firstTenant = await client.query<{ id: string }>(
          'SELECT id FROM tenants ORDER BY created_at ASC LIMIT 1'
        );
        if (firstTenant.rows.length > 0) {
          effectiveTenantId = firstTenant.rows[0].id;
        }
      }

      const res = effectiveTenantId
        ? await client.query(
            `SELECT tenant_id, id, name
             FROM entities
             WHERE tenant_id = $1 AND parent_entity_id IS NULL
             ORDER BY created_at DESC NULLS LAST
             LIMIT 1`,
            [effectiveTenantId]
          )
        : await client.query(
            `SELECT tenant_id, id, name
             FROM entities
             WHERE parent_entity_id IS NULL
             ORDER BY created_at DESC NULLS LAST
             LIMIT 1`,
            []
          );

      if (res.rows.length === 0) {
        return NextResponse.json(
          { error: 'No root entity found' },
          { status: 404 }
        );
      }

      const row = res.rows[0] as { tenant_id: string; id: string; name: string | null };
      return NextResponse.json({
        tenantId: row.tenant_id,
        parentEntityId: row.id,
        parentEntityName: row.name ?? 'Entity',
      });
    } finally {
      await client.end();
    }
  } catch (error) {
    console.error('Discovery API error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
