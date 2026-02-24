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

export { JournalEntryService } from './services/JournalEntryService.js';

export {
  ClosingService,
  ClosingEntryResult
} from './services/ClosingService.js';

// Interfaces
export {
  IJournalEntryRepository,
  IAccountRepository,
  IPeriodRepository,
  PeriodSnapshot,
  IDomainEventBus,
  DomainEvent,
  TrialBalanceAccount,
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
