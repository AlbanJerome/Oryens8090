// Commands
export {
  CreateJournalEntryCommand,
  CreateJournalEntryLineCommand,
  CreateJournalEntryCommandValidator
} from './commands/create-journal-entry.command.js';

export { type ClosePeriodCommand } from './commands/close-period.command.js';

// Handlers
export {
  CreateJournalEntryCommandHandler,
  CreateJournalEntryResult
} from './handlers/create-journal-entry.handler.js';

export {
  ClosePeriodCommandHandler,
  type ClosePeriodResult
} from './handlers/close-period.handler.js';

// Services
export {
  IdempotencyService,
  IdempotencyRecord,
  IIdempotencyRepository
} from './services/idempotency.service.js';

export { JournalEntryService } from './services/JournalEntryService.js';

export {
  ClosingService,
  type ClosingEntryResult // Add the 'type' keyword here
} from './services/ClosingService';

export {
  FinancialStatementService,
  filterAndSum,
  isCurrentAccount,
  type AccountBalanceWithType
} from './services/FinancialStatementService.js';

export {
  AuditLoggerService,
  type IAuditLogger,
  type IAuditLoggerRepository,
  type AuditLogEntry
} from './services/audit-logger.service.js';

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
} from './repositories/interfaces.js';

// Queries (WO-GL-005)
export {
  GetConsolidatedBalanceSheetQueryHandler,
  GetConsolidatedBalanceSheetQuery
} from './queries/get-consolidated-balance-sheet.query.js';

// Errors
export {
  JournalEntryError,
  UnbalancedEntryError,
  AccountNotFoundError,
  PeriodClosedError,
  DuplicateEntryError,
  ConversionRateUnavailableError
} from './errors/journal-entry.errors.js';
