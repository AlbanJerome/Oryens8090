/**
 * Period Close Workflow: Closing Service
 * Automates year-end transfer of Revenue and Expenses to Retained Earnings.
 * Ensures net income transfer is correct across multiple currencies via ICurrencyConverter.
 */

import { Money } from '../../domain/value-objects/money.js';
import { JournalEntry } from '../../domain/entities/journal-entry.js';
import { JournalEntryLine } from '../../domain/entities/journal-entry-line.js';
import type { Currency } from '../../domain/value-objects/money.js';
import type {
  IAccountRepository,
  ITrialBalanceRepository,
  ICurrencyConverter
} from '../repositories/interfaces.js';

export interface ClosingEntryResult {
  closingEntry: JournalEntry;
  totalRevenueCents: number;
  totalExpenseCents: number;
  netIncomeCents: number;
}

const SUPPORTED_CURRENCIES: readonly string[] = [
  'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'CNY'
];

function toCurrency(s: string): Currency {
  if (SUPPORTED_CURRENCIES.includes(s)) return s as Currency;
  throw new Error(`Unsupported currency: ${s}`);
}

/**
 * Resolves the amount to use in reporting currency. If account currency matches
 * reporting currency, returns the amount as-is. Otherwise converts via ICurrencyConverter
 * (throws if no rate available).
 */
async function toReportingCurrency(
  amountCents: number,
  accountCurrency: string,
  reportingCurrency: Currency,
  asOfDate: Date,
  converter: ICurrencyConverter
): Promise<{ cents: number; currency: Currency }> {
  const fromCur = toCurrency(accountCurrency);
  if (fromCur === reportingCurrency) {
    return { cents: amountCents, currency: reportingCurrency };
  }
  const amount = Money.fromCents(amountCents, fromCur);
  const converted = await converter.convert(amount, reportingCurrency, asOfDate);
  return { cents: converted.toCents(), currency: reportingCurrency };
}

/**
 * Generates the year-end closing entry that transfers Revenue and Expense balances
 * to Retained Earnings. Does not save the entry; caller must persist and update balances.
 * For every account, currency must match reportingCurrency or be convertible via ICurrencyConverter.
 */
export class ClosingService {
  constructor(
    private readonly accountRepository: IAccountRepository,
    private readonly trialBalanceRepository: ITrialBalanceRepository,
    private readonly currencyConverter: ICurrencyConverter
  ) {}

  /**
   * Build the closing entry for the given period end.
   * Revenue (credit balances) are debited to zero; Expense (debit balances) are credited to zero;
   * net is transferred to Retained Earnings. All amounts are in reportingCurrency; non-matching
   * account currencies are converted (throws if no rate available).
   */
  async buildClosingEntry(
    tenantId: string,
    entityId: string,
    periodEndDate: Date,
    retainedEarningsAccountCode: string,
    reportingCurrency: string = 'USD'
  ): Promise<ClosingEntryResult> {
    const trialBalance = await this.trialBalanceRepository.getTrialBalance(
      tenantId,
      entityId,
      periodEndDate
    );
    const accountCodes = trialBalance.map((tb) => tb.accountCode);
    const accounts = await this.accountRepository.findByCodes(tenantId, accountCodes);
    const revenueAccounts = accounts.filter((a) => a.accountType === 'Revenue');
    const expenseAccounts = accounts.filter((a) => a.accountType === 'Expense');

    const tbByCode = new Map(trialBalance.map((tb) => [tb.accountCode, tb]));
    const lines: JournalEntryLine[] = [];
    const entryId = crypto.randomUUID();
    const reportingCur = toCurrency(reportingCurrency);

    let totalRevenueCents = 0;
    for (const acc of revenueAccounts) {
      const tb = tbByCode.get(acc.code);
      if (!tb || tb.balanceCents === 0) continue;
      const amountCents = Math.abs(tb.balanceCents);
      const { cents } = await toReportingCurrency(
        amountCents,
        tb.currency,
        reportingCur,
        periodEndDate,
        this.currencyConverter
      );
      totalRevenueCents += cents;
      const amount = Money.fromCents(cents, reportingCur);
      lines.push(
        new JournalEntryLine({
          entryId,
          accountCode: acc.code,
          debitAmount: amount,
          creditAmount: Money.zero(reportingCur),
          description: 'Period close - revenue to retained earnings'
        })
      );
    }

    let totalExpenseCents = 0;
    for (const acc of expenseAccounts) {
      const tb = tbByCode.get(acc.code);
      if (!tb || tb.balanceCents === 0) continue;
      const amountCents = Math.abs(tb.balanceCents);
      const { cents } = await toReportingCurrency(
        amountCents,
        tb.currency,
        reportingCur,
        periodEndDate,
        this.currencyConverter
      );
      totalExpenseCents += cents;
      const amount = Money.fromCents(cents, reportingCur);
      lines.push(
        new JournalEntryLine({
          entryId,
          accountCode: acc.code,
          debitAmount: Money.zero(reportingCur),
          creditAmount: amount,
          description: 'Period close - expense to retained earnings'
        })
      );
    }

    const netIncomeCents = totalRevenueCents - totalExpenseCents;
    const reAmount = Money.fromCents(Math.abs(netIncomeCents), reportingCur);

    if (netIncomeCents > 0) {
      lines.push(
        new JournalEntryLine({
          entryId,
          accountCode: retainedEarningsAccountCode,
          debitAmount: Money.zero(reportingCur),
          creditAmount: reAmount,
          description: 'Period close - net income to retained earnings'
        })
      );
    } else if (netIncomeCents < 0) {
      lines.push(
        new JournalEntryLine({
          entryId,
          accountCode: retainedEarningsAccountCode,
          debitAmount: reAmount,
          creditAmount: Money.zero(reportingCur),
          description: 'Period close - net loss to retained earnings'
        })
      );
    }

    if (lines.length === 0) {
      throw new Error('No revenue or expense balances to close');
    }

    const closingEntry = JournalEntry.create({
      id: entryId,
      tenantId,
      entityId,
      postingDate: periodEndDate,
      sourceModule: 'PERIOD_CLOSE',
      sourceDocumentId: crypto.randomUUID(),
      sourceDocumentType: 'CLOSING_ENTRY',
      description: `Year-end closing entry as of ${periodEndDate.toISOString().slice(0, 10)}`,
      lines,
      isIntercompany: false
    });

    return {
      closingEntry,
      totalRevenueCents,
      totalExpenseCents,
      netIncomeCents
    };
  }
}
