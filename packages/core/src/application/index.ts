/**
 * Application Layer Public API
 * Barrel exports for services and application-level runtime items.
 *
 * IMPORTANT: Only export runtime values (classes, functions, etc.) from this barrel.
 * Pure types/interfaces should be imported directly from their source files to avoid
 * Turbopack static analysis issues in Next.js 16+.
 */

/* =========================
   Journal Entries
========================= */
export { JournalEntryService } from './services/JournalEntryService';

/* =========================
   Period Closing
========================= */
export { ClosingService } from './services/ClosingService';

/* =========================
   Financial Statements
========================= */
export { FinancialStatementService } from './services/FinancialStatementService';

// Add more service/class exports here in the future, following the same pattern
// Example:
// export { SomeOtherService } from './services/SomeOtherService';
