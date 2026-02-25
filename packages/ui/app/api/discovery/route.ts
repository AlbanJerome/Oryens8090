import { NextRequest, NextResponse } from 'next/server';
import { getRequestUserTenantId } from '@/app/lib/tenant-guard';

const DEBUG_MODE = process.env.DEBUG_MODE === 'true';

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
  const userTenantId = await getRequestUserTenantId(request);

  // Tenant isolation: in production, only allow discovery for the user's tenant
  const effectiveTenantId =
    userTenantId && !DEBUG_MODE
      ? userTenantId
      : tenantIdParam ?? null;
  if (userTenantId && !DEBUG_MODE && tenantIdParam && tenantIdParam !== userTenantId) {
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
