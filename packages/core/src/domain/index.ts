/**
 * WO-GL-002: Domain Layer Exports
 * Central export point for all domain entities, value objects, and services
 */

// Value Objects
export { Money, Currency } from './value-objects/money';

// Entities
export { 
  Account, 
  AccountType, 
  NormalBalance, 
  UUID, 
  TenantId,
  AccountProps 
} from './entities/account';

export { 
  JournalEntryLine, 
  JournalEntryLineProps 
} from './entities/journal-entry-line';

export { 
  JournalEntry, 
  JournalEntryProps,
  UnbalancedEntryError,
  EntityId 
} from './entities/journal-entry';

export { 
  TemporalBalance, 
  TemporalBalanceProps 
} from './entities/temporal-balance';

export {
  Entity,
  EntityProps,
  ConsolidationMethod
} from './entities/entity';

export {
  AccountingPeriod,
  AccountingPeriodProps,
  PeriodStatus
} from './entities/accounting-period';

// Services
export { 
  TemporalBalanceService, 
  ITemporalBalanceRepository 
} from './services/temporal-balance.service';

export {
  BalanceService,
  IBalanceQueryRepository,
  BalanceLine
} from './services/BalanceService';

export {
  ConsolidationService,
  FullConsolidationResult
} from './services/ConsolidationService';

export {
  EliminationService,
  IIntercompanyTransactionSource
} from './services/EliminationService';

export {
  TrialBalanceService,
  UnbalancedLedgerError,
  type TrialBalanceDataLine,
  type TrialBalanceReport,
  type TrialBalanceReportLine
} from './services/TrialBalanceService';
