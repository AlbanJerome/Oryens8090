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
   * Throws PeriodClosedError if posting to the given date is not allowed (period is CLOSED).
   * Call this before saving any journal entry.
   */
  async assertCanPost(tenantId: string, postingDate: Date): Promise<void> {
    const result = await this.periodRepository.canPostToDate(tenantId, postingDate);
    if (!result.allowed) {
      if (result.period) {
        throw new PeriodClosedError(result.period.name, result.period.status);
      }
      throw new JournalEntryError(
        'No accounting period found for posting date',
        'NO_PERIOD_FOUND'
      );
    }
  }
}
