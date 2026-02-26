/**
 * Lightweight client-side formula engine plugin.
 * Uses integer cents for all arithmetic to avoid IEEE 754 floating-point errors.
 * Inputs: quantity (units), unit_price (dollars), tax_rate (percent, e.g. 8.5).
 * Outputs: subtotal, tax_amount, grand_total (dollars for display).
 */

export type LineItem = {
  quantity: number;
  unit_price: number;
  tax_rate: number;
};

export type LineTotals = {
  subtotal: number;
  tax_amount: number;
  grand_total: number;
};

/** Convert dollar amount to integer cents (rounds to nearest cent). */
function toCents(dollars: number): number {
  return Math.round(Number(dollars) * 100);
}

/**
 * Computes subtotal, tax_amount, and grand_total using integer cents.
 * All multiplication (qty * price, tax) is done in cents; only final results are converted back to dollars.
 */
export function calculateLineTotals(items: LineItem[]): LineTotals {
  let subtotalCents = 0;
  let taxAmountCents = 0;

  for (const item of items) {
    const qty = Number(item.quantity) || 0;
    const unitPriceCents = toCents(Number(item.unit_price) || 0);
    const rateBps = Math.round((Number(item.tax_rate) || 0) * 100); // basis points (100 = 1%)

    const lineSubtotalCents = Math.round(qty * unitPriceCents);
    subtotalCents += lineSubtotalCents;
    taxAmountCents += Math.round((lineSubtotalCents * rateBps) / 10000);
  }

  const grandTotalCents = subtotalCents + taxAmountCents;

  return {
    subtotal: subtotalCents / 100,
    tax_amount: taxAmountCents / 100,
    grand_total: grandTotalCents / 100,
  };
}
