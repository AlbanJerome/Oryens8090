/**
 * Interpret a raw transaction string into a suggested journal entry.
 * Uses simple regex + fuzzy keyword matching against the tenant's Chart of Accounts (demo).
 * Can be replaced with an LLM call later.
 */

export type AccountInput = {
  code: string;
  name: string;
  accountType: string;
};

export type InterpretedLine = {
  accountCode: string;
  debitAmountCents: number;
  creditAmountCents: number;
};

export type InterpretTransactionResult = {
  description: string;
  lines: InterpretedLine[];
  confidenceScore: number;
  /** ISO date (YYYY-MM-DD) when a date was parsed from the input; set the posting date field to this. */
  postingDate?: string;
};

/** Keywords that suggest an expense (debit); matched case-insensitive against input. */
const EXPENSE_KEYWORDS: Record<string, string[]> = {
  aws: ['aws', 'amazon web services', 'cloud'],
  software: ['software', 'saas', 'subscription', 'license'],
  rent: ['rent', 'lease', 'office'],
  coffee: ['coffee', 'meals', 'catering'],
  supplies: ['supplies', 'office supplies', 'materials'],
  travel: ['travel', 'flight', 'hotel', 'transport'],
  utilities: ['utilities', 'electric', 'internet', 'phone'],
  advertising: ['advertising', 'marketing', 'ads'],
  general: ['expense', 'misc', 'other', 'sundry'],
};

/** Keywords that suggest cash / bank (credit when "paid"). */
const CASH_KEYWORDS = ['cash', 'bank', 'checking', 'savings', 'paid', 'payment', 'pay'];

const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december',
];
const MONTH_ABBREV = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function parseAmountCents(raw: string): number {
  const noCommas = raw.replace(/,/g, '');
  // Colloquial: 5k, 1.5k, 10K → thousands; 5m, 1.2m → millions (match with or without space before k/m)
  const kMatch = noCommas.match(/\$?\s*(\d+(?:\.\d+)?)\s*k\b/i);
  if (kMatch) return Math.round(parseFloat(kMatch[1]) * 1000 * 100);
  const mMatch = noCommas.match(/\$?\s*(\d+(?:\.\d+)?)\s*m\b/i);
  if (mMatch) return Math.round(parseFloat(mMatch[1]) * 1000000 * 100);
  // Standard: $123.45, 123.45 dollars, 5,000.00 — do not match number immediately followed by k/m (e.g. 5k)
  const match =
    noCommas.match(new RegExp(`\\$?\\s*(\\d+(?:\\.\\d{1,2})?)(?!\\s*k\\b)(?!\\s*m\\b)\\s*(?:dollars?|usd)?`, 'i')) ||
    noCommas.match(/(\d+(?:\.\d{1,2})?)(?!\s*k\b)(?!\s*m\b)\s*\$?/i);
  if (!match) return 0;
  return Math.round(parseFloat(match[1]) * 100);
}

/**
 * Parse a 2-digit year into full year (26 → 2026, 99 → 1999).
 */
function twoDigitYear(yy: number): number {
  return yy >= 0 && yy <= 99 ? (yy >= 50 ? 1900 + yy : 2000 + yy) : yy;
}

/**
 * Extract a posting date from raw input if present.
 * Supports: 24-06-26, 24/06/26, 24.06.26 (DD-MM-YY); 24th June 26; June 24 2026; on 24-06-26; due 24th June 26.
 * Returns ISO date string (YYYY-MM-DD) or null.
 */
function extractDate(raw: string): string | null {
  const r = raw.trim();
  // DD-MM-YY, DD/MM/YY, DD.MM.YY (day first when day <= 31 and month <= 12)
  const dmy = r.match(/(?:on|due|date|for)?\s*(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/i);
  if (dmy) {
    const a = parseInt(dmy[1], 10);
    const b = parseInt(dmy[2], 10);
    const c = parseInt(dmy[3], 10);
    const year = c < 100 ? twoDigitYear(c) : c;
    if (a >= 1 && a <= 31 && b >= 1 && b <= 12) {
      const day = a;
      const month = b;
      const d = new Date(year, month - 1, day);
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
    if (b >= 1 && b <= 31 && a >= 1 && a <= 12) {
      const day = b;
      const month = a;
      const d = new Date(year, month - 1, day);
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
  }
  // 24th June 26, 24 June 2026, June 24 26
  const monthNames = MONTH_NAMES.join('|') + '|' + MONTH_ABBREV.join('|');
  const ordinalDayMonth = new RegExp(
    `(?:on|due|date)?\\s*(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthNames})\\s+(\\d{2,4})\\b`,
    'i'
  );
  const m = r.match(ordinalDayMonth);
  if (m) {
    const day = parseInt(m[1], 10);
    const monthStr = m[2].toLowerCase();
    let month = MONTH_NAMES.indexOf(monthStr) + 1;
    if (month === 0) month = MONTH_ABBREV.indexOf(monthStr.slice(0, 3)) + 1;
    const year = parseInt(m[3], 10);
    const y = year < 100 ? twoDigitYear(year) : year;
    const d = new Date(y, month - 1, day);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  // June 24, 2026 or June 24 26
  const monthFirst = new RegExp(`(${monthNames})\\s+(\\d{1,2}),?\\s+(\\d{2,4})\\b`, 'i');
  const m2 = r.match(monthFirst);
  if (m2) {
    const monthStr = m2[1].toLowerCase();
    let month = MONTH_NAMES.indexOf(monthStr) + 1;
    if (month === 0) month = MONTH_ABBREV.indexOf(monthStr.slice(0, 3)) + 1;
    const day = parseInt(m2[2], 10);
    const year = parseInt(m2[3], 10);
    const y = year < 100 ? twoDigitYear(year) : year;
    const d = new Date(y, month - 1, day);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  // "12 of may", "12 of may this year" (day + of + month + optional year)
  const dayOfMonth = new RegExp(
    `(\\d{1,2})\\s+of\\s+(${monthNames})\\s*(?:this\\s+year|(\\d{2,4}))?\\b`,
    'i'
  );
  const m3 = r.match(dayOfMonth);
  if (m3) {
    const day = parseInt(m3[1], 10);
    const monthStr = m3[2].toLowerCase();
    let month = MONTH_NAMES.indexOf(monthStr) + 1;
    if (month === 0) month = MONTH_ABBREV.indexOf(monthStr.slice(0, 3)) + 1;
    const yearVal = m3[3];
    const y = yearVal
      ? (parseInt(yearVal, 10) < 100 ? twoDigitYear(parseInt(yearVal, 10)) : parseInt(yearVal, 10))
      : new Date().getFullYear();
    const d = new Date(y, month - 1, day);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return null;
}

/**
 * Format a date as "24th June 26" for human-readable description.
 */
function formatDateFriendly(isoDate: string): string {
  const d = new Date(isoDate + 'T12:00:00Z');
  const day = d.getUTCDate();
  const month = MONTH_NAMES[d.getUTCMonth()];
  const y = d.getUTCFullYear();
  const yy = y % 100;
  const suffix = day === 1 || day === 21 || day === 31 ? 'st' : day === 2 || day === 22 ? 'nd' : day === 3 || day === 23 ? 'rd' : 'th';
  return `${day}${suffix} ${month} ${yy}`;
}

function extractDescription(
  raw: string,
  opts: { amountCents?: number; postingDateIso?: string | null }
): string {
  const t = raw.trim();
  if (!t) return 'Transaction';
  let base = t
    .replace(/\b\d+(?:\.\d+)?\s*k\b/gi, (m) => {
      const n = parseFloat(m.replace(/\s*k/i, ''));
      return Number.isNaN(n) ? m : (n * 1000).toLocaleString('en-US', { maximumFractionDigits: 0 });
    })
    .replace(/\b\d+(?:\.\d+)?\s*m\b/gi, (m) => {
      const n = parseFloat(m.replace(/\s*m/i, ''));
      return Number.isNaN(n) ? m : (n * 1e6).toLocaleString('en-US', { maximumFractionDigits: 0 });
    })
    .replace(/\$?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(?:dollars?|usd)?/gi, (m) => {
      const n = parseFloat(m.replace(/,/g, ''));
      return Number.isNaN(n) ? m : `${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
    });
  // Normalize date-like parts to friendly form (e.g. 24-06-26 → 24th June 26)
  const dateIso = opts.postingDateIso ?? extractDate(raw);
  if (dateIso) {
    const friendly = formatDateFriendly(dateIso);
    const monthPat = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*';
    base = base
      .replace(/(?:on|due|date)?\s*\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b/gi, `on ${friendly}`)
      .replace(/(?:on|due|date)?\s*\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{2,4}\b/gi, `on ${friendly}`)
      .replace(/(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{2,4}\b/gi, `on ${friendly}`)
      .replace(new RegExp(`\\d{1,2}\\s+of\\s+${monthPat}\\s*(?:this\\s+year|\\d{2,4})?\\b`, 'gi'), `on ${friendly}`);
  }
  const capped = base.charAt(0).toUpperCase() + base.slice(1).toLowerCase();
  return capped.length > 120 ? capped.slice(0, 117) + '...' : capped;
}

/**
 * Score how well an account matches the transaction context.
 * Returns 0-1; higher = better match.
 */
function scoreAccountForExpense(
  account: AccountInput,
  rawLower: string
): number {
  const type = account.accountType.toLowerCase();
  if (type !== 'expense') return 0;
  const name = account.name.toLowerCase();
  const code = account.code.toLowerCase();
  let score = 0.2;
  for (const keywords of Object.values(EXPENSE_KEYWORDS)) {
    for (const kw of keywords) {
      if (rawLower.includes(kw) && (name.includes(kw) || code.includes(kw))) {
        score = Math.max(score, 0.9);
      }
      if (rawLower.includes(kw) && (name.includes(kw) || code.includes(kw) || name.includes('expense') || code.includes('6'))) {
        score = Math.max(score, 0.7);
      }
    }
  }
  if (rawLower.includes('aws') && (name.includes('cloud') || name.includes('software') || name.includes('internet') || code.startsWith('6'))) {
    score = Math.max(score, 0.85);
  }
  if (rawLower.includes('paid') || rawLower.includes('$')) {
    score = Math.max(score, 0.5);
  }
  return score;
}

function scoreAccountForCash(account: AccountInput, rawLower: string): number {
  const type = account.accountType.toLowerCase();
  if (type !== 'asset') return 0;
  const name = account.name.toLowerCase();
  const code = account.code.toLowerCase();
  for (const kw of CASH_KEYWORDS) {
    if (name.includes(kw) || code.includes(kw) || code.startsWith('1')) {
      return rawLower.includes('paid') || rawLower.includes('payment') ? 0.95 : 0.7;
    }
  }
  return code.startsWith('1') ? 0.5 : 0.2;
}

export function interpretTransaction(
  rawInput: string,
  accounts: AccountInput[]
): InterpretTransactionResult {
  const raw = rawInput.trim();
  const rawLower = raw.toLowerCase();
  const amountCents = parseAmountCents(raw);
  const postingDateIso = extractDate(raw);
  const description = extractDescription(raw, { amountCents, postingDateIso });

  const assets = accounts.filter((a) => a.accountType.toLowerCase() === 'asset');
  const expenses = accounts.filter((a) => a.accountType.toLowerCase() === 'expense');
  const equity = accounts.filter((a) => a.accountType.toLowerCase() === 'equity');

  let creditAccount = assets[0] ?? equity[0];
  let debitAccount = expenses[0] ?? equity[0] ?? assets[1] ?? assets[0];
  let confidenceScore = 70;

  if (amountCents > 0 && (rawLower.includes('paid') || rawLower.includes('payment') || rawLower.includes('$') || /\d+/.test(raw))) {
    const cashScored = assets
      .map((a) => ({ account: a, score: scoreAccountForCash(a, rawLower) }))
      .sort((a, b) => b.score - a.score);
    const expenseScored = expenses.length
      ? expenses
          .map((a) => ({ account: a, score: scoreAccountForExpense(a, rawLower) }))
          .sort((a, b) => b.score - a.score)
      : equity.map((a) => ({ account: a, score: 0.5 }));

    if (cashScored[0]?.score) creditAccount = cashScored[0].account;
    else if (!creditAccount && equity[0]) creditAccount = equity[0];
    if (expenseScored[0]?.account) debitAccount = expenseScored[0].account;
    const cashScore = cashScored[0]?.score ?? 0.5;
    const expenseScore = expenseScored[0]?.score ?? 0.5;
    confidenceScore = Math.round(65 + (cashScore + expenseScore) * 20);
  }

  confidenceScore = Math.min(98, Math.max(55, confidenceScore));

  const SUSPENSE_CODE = '9999-SUSPENSE';
  const lines: InterpretedLine[] =
    amountCents > 0 && creditAccount && debitAccount
      ? [
          { accountCode: debitAccount.code, debitAmountCents: amountCents, creditAmountCents: 0 },
          { accountCode: creditAccount.code, debitAmountCents: 0, creditAmountCents: amountCents },
        ]
      : (() => {
          const firstCode = assets[0]?.code ?? equity[0]?.code ?? '';
          const candidates = [assets[1]?.code, equity[0]?.code, assets[0]?.code].filter((c): c is string => !!c);
          const secondCode = candidates.find((c) => c !== firstCode) ?? (firstCode ? SUSPENSE_CODE : '');
          return [
            { accountCode: firstCode || SUSPENSE_CODE, debitAmountCents: 0, creditAmountCents: 0 },
            { accountCode: secondCode || SUSPENSE_CODE, debitAmountCents: 0, creditAmountCents: 0 },
          ];
        })();

  return {
    description,
    lines,
    confidenceScore,
    ...(postingDateIso ? { postingDate: postingDateIso } : {}),
  };
}
