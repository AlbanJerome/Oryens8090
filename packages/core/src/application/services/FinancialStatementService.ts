/**
 * WO-GL-013: Financial Statement Service
 * P&L and Balance Sheet with audit fixes: signage, netIncome in balance check, classification.
 */

import type { AccountType } from '../../domain/entities/account';
import type {
  ProfitAndLossReportDto,
  BalanceSheetReportDto,
  BalanceSheetSection
} from '../dto/FinancialReportDto';
import type { TrialBalanceAccount } from '../repositories/interfaces';
import type { Account } from '../../domain/entities/account';

/** Account with balance and optional category for classification. */
export interface AccountBalanceWithType {
  accountCode: string;
  accountName?: string;
  accountType: AccountType;
  /** Optional category (e.g. 'Current') for classification; fallback to name. */
  category?: string;
  balanceCents: number;
  currency: string;
}

const CREDIT_NORMAL_TYPES: AccountType[] = ['Revenue', 'Liability', 'Equity'];

/**
 * Signage: For Revenue, Liability, Equity multiply balance by -1 so it appears as positive on the report.
 */
export function filterAndSum(
  items: AccountBalanceWithType[],
  accountTypes: AccountType[]
): number {
  const filtered = items.filter((item) => accountTypes.includes(item.accountType));
  return filtered.reduce((sum, item) => {
    const balance = item.balanceCents;
    const displayAmount =
      CREDIT_NORMAL_TYPES.includes(item.accountType) ? balance * -1 : balance;
    return sum + displayAmount;
  }, 0);
}

/**
 * Classification: Prefer category field if available, else fallback to accountName.includes('Current').
 */
export function isCurrentAccount(account: {
  accountName?: string;
  category?: string;
}): boolean {
  if (account.category != null && account.category !== '') {
    return account.category === 'Current';
  }
  return (account.accountName ?? '').includes('Current');
}

/**
 * Map account + balance to balance sheet section (current vs non-current).
 */
function toBalanceSheetSection(
  accountType: AccountType,
  isCurrent: boolean
): BalanceSheetSection {
  switch (accountType) {
    case 'Asset':
      return isCurrent ? 'current_assets' : 'non_current_assets';
    case 'Liability':
      return isCurrent ? 'current_liabilities' : 'non_current_liabilities';
    case 'Equity':
      return 'equity';
    default:
      return 'equity';
  }
}

/**
 * Display amount for report: Revenue, Liability, Equity => multiply by -1.
 */
function toDisplayCents(item: AccountBalanceWithType): number {
  return CREDIT_NORMAL_TYPES.includes(item.accountType)
    ? item.balanceCents * -1
    : item.balanceCents;
}

export class FinancialStatementService {
  /**
   * Build account+balance list from trial balance and accounts (by code).
   */
  enrichWithAccountTypes(
    trialBalance: TrialBalanceAccount[],
    accounts: Account[]
  ): AccountBalanceWithType[] {
    const byCode = new Map(accounts.map((a) => [a.code, a]));
    return trialBalance.map((tb) => {
      const account = byCode.get(tb.accountCode);
      const accountType = account?.accountType ?? 'Asset';
      const category = (account as Account & { category?: string })?.category;
      return {
        accountCode: tb.accountCode,
        accountName: tb.accountName ?? account?.name,
        accountType,
        category,
        balanceCents: tb.balanceCents,
        currency: tb.currency
      };
    });
  }

  /**
   * Generate P&L: Revenue and Expense lines with signage applied (Revenue/Liability/Equity * -1).
   */
  generateProfitAndLoss(
    items: AccountBalanceWithType[],
    periodStart: Date,
    periodEnd: Date
  ): Omit<ProfitAndLossReportDto, 'periodStart' | 'periodEnd'> {
    const revenue = items
      .filter((i) => i.accountType === 'Revenue')
      .map((i) => ({
        accountCode: i.accountCode,
        accountName: i.accountName,
        accountType: i.accountType as 'Revenue',
        amountCents: toDisplayCents(i),
        currency: i.currency
      }));
    const expenses = items
      .filter((i) => i.accountType === 'Expense')
      .map((i) => ({
        accountCode: i.accountCode,
        accountName: i.accountName,
        accountType: i.accountType as 'Expense',
        amountCents: toDisplayCents(i),
        currency: i.currency
      }));

    const totalRevenueCents = filterAndSum(items, ['Revenue']);
    const totalExpenseCents = filterAndSum(items, ['Expense']);
    const netIncomeCents = totalRevenueCents - totalExpenseCents;

    const currency = items[0]?.currency ?? 'USD';
    return {
      currency,
      revenue,
      expenses,
      totalRevenueCents,
      totalExpenseCents,
      netIncomeCents
    };
  }

  /**
   * Balance Sheet Integrity: First calculate netIncome (Revenue - Expenses).
   * The Balance Check: Add netIncome to totalLiabilitiesAndEquity.
   * isBalanced = Total Assets vs (Liabilities + Equity + NetIncome).
   * Classification: category field if available, else accountName.includes('Current').
   */
  generateBalanceSheet(
    items: AccountBalanceWithType[],
    asOfDate: Date
  ): Omit<BalanceSheetReportDto, 'asOfDate'> {
    const netIncomeCents =
      filterAndSum(items, ['Revenue']) - filterAndSum(items, ['Expense']);

    const lines: BalanceSheetReportDto['lines'] = items
      .filter((i) => ['Asset', 'Liability', 'Equity'].includes(i.accountType))
      .map((i) => {
        const isCurrent = isCurrentAccount({
          accountName: i.accountName,
          category: i.category
        });
        const section = toBalanceSheetSection(i.accountType, isCurrent);
        return {
          accountCode: i.accountCode,
          accountName: i.accountName,
          accountType: i.accountType,
          category: i.category,
          section,
          amountCents: toDisplayCents(i),
          currency: i.currency
        };
      });

    const totalAssetsCents = filterAndSum(items, ['Asset']);
    const totalLiabilitiesCents = filterAndSum(items, ['Liability']);
    const totalEquityCents = filterAndSum(items, ['Equity']);
    const totalLiabilitiesAndEquityCents =
      totalLiabilitiesCents + totalEquityCents + netIncomeCents;

    const isBalanced = totalAssetsCents === totalLiabilitiesAndEquityCents;
    const currency = items[0]?.currency ?? 'USD';

    return {
      currency,
      lines,
      totalAssetsCents,
      totalLiabilitiesCents,
      totalEquityCents,
      netIncomeCents,
      totalLiabilitiesAndEquityCents,
      isBalanced
    };
  }
}
