/**
 * WO-GL-002: Domain Layer Exports
 * Central export point for all domain entities, value objects, and services
 */

// Value Objects
export type { Currency } from './value-objects/money';
export { Money } from './value-objects/money';

// Entities
export type { AccountType, NormalBalance, UUID, TenantId, AccountProps } from './entities/account';
export { Account, AccountTypeEnum, isAsset, isLiability, isEquity } from './entities/account';

export type { JournalEntryLineProps } from './entities/journal-entry-line';
export { JournalEntryLine } from './entities/journal-entry-line';

export type { JournalEntryProps, EntityId } from './entities/journal-entry';
export { JournalEntry, UnbalancedEntryError } from './entities/journal-entry';

export type { TemporalBalanceProps } from './entities/temporal-balance';
export { TemporalBalance } from './entities/temporal-balance';

export type { EntityProps, ConsolidationMethod } from './entities/entity';
export { Entity } from './entities/entity';

export type { AccountingPeriodProps, PeriodStatus } from './entities/accounting-period';
export { AccountingPeriod } from './entities/accounting-period';

// Services
export type { ITemporalBalanceRepository } from './services/temporal-balance.service';
export { TemporalBalanceService } from './services/temporal-balance.service';

export type { IBalanceQueryRepository, BalanceLine } from './services/BalanceService';
export { BalanceService } from './services/BalanceService';

export type { FullConsolidationResult } from './services/ConsolidationService';
export { ConsolidationService } from './services/ConsolidationService';

export type { IIntercompanyTransactionSource } from './services/EliminationService';
export { EliminationService } from './services/EliminationService';

export {
  TrialBalanceService,
  UnbalancedLedgerError,
  type TrialBalanceDataLine,
  type TrialBalanceReport,
  type TrialBalanceReportLine
} from './services/TrialBalanceService';
