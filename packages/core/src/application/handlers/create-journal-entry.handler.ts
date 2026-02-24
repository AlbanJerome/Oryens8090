import {
  Money,
  JournalEntry,
  JournalEntryLine,
  TemporalBalanceService,
  UnbalancedEntryError as DomainUnbalancedEntryError
} from '../../domain/index.js';

import {
  CreateJournalEntryCommand,
  CreateJournalEntryCommandValidator
} from '../commands/create-journal-entry.command.js';

import {
  JournalEntryError,
  UnbalancedEntryError,
  AccountNotFoundError
} from '../errors/journal-entry.errors.js';

import {
  IJournalEntryRepository,
  IAccountRepository,
  IPeriodRepository,
  IDomainEventBus,
  DomainEvent
} from '../repositories/interfaces.js';

import { IdempotencyService } from '../services/idempotency.service.js';
import { JournalEntryService } from '../services/JournalEntryService.js';
import type { IAuditLogger } from '../services/audit-logger.service.js';

export interface CreateJournalEntryResult {
  journalEntryId: string;
  isSuccess: boolean;
  wasIdempotent: boolean;
  affectedAccounts: string[];
  totalAmountCents: number;
}

export class CreateJournalEntryCommandHandler {
  constructor(
    private journalEntryRepository: IJournalEntryRepository,
    private accountRepository: IAccountRepository,
    private periodRepository: IPeriodRepository,
    private temporalBalanceService: TemporalBalanceService,
    private eventBus: IDomainEventBus,
    private idempotencyService: IdempotencyService,
    private journalEntryService: JournalEntryService,
    private auditLogger?: IAuditLogger
  ) {}

  async handle(command: CreateJournalEntryCommand): Promise<CreateJournalEntryResult> {
    try {
      // 1. Validate command
      this.validateCommand(command);

      // 2. Check idempotency
      if (command.idempotencyKey) {
        const existing = await this.checkIdempotency(command);
        if (existing) return existing;
      }

      // 3. Validate business rules
      await this.validateBusinessRules(command);

      // 4. Create journal entry
      const journalEntry = await this.createJournalEntry(command);

      // 5. Save to database
      await this.journalEntryRepository.save(journalEntry);

      // 6. Update account balances
      await this.temporalBalanceService.applyJournalEntry(
        command.tenantId,
        command.entityId,
        journalEntry
      );

      // 7. Publish events
      await this.publishEvents(journalEntry);

      // 8. Prepare result
      const result: CreateJournalEntryResult = {
        journalEntryId: journalEntry.id,
        isSuccess: true,
        wasIdempotent: false,
        affectedAccounts: journalEntry.getAffectedAccountCodes(),
        totalAmountCents: journalEntry.getTotalDebits().toCents()
      };

      // 9. Record idempotency
      if (command.idempotencyKey) {
        await this.idempotencyService.recordExecution(
          command.tenantId,
          command.idempotencyKey,
          'CreateJournalEntry',
          result
        );
      }

      // 10. WO-GL-014: Audit log (tenantId and userId in payload)
      if (this.auditLogger) {
        await this.auditLogger.log({
          tenantId: command.tenantId,
          userId: command.createdBy,
          action: 'JournalEntryCreated',
          entityType: 'JournalEntry',
          entityId: journalEntry.id,
          payload: {
            journalEntryId: journalEntry.id,
            entityId: command.entityId,
            postingDate: command.postingDate.toISOString(),
            totalAmountCents: result.totalAmountCents,
            affectedAccounts: result.affectedAccounts,
            sourceModule: command.sourceModule
          }
        });
      }

      return result;

    } catch (error) {
      if (error instanceof DomainUnbalancedEntryError) {
        throw new UnbalancedEntryError(error.message);
      }
      if (error instanceof JournalEntryError) {
        throw error;
      }
      throw new JournalEntryError(
        `Failed to create journal entry: ${error.message}`,
        'UNEXPECTED_ERROR'
      );
    }
  }

  private validateCommand(command: CreateJournalEntryCommand): void {
    const validation = CreateJournalEntryCommandValidator.validate(command);
    if (!validation.isValid) {
      throw new JournalEntryError(
        `Command validation failed: ${validation.errors.join(', ')}`,
        'COMMAND_VALIDATION_FAILED',
        { errors: validation.errors }
      );
    }
  }

  private async checkIdempotency(command: CreateJournalEntryCommand): Promise<CreateJournalEntryResult | null> {
    const existing = await this.idempotencyService.findExisting(
      command.tenantId,
      command.idempotencyKey!
    );
    if (existing) {
      return { ...existing.result, wasIdempotent: true } as CreateJournalEntryResult;
    }
    return null;
  }

  private async validateBusinessRules(command: CreateJournalEntryCommand): Promise<void> {
    // Validate accounts exist
    const accountCodes = [...new Set(command.lines.map(line => line.accountCode))];
    const accounts = await this.accountRepository.findByCodes(command.tenantId, accountCodes);
    const foundCodes = new Set(accounts.map(account => account.code));
    const missingCodes = accountCodes.filter(code => !foundCodes.has(code));
    if (missingCodes.length > 0) {
      throw new AccountNotFoundError(missingCodes[0], command.tenantId);
    }

    // Validate period: always require a period to exist; WO-GL-009: permission only overrides "closed" check
    const allowClosedPeriod = command.permissions?.includes('accounting:post_to_closed_period');
    await this.journalEntryService.assertCanPost(command.tenantId, command.postingDate, {
      allowClosedPeriod: !!allowClosedPeriod
    });
  }

  private async createJournalEntry(command: CreateJournalEntryCommand): Promise<JournalEntry> {
    const entryId = crypto.randomUUID();
    const lines = command.lines.map(cmdLine => new JournalEntryLine({
      entryId,
      accountCode: cmdLine.accountCode,
      debitAmount: Money.fromCents(cmdLine.debitAmountCents, command.currency),
      creditAmount: Money.fromCents(cmdLine.creditAmountCents, command.currency),
      costCenter: cmdLine.costCenter,
      description: cmdLine.description
    }));

    return JournalEntry.create({
      id: entryId,
      tenantId: command.tenantId,
      entityId: command.entityId,
      postingDate: command.postingDate,
      sourceModule: command.sourceModule,
      sourceDocumentId: command.sourceDocumentId,
      sourceDocumentType: command.sourceDocumentType,
      description: command.description,
      lines,
      isIntercompany: command.isIntercompany || false,
      counterpartyEntityId: command.counterpartyEntityId,
      createdBy: command.createdBy
    });
  }

  private async publishEvents(journalEntry: JournalEntry): Promise<void> {
    const event: DomainEvent = {
      eventId: crypto.randomUUID(),
      tenantId: journalEntry.tenantId,
      occurredAt: new Date(),
      eventType: 'JournalEntryPosted',
      payload: {
        journalEntryId: journalEntry.id,
        entityId: journalEntry.entityId,
        postingDate: journalEntry.postingDate.toISOString(),
        totalAmountCents: journalEntry.getTotalDebits().toCents(),
        affectedAccounts: journalEntry.getAffectedAccountCodes(),
        sourceModule: journalEntry.sourceModule
      }
    };
    await this.eventBus.publish(event);
  }
}
