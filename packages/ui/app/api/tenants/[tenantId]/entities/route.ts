import { NextRequest, NextResponse } from 'next/server';
import { assertUserCanAccessTenant } from '@/app/lib/tenant-guard';

export type EntityListItem = {
  id: string;
  name: string;
  parentEntityId: string | null;
  parentEntityName: string | null;
  ownershipPercentage: number;
  consolidationMethod: string;
  currency: string;
  isRoot: boolean;
};

/**
 * GET /api/tenants/[tenantId]/entities
 * List all entities for the tenant (root first, then by parent).
 */
export async function GET(
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
      const res = await client.query<{
        id: string;
        name: string;
        parent_entity_id: string | null;
        ownership_percentage: string | number;
        consolidation_method: string;
        currency: string | null;
      }>(
        `SELECT id, name, parent_entity_id, ownership_percentage, consolidation_method, currency
         FROM entities
         WHERE tenant_id = $1
         ORDER BY (parent_entity_id IS NULL) DESC, name`,
        [tenantId]
      );

      const parentIds = [...new Set(res.rows.map((r) => r.parent_entity_id).filter(Boolean))] as string[];
      const parentNames: Record<string, string> = {};
      if (parentIds.length > 0) {
        const parents = await client.query<{ id: string; name: string }>(
          `SELECT id, name FROM entities WHERE tenant_id = $1 AND id = ANY($2::uuid[])`,
          [tenantId, parentIds]
        );
        parents.rows.forEach((p) => { parentNames[p.id] = p.name; });
      }

      const entities: EntityListItem[] = res.rows.map((r) => ({
        id: r.id,
        name: r.name,
        parentEntityId: r.parent_entity_id,
        parentEntityName: r.parent_entity_id ? parentNames[r.parent_entity_id] ?? null : null,
        ownershipPercentage: typeof r.ownership_percentage === 'string' ? parseFloat(r.ownership_percentage) : Number(r.ownership_percentage),
        consolidationMethod: r.consolidation_method ?? 'Full',
        currency: r.currency ?? 'USD',
        isRoot: r.parent_entity_id == null,
      }));

      return NextResponse.json({ entities });
    } finally {
      await client.end();
    }
  } catch (error) {
    console.error('Entities GET error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/tenants/[tenantId]/entities
 * Create a new entity (root or subsidiary).
 * Body: { name, parentEntityId?, ownershipPercentage, consolidationMethod, currency? }
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

  let body: { name?: string; parentEntityId?: string; ownershipPercentage?: number; consolidationMethod?: string; currency?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const parentEntityId = body.parentEntityId && typeof body.parentEntityId === 'string' ? body.parentEntityId.trim() || undefined : undefined;
  const rawOwnership = body.ownershipPercentage;
  const parsedOwnership =
    typeof rawOwnership === 'number' && !Number.isNaN(rawOwnership)
      ? rawOwnership
      : typeof rawOwnership === 'string'
        ? parseFloat(rawOwnership)
        : Number.NaN;
  const ownershipPercentage = Number.isNaN(parsedOwnership) || parsedOwnership < 0 || parsedOwnership > 100
    ? 100
    : parsedOwnership;

  const validMethods = ['Full', 'Proportional', 'Equity'];
  const consolidationMethod = validMethods.includes(body.consolidationMethod ?? '') ? body.consolidationMethod! : 'Full';
  const currency = (typeof body.currency === 'string' && body.currency.trim()) ? body.currency.trim() : 'USD';

  try {
    const pg = await import('pg');
    const client = new pg.default.Client({ connectionString: dbUrl });
    await client.connect();

    try {
      if (parentEntityId) {
        const parent = await client.query(
          'SELECT id FROM entities WHERE tenant_id = $1 AND id = $2',
          [tenantId, parentEntityId]
        );
        if (parent.rows.length === 0) {
          return NextResponse.json({ error: 'Parent entity not found' }, { status: 404 });
        }
      }

      const id = crypto.randomUUID();
      await client.query(
        `INSERT INTO entities (id, tenant_id, name, parent_entity_id, ownership_percentage, consolidation_method, currency)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, tenantId, name, parentEntityId ?? null, ownershipPercentage, consolidationMethod, currency]
      );

      const entity: EntityListItem = {
        id,
        name,
        parentEntityId: parentEntityId ?? null,
        parentEntityName: null,
        ownershipPercentage,
        consolidationMethod,
        currency,
        isRoot: !parentEntityId,
      };
      return NextResponse.json({ entity }, { status: 201 });
    } finally {
      await client.end();
    }
  } catch (error) {
    console.error('Entities POST error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
