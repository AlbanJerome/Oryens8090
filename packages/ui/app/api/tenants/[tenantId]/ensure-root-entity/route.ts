import { NextRequest, NextResponse } from 'next/server';
import { assertUserCanAccessTenant } from '@/app/lib/tenant-guard';

/**
 * POST /api/tenants/[tenantId]/ensure-root-entity
 * Creates a root entity for the tenant if one does not exist (e.g. tenant existed without an entity).
 * Returns discovery-shaped payload so the UI can continue.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  const forbidden = await assertUserCanAccessTenant(request, tenantId);
  if (forbidden) return forbidden;

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 500 });
  }

  try {
    const pg = await import('pg');
    const client = new pg.default.Client({ connectionString: dbUrl });
    await client.connect();

    try {
      const tenantRow = await client.query<{ id: string; name: string }>(
        'SELECT id, name FROM tenants WHERE id = $1',
        [tenantId]
      );
      if (tenantRow.rows.length === 0) {
        return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
      }
      const tenantName = tenantRow.rows[0].name;

      const existing = await client.query<{ id: string }>(
        'SELECT id FROM entities WHERE tenant_id = $1 AND parent_entity_id IS NULL LIMIT 1',
        [tenantId]
      );
      if (existing.rows.length > 0) {
        const row = existing.rows[0];
        return NextResponse.json({
          tenantId,
          parentEntityId: row.id,
          parentEntityName: tenantName,
        });
      }

      const entityId = crypto.randomUUID();
      await client.query(
        `INSERT INTO entities (id, tenant_id, name, parent_entity_id, ownership_percentage, consolidation_method, currency)
         VALUES ($1, $2, $3, NULL, 100, 'Full', 'USD')`,
        [entityId, tenantId, tenantName]
      );

      return NextResponse.json({
        tenantId,
        parentEntityId: entityId,
        parentEntityName: tenantName,
      });
    } finally {
      await client.end();
    }
  } catch (error) {
    console.error('ensure-root-entity error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
