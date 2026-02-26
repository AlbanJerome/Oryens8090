import { NextRequest, NextResponse } from 'next/server';
import { assertUserCanAccessTenant } from '@/app/lib/tenant-guard';

/**
 * PATCH /api/tenants/[tenantId]/accounts/[accountId]
 * Update account fields (e.g. department for tagging).
 * Body: { departmentId?: string | null }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string; accountId: string }> }
) {
  const { tenantId, accountId } = await params;
  const forbidden = await assertUserCanAccessTenant(request, tenantId);
  if (forbidden) return forbidden;

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 500 });
  }

  let body: { departmentId?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const departmentId = body.departmentId === undefined ? undefined : (body.departmentId === null || body.departmentId === '' ? null : body.departmentId);
  if (departmentId !== undefined && departmentId !== null && typeof departmentId !== 'string') {
    return NextResponse.json({ error: 'departmentId must be a string or null' }, { status: 400 });
  }

  try {
    const pg = await import('pg');
    const client = new pg.default.Client({ connectionString: dbUrl });
    await client.connect();

    try {
      const exist = await client.query(
        'SELECT id FROM accounts WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL',
        [tenantId, accountId]
      );
      if (exist.rows.length === 0) {
        return NextResponse.json({ error: 'Account not found' }, { status: 404 });
      }

      if (departmentId !== undefined) {
        if (departmentId) {
          const dept = await client.query(
            'SELECT id FROM departments WHERE tenant_id = $1 AND id = $2',
            [tenantId, departmentId]
          );
          if (dept.rows.length === 0) {
            return NextResponse.json({ error: 'Department not found' }, { status: 404 });
          }
        }
        await client.query(
          'UPDATE accounts SET department_id = $1 WHERE tenant_id = $2 AND id = $3',
          [departmentId, tenantId, accountId]
        );
      }

      return NextResponse.json({ ok: true });
    } finally {
      await client.end();
    }
  } catch (error) {
    console.error('Account PATCH error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
