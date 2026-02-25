import { NextResponse } from 'next/server';

const DEFAULT_LOCALE = 'en-US';
const DEFAULT_CURRENCY = 'USD';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  if (!tenantId) {
    return NextResponse.json({ locale: DEFAULT_LOCALE, currencyCode: DEFAULT_CURRENCY });
  }

  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      return NextResponse.json({ locale: DEFAULT_LOCALE, currencyCode: DEFAULT_CURRENCY });
    }

    const pg = await import('pg');
    const client = new pg.default.Client({ connectionString: dbUrl });
    await client.connect();
    try {
      const res = await client.query<{ currency_code: string; locale: string }>(
        `SELECT currency_code, locale FROM tenants WHERE id = $1`,
        [tenantId]
      );
      const row = res.rows[0];
      if (row) {
        return NextResponse.json({
          locale: row.locale || DEFAULT_LOCALE,
          currencyCode: row.currency_code || DEFAULT_CURRENCY,
        });
      }
      return NextResponse.json({
        locale: DEFAULT_LOCALE,
        currencyCode: DEFAULT_CURRENCY,
      });
    } finally {
      await client.end().catch(() => {});
    }
  } catch {
    return NextResponse.json({ locale: DEFAULT_LOCALE, currencyCode: DEFAULT_CURRENCY });
  }
}
