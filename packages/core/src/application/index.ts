// Commands
export type { CreateJournalEntryCommand, CreateJournalEntryLineCommand } from './commands/create-journal-entry.command';
export { CreateJournalEntryCommandValidator } from './commands/create-journal-entry.command';

export { type ClosePeriodCommand } from './commands/close-period.command';

// Handlers
export {
  CreateJournalEntryCommandHandler,
  type CreateJournalEntryResult
} from './handlers/create-journal-entry.handler';

export {
  ClosePeriodCommandHandler,
  type ClosePeriodResult
} from './handlers/close-period.handler';

// Services
export {
  IdempotencyService,
  type IdempotencyRecord,
  type IIdempotencyRepository
} from './services/idempotency.service';

export { JournalEntryService } from './services/JournalEntryService';

export {
  ClosingService,
  type ClosingEntryResult
} from './services/ClosingService';

export {
  FinancialStatementService,
  filterAndSum,
  isCurrentAccount,
  type AccountBalanceWithType
} from './services/FinancialStatementService';

export {
  AuditLoggerService,
  type IAuditLogger,
  type IAuditLoggerRepository,
  type AuditLogEntry
} from './services/audit-logger.service';

// Interfaces
export {
  type IJournalEntryRepository,
  type IAccountRepository,
  type IPeriodRepository,
  type PeriodSnapshot,
  type IDomainEventBus,
  type DomainEvent,
  type TrialBalanceAccount,
  type ITrialBalanceRepository,
  type IEntityRepository,
  type ICurrencyConverter,
  type IApplyJournalEntry
} from './repositories/interfaces';

// Queries (WO-GL-005)
export {
  GetConsolidatedBalanceSheetQueryHandler,
  type GetConsolidatedBalanceSheetQuery
} from './queries/get-consolidated-balance-sheet.query';

// Errors
export {
  JournalEntryError,
  AccountNotFoundError,
  PeriodClosedError,
  DuplicateEntryError,
  ConversionRateUnavailableError
} from './errors/journal-entry.errors';
