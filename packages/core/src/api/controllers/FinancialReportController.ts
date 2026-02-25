/**
 * WO-GL-013: Financial Statement API
 * GET /reports/profit-and-loss
 * GET /reports/balance-sheet
 */

import type { ITrialBalanceRepository } from '../../application/repositories/interfaces';
import type { IAccountRepository } from '../../application/repositories/interfaces';
import type { FinancialStatementService } from '../../application/services/FinancialStatementService';
import type {
  ProfitAndLossReportDto,
  BalanceSheetReportDto
} from '../dto/FinancialReportDto';

export interface ProfitAndLossQuery {
  tenantId: string;
  entityId: string;
  periodStart: string;
  periodEnd: string;
}

export interface BalanceSheetQuery {
  tenantId: string;
  entityId: string;
  asOfDate: string;
}

/**
 * Controller for GET /reports/profit-and-loss and GET /reports/balance-sheet.
 */
export class FinancialReportController {
  constructor(
    private readonly trialBalanceRepository: ITrialBalanceRepository,
    private readonly accountRepository: IAccountRepository,
    private readonly financialStatementService: FinancialStatementService
  ) {}

  /**
   * GET /reports/profit-and-loss
   * Uses trial balance as of periodEnd for YTD revenue/expense; applies signage and net income.
   */
  async getProfitAndLoss(
    query: ProfitAndLossQuery
  ): Promise<ProfitAndLossReportDto> {
    const periodEnd = new Date(query.periodEnd);
    const trialBalance = await this.trialBalanceRepository.getTrialBalance(
      query.tenantId,
      query.entityId,
      periodEnd
    );
    const accountCodes = [...new Set(trialBalance.map((tb) => tb.accountCode))];
    const accounts = await this.accountRepository.findByCodes(
      query.tenantId,
      accountCodes
    );
    const items = this.financialStatementService.enrichWithAccountTypes(
      trialBalance,
      accounts
    );
    const pnl = this.financialStatementService.generateProfitAndLoss(
      items,
      new Date(query.periodStart),
      periodEnd
    );
    return {
      periodStart: query.periodStart,
      periodEnd: query.periodEnd,
      currency: pnl.currency,
      revenue: pnl.revenue,
      expenses: pnl.expenses,
      totalRevenueCents: pnl.totalRevenueCents,
      totalExpenseCents: pnl.totalExpenseCents,
      netIncomeCents: pnl.netIncomeCents
    };
  }

  /**
   * GET /reports/balance-sheet
   * Total Assets vs (Liabilities + Equity + NetIncome); isBalanced check.
   */
  async getBalanceSheet(query: BalanceSheetQuery): Promise<BalanceSheetReportDto> {
    const asOfDate = new Date(query.asOfDate);
    const trialBalance = await this.trialBalanceRepository.getTrialBalance(
      query.tenantId,
      query.entityId,
      asOfDate
    );
    const accountCodes = [...new Set(trialBalance.map((tb) => tb.accountCode))];
    const accounts = await this.accountRepository.findByCodes(
      query.tenantId,
      accountCodes
    );
    const items = this.financialStatementService.enrichWithAccountTypes(
      trialBalance,
      accounts
    );
    const report = this.financialStatementService.generateBalanceSheet(
      items,
      asOfDate
    );
    return {
      asOfDate: query.asOfDate,
      currency: report.currency,
      lines: report.lines,
      totalAssetsCents: report.totalAssetsCents,
      totalLiabilitiesCents: report.totalLiabilitiesCents,
      totalEquityCents: report.totalEquityCents,
      netIncomeCents: report.netIncomeCents,
      totalLiabilitiesAndEquityCents: report.totalLiabilitiesAndEquityCents,
      isBalanced: report.isBalanced
    };
  }
}
