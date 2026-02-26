import { NextRequest, NextResponse } from 'next/server';
import { assertUserCanAccessTenant } from '@/app/lib/tenant-guard';
import type { PgAuditLogRow } from '@/app/types/database.extension';

export type AuditLogRow = {
  id: string;
  tenantId: string;
  userId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
  entityName?: string | null;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  const forbidden = await assertUserCanAccessTenant(request, tenantId);
  if (forbidden) return forbidden;
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get('limit')) || 100, 500);
  const offset = Number(searchParams.get('offset')) || 0;

  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error('DATABASE_URL is not defined');

    const pg = await import('pg');
    const client = new pg.default.Client({ connectionString: dbUrl });
    await client.connect();

    try {
      const res = await client.query(
        `SELECT a.id, a.tenant_id, a.user_id, a.action, a.entity_type, a.entity_id, a.payload, a.created_at,
                e.name AS entity_name
         FROM audit_log a
         LEFT JOIN entities e ON e.id = (a.payload->>'entityId')::uuid
         WHERE a.tenant_id = $1
         ORDER BY a.created_at DESC
         LIMIT $2 OFFSET $3`,
        [tenantId, limit, offset]
      );

      const rows: AuditLogRow[] = (res.rows as PgAuditLogRow[]).map((r) => ({
        id: r.id,
        tenantId: r.tenant_id,
        userId: r.user_id ?? null,
        action: r.action,
        entityType: r.entity_type ?? null,
        entityId: r.entity_id ?? null,
        payload: typeof r.payload === 'string' ? JSON.parse(r.payload) : (r.payload as Record<string, unknown>) ?? {},
        createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
        entityName: r.entity_name ?? null,
      }));

      return NextResponse.json({ entries: rows });
    } finally {
      await client.end();
    }
  } catch (error: unknown) {
    console.error('Audit API error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
