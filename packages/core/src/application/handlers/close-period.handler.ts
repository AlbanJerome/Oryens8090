/**
 * WO-GL-014: Close period command handler.
 * Builds closing entry, saves, updates balances, and audit-logs.
 */

import { ClosingService } from '../services/ClosingService.js';
import type { IJournalEntryRepository } from '../repositories/interfaces.js';
import type { TemporalBalanceService } from '../../domain/services/temporal-balance.service.js';
import type { IAuditLogger } from '../services/audit-logger.service.js';
import type { ClosePeriodCommand } from '../commands/close-period.command.js';

export interface ClosePeriodResult {
  closingEntryId: string;
  totalRevenueCents: number;
  totalExpenseCents: number;
  netIncomeCents: number;
}

export class ClosePeriodCommandHandler {
  constructor(
    private readonly closingService: ClosingService,
    private readonly journalEntryRepository: IJournalEntryRepository,
    private readonly temporalBalanceService: TemporalBalanceService,
    private readonly auditLogger?: IAuditLogger
  ) {}

  async handle(command: ClosePeriodCommand): Promise<ClosePeriodResult> {
    const { closingEntry, totalRevenueCents, totalExpenseCents, netIncomeCents } =
      await this.closingService.buildClosingEntry(
        command.tenantId,
        command.entityId,
        command.periodEndDate,
        command.retainedEarningsAccountCode,
        command.reportingCurrency ?? 'USD'
      );

    await this.journalEntryRepository.save(closingEntry);
    await this.temporalBalanceService.applyJournalEntry(
      command.tenantId,
      command.entityId,
      closingEntry
    );

    if (this.auditLogger) {
      await this.auditLogger.log({
        tenantId: command.tenantId,
        userId: command.closedBy,
        action: 'PeriodClosed',
        entityType: 'JournalEntry',
        entityId: closingEntry.id,
        payload: {
          closingEntryId: closingEntry.id,
          entityId: command.entityId,
          periodEndDate: command.periodEndDate.toISOString(),
          totalRevenueCents,
          totalExpenseCents,
          netIncomeCents,
          retainedEarningsAccountCode: command.retainedEarningsAccountCode
        }
      });
    }

    return {
      closingEntryId: closingEntry.id,
      totalRevenueCents,
      totalExpenseCents,
      netIncomeCents
    };
  }
}
