/**
 * Period Close Workflow: Journal Entry Service
 * Checks if a period is CLOSED before allowing any new entries.
 */

import { PeriodClosedError } from '../errors/journal-entry.errors.js';
import { JournalEntryError } from '../errors/journal-entry.errors.js';
import type { IPeriodRepository } from '../repositories/interfaces.js';

export class JournalEntryService {
  constructor(private readonly periodRepository: IPeriodRepository) {}

  /**
   * Validates that posting to the given date is allowed.
   * - Always enforces that a period exists for the date (throws NO_PERIOD_FOUND otherwise).
   * - Unless allowClosedPeriod is true, also rejects when the period is CLOSED (PeriodClosedError).
   */
  async assertCanPost(
    tenantId: string,
    postingDate: Date,
    options?: { allowClosedPeriod?: boolean }
  ): Promise<void> {
    const result = await this.periodRepository.canPostToDate(tenantId, postingDate);
    if (!result.period) {
      throw new JournalEntryError(
        'No accounting period found for posting date',
        'NO_PERIOD_FOUND'
      );
    }
    if (!result.allowed && !options?.allowClosedPeriod) {
      throw new PeriodClosedError(result.period.name, result.period.status);
    }
  }
}
