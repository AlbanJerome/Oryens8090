/**
 * WO-GL-009: Validation tests – permission override for posting to closed period.
 * The 'Override' Check: accounting:post_to_closed_period permission allows posting to a closed period.
 */

import { describe, it, expect, vi } from 'vitest';
import { CreateJournalEntryCommandHandler } from '../create-journal-entry.handler.js';
import { JournalEntryError, PeriodClosedError } from '../../errors/journal-entry.errors.js';
import type {
  IJournalEntryRepository,
  IAccountRepository,
  IPeriodRepository,
  IDomainEventBus
} from '../../repositories/interfaces.js';
import { TemporalBalanceService } from '../../../domain/services/temporal-balance.service.js';
import { JournalEntryService } from '../../services/JournalEntryService.js';
import { IdempotencyService } from '../../services/idempotency.service.js';
import type { IIdempotencyRepository } from '../../services/idempotency.service.js';

const PERMISSION_POST_TO_CLOSED_PERIOD = 'accounting:post_to_closed_period';

function createValidCommand(overrides: Record<string, unknown> = {}) {
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
    ],
    ...overrides
  };
}

function createHandler(periodRepository: IPeriodRepository) {
  const accountRepository = {
    findByCodes: vi.fn().mockResolvedValue([
      { code: '1000-CASH', accountType: 'Asset' },
      { code: '4000-REV', accountType: 'Revenue' }
    ])
  } as unknown as IAccountRepository;

  return new CreateJournalEntryCommandHandler(
    {
      save: vi.fn(),
      findById: vi.fn(),
      findByIdempotencyKey: vi.fn(),
      findIntercompanyTransactions: vi.fn().mockResolvedValue([])
    } as unknown as IJournalEntryRepository,
    accountRepository,
    periodRepository,
    {} as TemporalBalanceService,
    { publish: vi.fn() } as unknown as IDomainEventBus,
    new IdempotencyService({
      findExisting: vi.fn().mockResolvedValue(null),
      recordExecution: vi.fn()
    } as unknown as IIdempotencyRepository),
    new JournalEntryService(periodRepository)
  );
}

describe('WO-GL-009: Post to closed period validation', () => {
  describe('Override check: accounting:post_to_closed_period permission', () => {
    it('rejects posting to closed period when permission is not present', async () => {
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
          }
        })
      } as unknown as IPeriodRepository;

      const handler = createHandler(periodRepository);
      const command = createValidCommand({ permissions: [] });

      const err = await handler.handle(command).catch((e) => e);
      expect(err).toBeInstanceOf(PeriodClosedError);
      expect((err as PeriodClosedError).code).toBe('PERIOD_CLOSED');
    });

    it('allows posting to closed period when accounting:post_to_closed_period is present', async () => {
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
          }
        })
      } as unknown as IPeriodRepository;

      const save = vi.fn().mockResolvedValue(undefined);
      const handler = new CreateJournalEntryCommandHandler(
        {
          save,
          findById: vi.fn(),
          findByIdempotencyKey: vi.fn(),
          findIntercompanyTransactions: vi.fn().mockResolvedValue([])
        } as unknown as IJournalEntryRepository,
        {
          findByCodes: vi.fn().mockResolvedValue([
            { code: '1000-CASH', accountType: 'Asset' },
            { code: '4000-REV', accountType: 'Revenue' }
          ])
        } as unknown as IAccountRepository,
        periodRepository,
        { applyJournalEntry: vi.fn().mockResolvedValue(undefined) } as unknown as TemporalBalanceService,
        { publish: vi.fn() } as unknown as IDomainEventBus,
        new IdempotencyService({
          findExisting: vi.fn().mockResolvedValue(null),
          recordExecution: vi.fn()
        } as unknown as IIdempotencyRepository),
        new JournalEntryService(periodRepository)
      );

      const command = createValidCommand({
        permissions: [PERMISSION_POST_TO_CLOSED_PERIOD]
      });

      const result = await handler.handle(command);
      expect(result.isSuccess).toBe(true);
      expect(result.journalEntryId).toBeDefined();
      expect(save).toHaveBeenCalledTimes(1);
    });

    it('rejects posting to non-existent period even with accounting:post_to_closed_period (existence check not bypassed)', async () => {
      const periodRepository = {
        canPostToDate: vi.fn().mockResolvedValue({
          allowed: false,
          period: null
        })
      } as unknown as IPeriodRepository;

      const handler = createHandler(periodRepository);
      const command = createValidCommand({
        permissions: [PERMISSION_POST_TO_CLOSED_PERIOD]
      });

      const err = await handler.handle(command).catch((e) => e);
      expect(err).toBeInstanceOf(JournalEntryError);
      expect((err as JournalEntryError).code).toBe('NO_PERIOD_FOUND');
    });

    it('correctly identifies the accounting:post_to_closed_period permission', () => {
      expect(PERMISSION_POST_TO_CLOSED_PERIOD).toBe('accounting:post_to_closed_period');
    });
  });
});
