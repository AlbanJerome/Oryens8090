# Architecture: Bitemporal, Hexagonal, and CQRS

This document describes the core architectural patterns used in the Oryens General Ledger: **bitemporal** data model, **hexagonal** (ports & adapters) structure, and **CQRS** (Command Query Responsibility Segregation) for ledger and reporting.

---

## 1. Bitemporal Model

### What It Is

We track **two time dimensions** for balances and ledger data:

- **Valid time** (effective date): when a fact is *true in the business world* (e.g. posting date of a journal entry, or “balance as of” date).
- **Transaction time** (system time): when we *recorded or last updated* that fact in the system.

This allows:

- **Point-in-time reporting**: “What was the balance as of date X?”
- **Audit and correction**: “What did we believe the balance was, as known at date T?” (e.g. before a later correction or reversal).

### Where It Appears in the Codebase

- **`TemporalBalance`** (`domain/entities/temporal-balance.ts`): Each balance row has `validTimeStart`, `validTimeEnd`, `transactionTimeStart`, `transactionTimeEnd`. Active rows use an “infinity” end date.
- **`BalanceService`** / **`IBalanceQueryRepository`**:  
  - `findLinesForBalance(accountId, validTime)` → balance at **valid time**.  
  - `findLinesForAuditBalance(accountId, validTime, transactionTime)` → balance as **known at transaction time** for that valid time (bitemporal audit).
- **`JournalEntry`**: `postingDate` and `validTimeStart` drive valid-time; infrastructure can record transaction time on persist.

### Design Choices

- Balances are derived from journal entry lines and stored in temporal balance rows so that “balance as of date X” is a simple lookup by valid time, without recomputing from all history.
- Corrections and reversals are represented as new journal entries (and new temporal balance versions), preserving history in both dimensions.

---

## 2. Hexagonal Architecture (Ports & Adapters)

### What It Is

The **domain** is the center; it defines **ports** (interfaces). **Adapters** (in infrastructure or application) implement those ports. Application and API depend *inward* on the domain and ports; the domain does not depend on frameworks or databases.

### Layering

| Layer        | Role | Examples |
|-------------|------|----------|
| **Domain**  | Entities, value objects, domain services, and port interfaces (e.g. `ITemporalBalanceRepository`, `IBalanceQueryRepository`). | `JournalEntry`, `TemporalBalance`, `Money`, `TrialBalanceService`, `TemporalBalanceService` |
| **Application** | Use cases: commands, command handlers, queries, query handlers, application services. Depend on domain and repository *interfaces*. | `CreateJournalEntryCommandHandler`, `GetConsolidatedBalanceSheetQueryHandler`, `JournalEntryService`, `FinancialStatementService` |
| **API**     | Controllers, DTOs, HTTP/OpenAPI. Call application handlers and return DTOs. | `AccountController`, `TrialBalanceController`, `FinancialReportController` |
| **Infrastructure** | Implementations of repositories (DB, events, etc.). Not in `packages/core` in this repo; they implement interfaces from application/domain. | (Implementations of `IJournalEntryRepository`, `ITrialBalanceRepository`, `IPeriodRepository`, etc.) |

### Ports (Interfaces)

- **Repositories**: `IJournalEntryRepository`, `IAccountRepository`, `IPeriodRepository`, `ITrialBalanceRepository`, `ITemporalBalanceRepository`, `IIdempotencyRepository`, `IEntityRepository`, etc. Defined in `application/repositories/interfaces.ts` or in domain (e.g. `ITemporalBalanceRepository` in `temporal-balance.service.ts`).
- **Events**: `IDomainEventBus` for publishing domain events (e.g. `JournalEntryPosted`).

Handlers and services receive these interfaces via constructor injection; infrastructure provides the concrete implementations at runtime.

---

## 3. CQRS (Command Query Responsibility Segregation)

### What It Is

- **Commands**: change state (e.g. post a journal entry). Return minimal outcome (e.g. success + id).
- **Queries**: read state; do not change it (e.g. trial balance, P&L, balance sheet, consolidated balance sheet).

We separate command handling from query handling and use different code paths and, where useful, different models (e.g. trial balance read model vs write model of journal entries).

### Commands

- **CreateJournalEntryCommand** + **CreateJournalEntryCommandHandler**:  
  Validates command, checks idempotency, enforces period and permissions (WO-GL-009), creates and saves the journal entry, updates temporal balances, publishes events.

Commands are validated (e.g. `CreateJournalEntryCommandValidator`) and can carry optional **permissions** (e.g. `accounting:post_to_closed_period`) for override behavior.

### Queries

- **Trial balance**: `getTrialBalanceData` (from journal entries or derived store) → **TrialBalanceService** → report (with UnbalancedLedgerError if totals don’t match).
- **P&L / Balance sheet**: **FinancialStatementService** uses trial balance (and account metadata) to build reports with correct signage and net income.
- **Consolidated balance sheet**: **GetConsolidatedBalanceSheetQuery** + **GetConsolidatedBalanceSheetQueryHandler** use `ITrialBalanceRepository` and **ConsolidationService** for multi-entity aggregation.

Query handlers and controllers do not modify ledger state; they only read through repository interfaces.

---

## 4. Cross-Cutting Concerns

- **Idempotency**: Command handler checks `idempotencyKey` via **IdempotencyService** before creating an entry; duplicate requests return the stored result.
- **Period close**: **JournalEntryService.assertCanPost** (and handler) enforce that a period exists and is open for posting unless the caller has the `accounting:post_to_closed_period` permission (WO-GL-009).
- **Errors**: Domain and application errors (e.g. `PeriodClosedError`, `UnbalancedLedgerError`, `JournalEntryError`) are thrown from handlers and can be mapped to HTTP responses by the API layer.

---

## 5. Summary

| Pattern    | Purpose |
|-----------|---------|
| **Bitemporal** | Correct “as of” and “as known at” reporting and audit; valid time + transaction time on balances and queries. |
| **Hexagonal**  | Domain at the center; ports (repository/event interfaces) and adapters (infrastructure); testable and swappable persistence. |
| **CQRS**       | Commands (create journal entry) vs queries (trial balance, P&L, balance sheet, consolidation); clear separation and room for read-model optimizations. |

For API contracts, see [openapi.yaml](./openapi.yaml). For deployment and schema setup, see [OPERATIONS.md](./OPERATIONS.md) and `scripts/setup-db.ts`.
