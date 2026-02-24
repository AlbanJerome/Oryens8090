// Domain Layer (WO-GL-002)
export * from './domain/index.js';

// Application Layer (WO-GL-003)
export * from './application/index.js';

// API Layer (WO-GL-008)
export * from './api/index.js';

// Key exports for convenience
export {
  Money,
  JournalEntry,
  Account,
  Entity,
  TemporalBalanceService,
  BalanceService,
  ConsolidationService,
  EliminationService
} from './domain/index.js';

export {
  CreateJournalEntryCommand,
  CreateJournalEntryCommandHandler,
  IdempotencyService
} from './application/index.js';

export {
  AccountController,
  toAccountDto,
  type AccountDto,
  type AccountBalanceDto
} from './api/index.js';
