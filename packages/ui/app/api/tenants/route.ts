import { NextResponse } from 'next/server';

export type TenantOption = { tenantId: string; name: string };

/**
 * GET /api/tenants — returns list of tenants (root entity per tenant) for the tenant switcher.
 */
export async function GET() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return NextResponse.json({ error: 'DATABASE_URL is not configured' }, { status: 500 });
  }

  try {
    const pg = await import('pg');
    const client = new pg.default.Client({ connectionString: dbUrl });
    await client.connect();

    try {
      const res = await client.query(
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
