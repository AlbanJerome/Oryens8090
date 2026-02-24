// Commands
export {
  CreateJournalEntryCommand,
  CreateJournalEntryLineCommand,
  CreateJournalEntryCommandValidator
} from './commands/create-journal-entry.command.js';

// Handlers
export {
  CreateJournalEntryCommandHandler,
  CreateJournalEntryResult
} from './handlers/create-journal-entry.handler.js';

// Services
export {
  IdempotencyService,
  IdempotencyRecord,
  IIdempotencyRepository
} from './services/idempotency.service.js';

// Interfaces
export {
  IJournalEntryRepository,
  IAccountRepository,
  IPeriodRepository,
  AccountingPeriod,
  IDomainEventBus,
  DomainEvent,
  TrialBalanceAccount,
  ITrialBalanceRepository,
  IEntityRepository
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
  DuplicateEntryError
} from './errors/journal-entry.errors.js';
