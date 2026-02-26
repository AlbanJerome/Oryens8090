import { NextRequest, NextResponse } from 'next/server';
import { assertUserCanAccessTenant } from '@/app/lib/tenant-guard';
import type { PgAccountRow } from '@/app/types/database.extension';

export type AccountListItem = {
  id: string;
  code: string;
  name: string;
  accountType: string;
  departmentId?: string | null;
  departmentName?: string | null;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  const forbidden = await assertUserCanAccessTenant(request, tenantId);
  if (forbidden) return forbidden;

  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error('DATABASE_URL is not defined');

    const pg = await import('pg');
    const client = new pg.default.Client({ connectionString: dbUrl });
    await client.connect();

    try {
      const res = await client.query(
        `SELECT a.id, a.code, a.name, a.account_type,
                a.department_id, d.name AS department_name
         FROM accounts a
         LEFT JOIN departments d ON d.id = a.department_id AND d.tenant_id = a.tenant_id
         WHERE a.tenant_id = $1 AND a.deleted_at IS NULL
         ORDER BY a.code`,
        [tenantId]
      );

      const accounts: AccountListItem[] = (res.rows as (PgAccountRow & { department_id?: string | null; department_name?: string | null })[]).map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        accountType: r.account_type ?? '',
        departmentId: r.department_id ?? null,
        departmentName: r.department_name ?? null,
      }));

      return NextResponse.json({ accounts });
    } finally {
      await client.end();
    }
  } catch (error: unknown) {
    console.error('Accounts API error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
