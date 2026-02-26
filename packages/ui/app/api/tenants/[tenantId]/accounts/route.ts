import { NextRequest, NextResponse } from 'next/server';
import { assertUserCanAccessTenant } from '@/app/lib/tenant-guard';
import type { PgAccountRow } from '@/app/types/database.extension';

export type AccountListItem = {
  id: string;
  code: string;
  name: string;
  accountType: string;
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
        `SELECT id, code, name, account_type
         FROM accounts
         WHERE tenant_id = $1 AND deleted_at IS NULL
         ORDER BY code`,
        [tenantId]
      );

      const accounts: AccountListItem[] = (res.rows as PgAccountRow[]).map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        accountType: r.account_type ?? '',
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
