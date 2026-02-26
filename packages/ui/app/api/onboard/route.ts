import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * POST /api/onboard — create a new company (tenant + root entity) for the current user and link them in user_tenants.
 * Body: { companyName: string }
 * Requires Supabase session. Creates: tenants row, entities row (root), user_tenants row.
 */
export async function POST(request: NextRequest) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return NextResponse.json({ error: 'Auth not configured' }, { status: 503 });
  }

  const cookies = request.cookies;
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookies.getAll().map((c) => ({ name: c.name, value: c.value }));
      },
      setAll() {},
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { companyName?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const companyName = typeof body.companyName === 'string' ? body.companyName.trim() : '';
  if (!companyName) {
    return NextResponse.json({ error: 'companyName is required' }, { status: 400 });
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 500 });
  }

  const tenantId = crypto.randomUUID();
  const entityId = crypto.randomUUID();

  try {
    const pg = await import('pg');
    const client = new pg.default.Client({ connectionString: dbUrl });
    await client.connect();
    try {
      await client.query('BEGIN');
      // tenants table (001): id TEXT
      await client.query(
        `INSERT INTO tenants (id, currency_code, locale) VALUES ($1, 'USD', 'en-US') ON CONFLICT (id) DO NOTHING`,
        [tenantId]
      );
      // entities: id UUID, tenant_id UUID, root has parent_entity_id NULL
      await client.query(
        `INSERT INTO entities (id, tenant_id, name, parent_entity_id, ownership_percentage, consolidation_method, currency)
         VALUES ($1, $2, $3, NULL, 100, 'Full', 'USD')`,
        [entityId, tenantId, companyName]
      );
      await client.query(
        `INSERT INTO user_tenants (user_id, tenant_id, role) VALUES ($1, $2, 'OWNER') ON CONFLICT (user_id, tenant_id) DO NOTHING`,
        [user.id, tenantId]
      );
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      await client.end();
    }
  } catch (err) {
    console.error('Onboard error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ tenantId, entityId, companyName });
}
