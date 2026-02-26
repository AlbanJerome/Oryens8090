import { NextRequest, NextResponse } from 'next/server';
import { assertUserCanAccessTenant } from '@/app/lib/tenant-guard';

export type DepartmentListItem = {
  id: string;
  name: string;
  code: string | null;
};

/**
 * GET /api/tenants/[tenantId]/departments
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
      const res = await client.query<{ id: string; name: string; code: string | null }>(
        `SELECT id, name, code FROM departments WHERE tenant_id = $1 ORDER BY name`,
        [tenantId]
      );
      const departments: DepartmentListItem[] = res.rows.map((r) => ({
        id: r.id,
        name: r.name,
        code: r.code ?? null,
      }));
      return NextResponse.json({ departments });
    } finally {
      await client.end();
    }
  } catch (error) {
    console.error('Departments GET error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/tenants/[tenantId]/departments
 * Body: { name, code? }
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

  let body: { name?: string; code?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  const code = typeof body.code === 'string' ? body.code.trim() || null : null;

  try {
    const pg = await import('pg');
    const client = new pg.default.Client({ connectionString: dbUrl });
    await client.connect();

    try {
      const id = crypto.randomUUID();
      await client.query(
        `INSERT INTO departments (id, tenant_id, name, code) VALUES ($1, $2, $3, $4)`,
        [id, tenantId, name, code]
      );
      const department: DepartmentListItem = { id, name, code };
      return NextResponse.json({ department }, { status: 201 });
    } finally {
      await client.end();
    }
  } catch (error) {
    console.error('Departments POST error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
