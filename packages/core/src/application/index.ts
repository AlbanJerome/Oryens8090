/**
 * Application Layer Public API
 * Barrel exports for services and application-level types.
 */

/* =========================
   Journal Entries
========================= */

export { JournalEntryService } from './services/JournalEntryService';


/* =========================
   Period Closing
========================= */

export { ClosingService } from './services/ClosingService';
export type { ClosingEntryResult } from './services/ClosingService';


/* =========================
   Financial Statements
========================= */

export { FinancialStatementService } from './services/FinancialStatementService';


/* =========================
   Repository Interfaces
========================= */

export type {
  IAccountRepository,
  ITrialBalanceRepository,
  ICurrencyConverter
} from './repositories/interfaces';
