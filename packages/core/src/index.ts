// Domain Layer (WO-GL-002)
export * from './domain/index';

// Application Layer (WO-GL-003)
export * from './application/index';

// API Layer (WO-GL-008)
export * from './api/index'; 

// Infrastructure (e.g. Postgres adapters)
export {
  EntityRepositoryPostgres,
  type PgClient
} from './infrastructure/index';

// Key exports for convenience
export {
  Money,
  JournalEntry,
  Account,
  Entity,
  AccountingPeriod,
  TemporalBalanceService,
  BalanceService,
  ConsolidationService,
  EliminationService
} from './domain/index';

export {
  CreateJournalEntryCommand,
  CreateJournalEntryCommandHandler,
  IdempotencyService
} from './application/index';

export {
  AccountController,
  toAccountDto,
  type AccountDto,
  type AccountBalanceDto
} from './api/index';
