# Oryens General Ledger

General Ledger and reporting engine with double-entry accounting, bitemporal balances, period close, and financial statements.

## Documentation

| Document | Description |
|----------|-------------|
| [docs/openapi.yaml](docs/openapi.yaml) | **API specification** – Ledger and reporting endpoints (accounts, journal entries, trial balance, P&L, balance sheet, consolidated balance sheet). |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | **Architecture** – Bitemporal model, Hexagonal (ports & adapters), and CQRS patterns. |
| [docs/OPERATIONS.md](docs/OPERATIONS.md) | **Operations** – Backups, monitoring, and recovery. |

## Database setup

Idempotent schema initialization (PostgreSQL):

```bash
# With DATABASE_URL set or passed as first argument (requires optional dependency pg)
npx tsx scripts/setup-db.ts "$DATABASE_URL"

# Or output SQL to run manually
npx tsx scripts/setup-db.ts > schema.sql
```

See [scripts/setup-db.ts](scripts/setup-db.ts) and [docs/OPERATIONS.md](docs/OPERATIONS.md) for details.

## Tests

- **Unit tests:** `npm test` (runs Vitest in all workspaces; core has 12 tests).
- **Integration tests:** `npm run test:integration` — runs audit-link and consolidation verification. Requires `DATABASE_URL` (PostgreSQL). Schema must be applied first (see Database setup).
- **Full tests (unit + integration):** `npm run test:full` — runs unit tests then integration tests. Set `DATABASE_URL` when you want integration checks.
- **E2E:** `npm run test:e2e` — Playwright; start the app (e.g. `npm run dev`) and use `PLAYWRIGHT_BASE_URL` if needed.

```bash
# Unit only
npm test

# Unit + integration (with DB)
DATABASE_URL=postgres://... npm run test:full
```

## Repo structure

- **packages/core** – Domain, application (commands/queries/handlers), API (controllers, DTOs), and repository interfaces.
- **docs/** – OpenAPI spec, architecture, and operations guides.
- **scripts/** – Database setup and utilities.
