/**
 * CurrencyService: fetch exchange rates (mock for demo).
 * getRate(from, to) returns how many units of `to` one unit of `from` is worth (decimal).
 * E.g. getRate('JPY', 'USD') → 0.0067 means 1 JPY = 0.0067 USD.
 */

const MOCK_RATES: Record<string, Record<string, number>> = {
  USD: { USD: 1, EUR: 0.92, GBP: 0.79, JPY: 149.25, CHF: 0.88, CAD: 1.36, AUD: 1.53, CNY: 7.24 },
  EUR: { USD: 1.087, EUR: 1, GBP: 0.86, JPY: 162.2, CHF: 0.96, CAD: 1.48, AUD: 1.66, CNY: 7.87 },
  GBP: { USD: 1.27, EUR: 1.16, GBP: 1, JPY: 189.5, CHF: 1.12, CAD: 1.73, AUD: 1.94, CNY: 9.2 },
  JPY: { USD: 0.0067, EUR: 0.00617, GBP: 0.00528, JPY: 1, CHF: 0.0059, CAD: 0.0091, AUD: 0.0103, CNY: 0.0485 },
  CHF: { USD: 1.14, EUR: 1.04, GBP: 0.89, JPY: 169.5, CHF: 1, CAD: 1.55, AUD: 1.74, CNY: 8.24 },
  CAD: { USD: 0.735, EUR: 0.676, GBP: 0.578, JPY: 109.8, CHF: 0.645, CAD: 1, AUD: 1.12, CNY: 5.32 },
  AUD: { USD: 0.654, EUR: 0.602, GBP: 0.515, JPY: 97.8, CHF: 0.575, CAD: 0.893, AUD: 1, CNY: 4.74 },
  CNY: { USD: 0.138, EUR: 0.127, GBP: 0.109, JPY: 20.6, CHF: 0.121, CAD: 0.188, AUD: 0.211, CNY: 1 },
};

export type CurrencyCode = string;

export async function getRate(from: CurrencyCode, to: CurrencyCode): Promise<number> {
  const uFrom = (from || 'USD').toUpperCase();
  const uTo = (to || 'USD').toUpperCase();
  if (uFrom === uTo) return 1;
  const row = MOCK_RATES[uFrom];
  if (row && row[uTo] != null) return row[uTo];
  const inv = MOCK_RATES[uTo]?.[uFrom];
  if (inv != null) return 1 / inv;
  return 1;
}
