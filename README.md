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

```bash
npx vitest run packages/core/src
```

## Repo structure

- **packages/core** – Domain, application (commands/queries/handlers), API (controllers, DTOs), and repository interfaces.
- **docs/** – OpenAPI spec, architecture, and operations guides.
- **scripts/** – Database setup and utilities.
