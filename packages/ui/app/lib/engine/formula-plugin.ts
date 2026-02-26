/**
 * Lightweight client-side formula engine plugin.
 * Calculates line totals from quantity, unit price, and tax rate.
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

/**
 * Computes subtotal (sum of quantity * unit_price), tax_amount (sum of line taxes),
 * and grand_total (subtotal + tax_amount). Amounts are rounded to 2 decimal places.
 */
export function calculateLineTotals(items: LineItem[]): LineTotals {
  let subtotal = 0;
  let tax_amount = 0;

  for (const item of items) {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unit_price) || 0;
    const rate = Number(item.tax_rate) || 0;
    const lineSubtotal = Math.round(qty * price * 100) / 100;
    subtotal += lineSubtotal;
    tax_amount += Math.round(lineSubtotal * (rate / 100) * 100) / 100;
  }

  subtotal = Math.round(subtotal * 100) / 100;
  tax_amount = Math.round(tax_amount * 100) / 100;
  const grand_total = Math.round((subtotal + tax_amount) * 100) / 100;

  return { subtotal, tax_amount, grand_total };
}
