/**
 * Period Close Workflow: prove that posting to a closed period throws an error.
 */

import { describe, it, expect, vi } from 'vitest';
import { CreateJournalEntryCommandHandler } from '../create-journal-entry.handler.js';
import { PeriodClosedError } from '../../errors/journal-entry.errors.js';
import type {
  IJournalEntryRepository,
  IAccountRepository,
  IPeriodRepository,
  IDomainEventBus
} from '../../repositories/interfaces.js';
import { TemporalBalanceService } from '../../../domain/services/temporal-balance.service.js';
import type { ITemporalBalanceRepository } from '../../repositories/interfaces.js';
import { JournalEntryService } from '../../services/JournalEntryService.js';
import { IdempotencyService } from '../../services/idempotency.service.js';
import type { IIdempotencyRepository } from '../../services/idempotency.service.js';

function createValidCommand() {
  return {
    tenantId: 'tenant-1',
    entityId: 'entity-1',
    postingDate: new Date('2024-12-15'),
    sourceModule: 'AP',
    sourceDocumentId: 'doc-1',
    sourceDocumentType: 'INVOICE',
    description: 'Test entry',
    currency: 'USD' as const,
    lines: [
      { accountCode: '1000-CASH', debitAmountCents: 10000, creditAmountCents: 0 },
      { accountCode: '4000-REV', debitAmountCents: 0, creditAmountCents: 10000 }
    ]
  };
}

describe('CreateJournalEntryCommandHandler', () => {
  it('throws PeriodClosedError when posting to a closed period', async () => {
    const periodRepository = {
      canPostToDate: vi.fn().mockResolvedValue({
        allowed: false,
        period: {
          id: 'p1',
          tenantId: 'tenant-1',
          name: '2024-12',
          startDate: new Date('2024-12-01'),
          endDate: new Date('2024-12-31'),
          status: 'HARD_CLOSED'
        },
        reason: 'Period is closed'
      })
    } as unknown as IPeriodRepository;

    const accountRepository = {
      findByCodes: vi.fn().mockResolvedValue([
        { code: '1000-CASH', accountType: 'Asset' },
        { code: '4000-REV', accountType: 'Revenue' }
      ])
    } as unknown as IAccountRepository;

    const handler = new CreateJournalEntryCommandHandler(
      { save: vi.fn(), findById: vi.fn(), findByIdempotencyKey: vi.fn() } as unknown as IJournalEntryRepository,
      accountRepository,
      periodRepository,
      {} as TemporalBalanceService,
      { publish: vi.fn() } as unknown as IDomainEventBus,
      new IdempotencyService({ findExisting: vi.fn().mockResolvedValue(null), recordExecution: vi.fn() } as unknown as IIdempotencyRepository),
      new JournalEntryService(periodRepository)
    );

    const command = createValidCommand();

    const err = await handler.handle(command).catch((e) => e);
    expect(err).toBeInstanceOf(PeriodClosedError);
    expect((err as PeriodClosedError).message).toContain('Cannot post to');
    expect((err as PeriodClosedError).message).toContain('2024-12');
    expect((err as PeriodClosedError).code).toBe('PERIOD_CLOSED');
  });
});
