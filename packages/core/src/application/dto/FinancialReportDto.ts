/**
 * WO-GL-013: Financial Statement DTOs (application layer)
 */

import type { AccountType } from '../../domain/entities/account';

export interface ProfitAndLossLineDto {
  accountCode: string;
  accountName?: string;
  accountType: AccountType;
  amountCents: number;
  currency: string;
}

export interface ProfitAndLossReportDto {
  periodStart: string;
  periodEnd: string;
  currency: string;
  revenue: ProfitAndLossLineDto[];
  expenses: ProfitAndLossLineDto[];
  totalRevenueCents: number;
  totalExpenseCents: number;
  netIncomeCents: number;
}

export type BalanceSheetSection =
  | 'current_assets'
  | 'non_current_assets'
  | 'current_liabilities'
  | 'non_current_liabilities'
  | 'equity';

export interface BalanceSheetLineDto {
  accountCode: string;
  accountName?: string;
  accountType: AccountType;
  category?: string;
  section: BalanceSheetSection;
  amountCents: number;
  currency: string;
}

export interface BalanceSheetReportDto {
  asOfDate: string;
  currency: string;
  lines: BalanceSheetLineDto[];
  totalAssetsCents: number;
  totalLiabilitiesCents: number;
  totalEquityCents: number;
  netIncomeCents: number;
  totalLiabilitiesAndEquityCents: number;
  isBalanced: boolean;
}
