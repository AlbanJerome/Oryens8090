// Commands
export {
  CreateJournalEntryCommand,
  CreateJournalEntryLineCommand,
  CreateJournalEntryCommandValidator
} from './commands/create-journal-entry.command';

export { type ClosePeriodCommand } from './commands/close-period.command';

// Handlers
export {
  CreateJournalEntryCommandHandler,
  CreateJournalEntryResult
} from './handlers/create-journal-entry.handler';

export {
  ClosePeriodCommandHandler,
  type ClosePeriodResult
} from './handlers/close-period.handler';

// Services
export {
  IdempotencyService,
  IdempotencyRecord,
  IIdempotencyRepository
} from './services/idempotency.service';

export { JournalEntryService } from './services/JournalEntryService';

export {
  ClosingService,
  ClosingEntryResult
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
  IJournalEntryRepository,
  IAccountRepository,
  IPeriodRepository,
  PeriodSnapshot,
  IDomainEventBus,
  DomainEvent,
  TrialBalanceAccount,
  TrialBalanceDataLine,
  ITrialBalanceRepository,
  IEntityRepository,
  ICurrencyConverter
} from './repositories/interfaces';

// Queries (WO-GL-005)
export {
  GetConsolidatedBalanceSheetQueryHandler,
  GetConsolidatedBalanceSheetQuery
} from './queries/get-consolidated-balance-sheet.query';

// Errors
export {
  JournalEntryError,
  UnbalancedEntryError,
  AccountNotFoundError,
  PeriodClosedError,
  DuplicateEntryError,
  ConversionRateUnavailableError
} from './errors/journal-entry.errors';
