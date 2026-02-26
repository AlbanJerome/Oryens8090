import { NextRequest, NextResponse } from 'next/server';
import { toLocalDateString } from '@/app/lib/date-utils';
import { assertUserCanAccessTenant } from '@/app/lib/tenant-guard';
import type { PgAccountingPeriodRow } from '@/app/types/database.extension';

export type AccountingPeriodItem = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
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
        `SELECT id, name, start_date, end_date, status
         FROM accounting_periods
         WHERE tenant_id = $1 AND status = 'OPEN'
         ORDER BY start_date ASC`,
        [tenantId]
      );

      let periods: AccountingPeriodItem[] = (res.rows as unknown as PgAccountingPeriodRow[]).map((r) => ({
        id: r.id,
        name: r.name,
        startDate: r.start_date instanceof Date ? toLocalDateString(r.start_date) : String(r.start_date),
        endDate: r.end_date instanceof Date ? toLocalDateString(r.end_date) : String(r.end_date),
        status: r.status ?? 'OPEN',
      }));

      const today = toLocalDateString(new Date());
      const now = new Date();
      const recentStart = toLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1));
      const recentEnd = toLocalDateString(new Date(now.getFullYear(), now.getMonth() + 1, 0));
      const fallbackId = '00000000-0000-0000-0000-000000000001';
      const recentFallback: AccountingPeriodItem = {
        id: fallbackId,
        name: 'Current (fallback)',
        startDate: recentStart,
        endDate: recentEnd,
        status: 'OPEN',
      };

      const hasRecent = periods.some((p) => p.startDate <= today && p.endDate >= today);
      if (periods.length === 0 || !hasRecent) {
        await client.query(
          `INSERT INTO accounting_periods (id, tenant_id, name, start_date, end_date, status)
           VALUES ($1, $2, $3, $4::date, $5::date, 'OPEN')
           ON CONFLICT (tenant_id, name) DO UPDATE SET start_date = $4::date, end_date = $5::date`,
          [fallbackId, tenantId, recentFallback.name, recentStart, recentEnd]
        );
        periods = [recentFallback, ...periods.filter((p) => p.id !== fallbackId)];
      }
      // Put the period that contains today first so the UI tip shows the recent window.
      periods.sort((a, b) => {
        const aContainsToday = a.startDate <= today && a.endDate >= today ? 1 : 0;
        const bContainsToday = b.startDate <= today && b.endDate >= today ? 1 : 0;
        if (bContainsToday !== aContainsToday) return bContainsToday - aContainsToday;
        return b.endDate.localeCompare(a.endDate);
      });

      return NextResponse.json({ periods });
    } finally {
      await client.end();
    }
  } catch (error: unknown) {
    console.error('Accounting periods API error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
