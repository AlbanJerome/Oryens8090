/**
 * WO-GL-014: Close period handler specs.
 * Test A: Net income and retained earnings.
 * Test B: Period closed → subsequent entries rejected (WO-GL-009 link).
 * Test C: Audit log entry describes "System Closing Entry".
 */

import { describe, it, expect, vi } from 'vitest';
import { Account } from '../../../domain/entities/account';
import { Money } from '../../../domain/value-objects/money';
import { JournalEntry } from '../../../domain/entities/journal-entry';
import { JournalEntryLine } from '../../../domain/entities/journal-entry-line';
import { ClosePeriodCommandHandler } from '../close-period.handler';
import { CreateJournalEntryCommandHandler } from '../create-journal-entry.handler';
import { ClosingService } from '../../services/ClosingService';
import { JournalEntryService } from '../../services/JournalEntryService';
import { IdempotencyService } from '../../services/idempotency.service';
import { PeriodClosedError } from '../../errors/journal-entry.errors';
import type {
  IJournalEntryRepository,
  IAccountRepository,
  IPeriodRepository,
  IDomainEventBus,
  IApplyJournalEntry,
} from '../../repositories/interfaces';
import type { IIdempotencyRepository } from '../../services/idempotency.service';

const tenantId = 'tenant-1';
const entityId = 'entity-1';
const periodEndDate = new Date('2024-12-31');
const reCode = '3000-RE';

describe('ClosePeriodCommandHandler', () => {
  describe('Test A: Net income and retained earnings', () => {
    it('correctly calculates net income and moves it to retained earnings', async () => {
      // Trial balance: Revenue 4000-REV credit 50_00, Expense 6000-EXP debit 20_00 → net income 30_00
      const trialBalance = [
        { accountCode: '4000-REV', balanceCents: -5000, currency: 'USD', accountType: 'Revenue' as const },
        { accountCode: '6000-EXP', balanceCents: 2000, currency: 'USD', accountType: 'Expense' as const },
      ];
      const accounts = [
        new Account({
          id: 'a1',
          tenantId,
          code: '4000-REV',
          name: 'Revenue',
          accountType: 'Revenue',
          normalBalance: 'Credit',
          createdBy: 'sys',
        }),
        new Account({
          id: 'a2',
          tenantId,
          code: '6000-EXP',
          name: 'Expense',
          accountType: 'Expense',
          normalBalance: 'Debit',
          createdBy: 'sys',
        }),
      ];
      const trialBalanceRepo = {
        getTrialBalance: vi.fn().mockResolvedValue(trialBalance),
      };
      const accountRepo = {
        findByCodes: vi.fn().mockResolvedValue(accounts),
      };
      const currencyConverter = {
        convert: vi.fn().mockImplementation((amount: Money) => Promise.resolve(amount)),
      };
      const closingService = new ClosingService(
        accountRepo as unknown as IAccountRepository,
        trialBalanceRepo as unknown as import('../../repositories/interfaces').ITrialBalanceRepository,
        currencyConverter as unknown as import('../../repositories/interfaces').ICurrencyConverter
      );

      const savedEntries: JournalEntry[] = [];
      const journalEntryRepo = {
        save: vi.fn().mockImplementation(async (entry: JournalEntry) => {
          savedEntries.push(entry);
        }),
        findById: vi.fn(),
        findByIdempotencyKey: vi.fn(),
        findIntercompanyTransactions: vi.fn().mockResolvedValue([]),
        getTrialBalanceData: vi.fn().mockResolvedValue([]),
      };

      const handler = new ClosePeriodCommandHandler(
        closingService,
        journalEntryRepo as unknown as IJournalEntryRepository,
        { applyJournalEntry: vi.fn().mockResolvedValue(undefined) } as IApplyJournalEntry
      );

      const result = await handler.handle({
        tenantId,
        entityId,
        periodEndDate,
        retainedEarningsAccountCode: reCode,
        reportingCurrency: 'USD',
      });

      expect(result.netIncomeCents).toBe(3000); // 5000 - 2000
      expect(result.totalRevenueCents).toBe(5000);
      expect(result.totalExpenseCents).toBe(2000);
      expect(savedEntries).toHaveLength(1);
      const closingEntry = savedEntries[0];
      const reLine = closingEntry.lines.find((l) => l.accountCode === reCode);
      expect(reLine).toBeDefined();
      expect(reLine!.creditAmount.toCents()).toBe(3000);
      expect(reLine!.debitAmount.toCents()).toBe(0);
    });
  });

  describe('Test B: Period closed → subsequent entries rejected (WO-GL-009 link)', () => {
    it('rejects posting when period is HARD_CLOSED', async () => {
      const periodRepository = {
        canPostToDate: vi.fn().mockResolvedValue({
          allowed: false,
          period: {
            id: 'p1',
            tenantId: 'tenant-1',
            name: '2024-12',
            startDate: new Date('2024-12-01'),
            endDate: new Date('2024-12-31'),
            status: 'HARD_CLOSED',
          },
          reason: 'Period is closed',
        }),
      } as unknown as IPeriodRepository;

      const accountRepository = {
        findByCodes: vi.fn().mockResolvedValue([
          { code: '1000-CASH', accountType: 'Asset' },
          { code: '4000-REV', accountType: 'Revenue' },
        ]),
      } as unknown as IAccountRepository;

      const createHandler = new CreateJournalEntryCommandHandler(
        {
          save: vi.fn(),
          findById: vi.fn(),
          findByIdempotencyKey: vi.fn(),
          findIntercompanyTransactions: vi.fn().mockResolvedValue([]),
          getTrialBalanceData: vi.fn().mockResolvedValue([]),
        } as unknown as IJournalEntryRepository,
        accountRepository,
        periodRepository,
        {} as IApplyJournalEntry,
        { publish: vi.fn() } as unknown as IDomainEventBus,
        new IdempotencyService({
          findExisting: vi.fn().mockResolvedValue(null),
          recordExecution: vi.fn(),
        } as unknown as IIdempotencyRepository),
        new JournalEntryService(periodRepository)
      );

      const command = {
        tenantId: 'tenant-1',
        entityId: 'entity-1',
        postingDate: new Date('2024-12-15'),
        sourceModule: 'AP' as const,
        sourceDocumentId: 'doc-1',
        sourceDocumentType: 'INVOICE',
        description: 'Test entry',
        currency: 'USD' as const,
        lines: [
          { accountCode: '1000-CASH', debitAmountCents: 10000, creditAmountCents: 0 },
          { accountCode: '4000-REV', debitAmountCents: 0, creditAmountCents: 10000 },
        ],
      };

      const err = await createHandler.handle(command).catch((e) => e);
      expect(err).toBeInstanceOf(PeriodClosedError);
      expect((err as PeriodClosedError).code).toBe('PERIOD_CLOSED');
    });
  });

  describe('Test C: Audit log describes System Closing Entry', () => {
    it('logs audit entry with description "System Closing Entry"', async () => {
      const closingEntryId = crypto.randomUUID();
      const closingEntry = JournalEntry.create({
        id: closingEntryId,
        tenantId,
        entityId,
        postingDate: periodEndDate,
        sourceModule: 'PERIOD_CLOSE',
        sourceDocumentId: crypto.randomUUID(),
        sourceDocumentType: 'CLOSING_ENTRY',
        description: 'Year-end closing',
        lines: [
          new JournalEntryLine({
            entryId: closingEntryId,
            accountCode: '4000-REV',
            debitAmount: Money.fromCents(3000, 'USD'),
            creditAmount: Money.zero('USD'),
            description: 'Revenue close',
          }),
          new JournalEntryLine({
            entryId: closingEntryId,
            accountCode: reCode,
            debitAmount: Money.zero('USD'),
            creditAmount: Money.fromCents(3000, 'USD'),
            description: 'Net income to RE',
          }),
        ],
        isIntercompany: false,
      });

      const mockClosingService = {
        buildClosingEntry: vi.fn().mockResolvedValue({
          closingEntry,
          totalRevenueCents: 5000,
          totalExpenseCents: 2000,
          netIncomeCents: 3000,
        }),
      };

      const logCapture: { tenantId: string; action: string; payload: Record<string, unknown> }[] = [];
      const auditLogger = {
        log: vi.fn().mockImplementation(async (entry: { tenantId: string; action: string; payload: Record<string, unknown> }) => {
          logCapture.push(entry);
        }),
      };

      const handler = new ClosePeriodCommandHandler(
        mockClosingService as unknown as ClosingService,
        { save: vi.fn(), findById: vi.fn(), findByIdempotencyKey: vi.fn(), findIntercompanyTransactions: vi.fn().mockResolvedValue([]), getTrialBalanceData: vi.fn().mockResolvedValue([]) } as unknown as IJournalEntryRepository,
        { applyJournalEntry: vi.fn().mockResolvedValue(undefined) } as IApplyJournalEntry,
        auditLogger as unknown as import('../../services/audit-logger.service').IAuditLogger
      );

      await handler.handle({
        tenantId,
        entityId,
        periodEndDate,
        retainedEarningsAccountCode: reCode,
        reportingCurrency: 'USD',
        closedBy: 'user-1',
      });

      expect(logCapture).toHaveLength(1);
      expect(logCapture[0].action).toBe('PeriodClosed');
      expect(logCapture[0].payload.description).toBe('System Closing Entry');
    });
  });
});
