/**
 * WO-GL-012: Trial Balance Report API
 * GET /reports/trial-balance
 */

import type { IJournalEntryRepository } from '../../application/repositories/interfaces';
import type { TrialBalanceService } from '../../domain/services/TrialBalanceService';

export interface TrialBalanceQuery {
  tenantId: string;
  entityId: string;
  periodStart: string; // ISO date
  periodEnd: string;   // ISO date
}

export interface TrialBalanceReportDto {
  periodStart: string;
  periodEnd: string;
  lines: {
    accountCode: string;
    accountName?: string;
    currency: string;
    openingBalanceCents: number;
    periodDebitCents: number;
    periodCreditCents: number;
    closingBalanceCents: number;
  }[];
  totalDebitCents: number;
  totalCreditCents: number;
}

/**
 * Controller for GET /reports/trial-balance.
 * Injected: IJournalEntryRepository, TrialBalanceService.
 */
export class TrialBalanceController {
  constructor(
    private readonly journalEntryRepository: IJournalEntryRepository,
    private readonly trialBalanceService: TrialBalanceService
  ) {}

  /**
   * GET /reports/trial-balance
   * Query: tenantId, entityId, periodStart, periodEnd (ISO dates).
   */
  async getTrialBalance(query: TrialBalanceQuery): Promise<TrialBalanceReportDto> {
    const periodStart = new Date(query.periodStart);
    const periodEnd = new Date(query.periodEnd);

    const data = await this.journalEntryRepository.getTrialBalanceData(
      query.tenantId,
      query.entityId,
      periodStart,
      periodEnd
    );

    const report = this.trialBalanceService.buildReport(data, periodStart, periodEnd);

    return {
      periodStart: report.periodStart.toISOString(),
      periodEnd: report.periodEnd.toISOString(),
      lines: report.lines.map((line) => ({
        accountCode: line.accountCode,
        accountName: line.accountName,
        currency: line.currency,
        openingBalanceCents: line.openingBalanceCents,
        periodDebitCents: line.periodDebitCents,
        periodCreditCents: line.periodCreditCents,
        closingBalanceCents: line.closingBalanceCents
      })),
      totalDebitCents: report.totalDebitCents,
      totalCreditCents: report.totalCreditCents
    };
  }
}
