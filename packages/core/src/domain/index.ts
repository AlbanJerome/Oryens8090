/**
 * WO-GL-002: Domain Layer Exports
 * Central export point for all domain entities, value objects, and services
 */

// Value Objects
export { Money, Currency } from './value-objects/money.js';

// Entities
export { 
  Account, 
  AccountType, 
  NormalBalance, 
  UUID, 
  TenantId,
  AccountProps 
} from './entities/account.js';

export { 
  JournalEntryLine, 
  JournalEntryLineProps 
} from './entities/journal-entry-line.js';

export { 
  JournalEntry, 
  JournalEntryProps,
  UnbalancedEntryError,
  EntityId 
} from './entities/journal-entry.js';

export { 
  TemporalBalance, 
  TemporalBalanceProps 
} from './entities/temporal-balance.js';

export {
  Entity,
  EntityProps,
  ConsolidationMethod
} from './entities/entity.js';

// Services
export { 
  TemporalBalanceService, 
  ITemporalBalanceRepository 
} from './services/temporal-balance.service.js';

export {
  BalanceService,
  IBalanceQueryRepository,
  BalanceLine
} from './services/BalanceService.js';

export {
  ConsolidationService,
  FullConsolidationResult
} from './services/ConsolidationService.js';
