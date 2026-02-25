/**
 * Generate a short (2-sentence) summary of account activity from a list of transactions.
 * Used by the drill-down sidebar. Can be replaced with an LLM call later.
 */

export type TransactionInput = {
  date: string;
  description: string | null;
  entityName: string | null;
  debitCents: number;
  creditCents: number;
};

export type SummarizeAccountActivityResult = {
  summary: string;
};

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function formatCents(cents: number): string {
  return USD.format(cents / 100);
}

export function summarizeAccountActivity(
  accountCode: string,
  accountName: string | undefined,
  transactions: TransactionInput[]
): SummarizeAccountActivityResult {
  if (transactions.length === 0) {
    return {
      summary: `${accountName ?? accountCode} has no transaction activity in the selected period.`,
    };
  }

  let totalDebitCents = 0;
  let totalCreditCents = 0;
  const descriptions = new Map<string, number>();
  let maxSingleCents = 0;
  let maxSingleDesc: string | null = null;

  for (const t of transactions) {
    const d = t.debitCents || 0;
    const c = t.creditCents || 0;
    totalDebitCents += d;
    totalCreditCents += c;
    const amount = Math.max(d, c);
    if (amount > maxSingleCents) {
      maxSingleCents = amount;
      maxSingleDesc = t.description || 'Entry';
    }
    const key = (t.description || 'Misc').trim().toLowerCase().slice(0, 40);
    descriptions.set(key, (descriptions.get(key) ?? 0) + amount);
  }

  const topDescriptions = [...descriptions.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([d]) => d);

  const netCents = totalDebitCents - totalCreditCents;
  const netStr = formatCents(Math.abs(netCents));
  const direction = netCents >= 0 ? 'inflows' : 'outflows';

  let sentence1: string;
  if (topDescriptions.length > 0) {
    const drivers = topDescriptions.join(', ');
    sentence1 = `Activity is mainly driven by ${drivers}.`;
  } else {
    sentence1 = `There are ${transactions.length} transaction(s) in this period.`;
  }

  let sentence2: string;
  if (maxSingleCents > 0 && maxSingleDesc) {
    sentence2 = `Net ${direction} total ${netStr}; largest single item: ${formatCents(maxSingleCents)} (${maxSingleDesc.slice(0, 30)}${maxSingleDesc.length > 30 ? '…' : ''}).`;
  } else {
    sentence2 = `Net ${direction} total ${netStr}.`;
  }

  return {
    summary: `${sentence1} ${sentence2}`,
  };
}
