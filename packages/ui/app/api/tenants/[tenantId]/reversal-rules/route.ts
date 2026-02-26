import { NextRequest, NextResponse } from 'next/server';
import { assertUserCanAccessTenant } from '@/app/lib/tenant-guard';

export type ReversalRuleLine = { accountCode: string; debitCents: number; creditCents: number };
export type ReversalRuleTemplate = { lines: ReversalRuleLine[] };

export type ReversalRuleListItem = {
  id: string;
  name: string;
  description: string | null;
  scheduleType: string;
  template: ReversalRuleTemplate;
  lastRunAt: string | null;
  createdAt: string;
};

/**
 * GET /api/tenants/[tenantId]/reversal-rules
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
        description: string | null;
        schedule_type: string;
        template: unknown;
        last_run_at: Date | string | null;
        created_at: Date | string;
      }>(
        `SELECT id, name, description, schedule_type, template, last_run_at, created_at
         FROM reversal_rules WHERE tenant_id = $1 ORDER BY name`,
        [tenantId]
      );

      const rules: ReversalRuleListItem[] = res.rows.map((r) => {
        const t = r.template as ReversalRuleTemplate | null;
        const template: ReversalRuleTemplate = t?.lines ? { lines: t.lines } : { lines: [] };
        return {
          id: r.id,
          name: r.name,
          description: r.description ?? null,
          scheduleType: r.schedule_type ?? 'MANUAL',
          template,
          lastRunAt: r.last_run_at ? new Date(r.last_run_at).toISOString() : null,
          createdAt: new Date(r.created_at).toISOString(),
        };
      });
      return NextResponse.json({ rules });
    } finally {
      await client.end();
    }
  } catch (error) {
    console.error('Reversal rules GET error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/tenants/[tenantId]/reversal-rules
 * Body: { name, description?, scheduleType?, template: { lines: [{ accountCode, debitCents, creditCents }] } }
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

  let body: { name?: string; description?: string; scheduleType?: string; template?: ReversalRuleTemplate };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  const description = typeof body.description === 'string' ? body.description.trim() || null : null;
  const scheduleType = ['MANUAL', 'MONTH_END', 'QUARTER_END'].includes(body.scheduleType ?? '') ? body.scheduleType! : 'MANUAL';
  const rawLines = Array.isArray(body.template?.lines) ? body.template.lines : [];
  const lines: ReversalRuleLine[] = rawLines
    .filter((l: unknown) => l && typeof l === 'object' && typeof (l as { accountCode?: unknown }).accountCode === 'string')
    .map((l: { accountCode: string; debitCents?: number; creditCents?: number }) => ({
      accountCode: String((l as { accountCode: string }).accountCode).trim(),
      debitCents: Number((l as { debitCents?: number }).debitCents) || 0,
      creditCents: Number((l as { creditCents?: number }).creditCents) || 0,
    }));
  const template: ReversalRuleTemplate = { lines };

  try {
    const pg = await import('pg');
    const client = new pg.default.Client({ connectionString: dbUrl });
    await client.connect();

    try {
      const id = crypto.randomUUID();
      await client.query(
        `INSERT INTO reversal_rules (id, tenant_id, name, description, schedule_type, template)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
        [id, tenantId, name, description, scheduleType, JSON.stringify(template)]
      );
      const rule: ReversalRuleListItem = {
        id,
        name,
        description,
        scheduleType,
        template,
        lastRunAt: null,
        createdAt: new Date().toISOString(),
      };
      return NextResponse.json({ rule }, { status: 201 });
    } finally {
      await client.end();
    }
  } catch (error) {
    console.error('Reversal rules POST error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
