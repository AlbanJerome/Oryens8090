# Operations: Backups, Monitoring, and Recovery

This guide covers operational practices for the Oryens General Ledger: database backups, monitoring, and recovery procedures.

---

## 1. Database backups

### What to back up

- **Primary store**: All tables created by `scripts/setup-db.ts`: `accounts`, `journal_entries`, `journal_entry_lines`, `temporal_balances`, `accounting_periods`, `idempotency_records`, `entities`.
- Prefer **consistent** (e.g. transactionally consistent) backups so the ledger and bitemporal state stay in sync.

### Recommended approach (PostgreSQL)

- **Continuous archiving (WAL)** plus base backups: use `pg_basebackup` and WAL archiving so you can restore to any point in time (PITR) within your retention window.
- **Scheduled full dumps**: e.g. `pg_dump -Fc` (custom format) at least daily; retain for at least 7–30 days depending on policy.
- **Retention**: Define retention (e.g. 30 days for daily, 12 months for weekly) and automate deletion of expired backups.

### Idempotency and backups

- `idempotency_records` can be truncated or pruned (e.g. by `expires_at`) to control size; ensure backup runs before aggressive pruning if you need to recover recent keys.

---

## 2. Monitoring

### Health and availability

- **Liveness**: HTTP endpoint (e.g. `/health`) that checks process and, if applicable, DB connectivity.
- **Readiness**: Endpoint that returns ready only when the app can accept traffic (DB and any required services up).

### Ledger-specific metrics

- **Journal entry volume**: Count of `journal_entries` created per tenant/entity per period (e.g. per hour/day) to detect anomalies or abuse.
- **Balance check**: Periodic job that recomputes trial balance (or sample of accounts) and compares to stored balances; alert on large or persistent drift.
- **Period close**: Monitor `accounting_periods` and alert when a period remains open past a configured deadline (e.g. month-end + N days).

### Infrastructure

- **Database**: Connection pool usage, query latency (e.g. p95), replication lag if using replicas.
- **Application**: Request rate, error rate, and latency for critical paths (e.g. POST journal entry, GET trial balance / reports).

### Alerts

- DB unreachable or replication lag above threshold.
- Error rate or latency for ledger/report endpoints above threshold.
- Trial balance or balance-sheet integrity check failures (e.g. `isBalanced: false` or UnbalancedLedgerError in logs).

---

## 3. Recovery

### Restore from backup

1. **Stop** application writes to the database (drain traffic or take app offline).
2. **Restore** the database from the chosen backup (full restore or PITR, depending on RTO/RPO).
3. **Re-run** idempotent schema script if needed: `npx tsx scripts/setup-db.ts "$DATABASE_URL"` (safe to run on an existing schema).
4. **Verify**: Run a quick sanity check (e.g. trial balance for a known entity, or count of journal entries).
5. **Resume** application traffic.

### Data correction (post-restore or incident)

- **Bitemporal model**: Corrections are done by posting **new** journal entries (e.g. adjustments or reversals), not by editing past rows. This keeps valid-time and transaction-time history consistent.
- **Reconciliation**: Use trial balance and financial reports (P&L, balance sheet) to reconcile against external sources; then post correcting entries as needed.

### Runbook summary

| Scenario              | Action |
|----------------------|--------|
| DB down              | Failover to replica if available; else restore from latest backup and bring DB up. |
| Corrupt or bad data  | Restore from last known good backup (or PITR); then re-apply or re-post any valid operations after that point. |
| High error rate      | Check DB and dependencies; scale or fix; consider circuit breaker or read-only mode. |
| Unbalanced ledger    | Investigate source (bug, partial write, bad data); fix in app or data; post correcting entries; improve validations and tests. |

---

## 4. Schema and migrations

- **Initial setup**: Use `scripts/setup-db.ts` for idempotent creation of tables and indexes (see [README](../README.md) and script header).
- **Future changes**: Prefer **migrations** (versioned DDL scripts) for new tables or columns; keep `setup-db.ts` aligned with the minimal schema required for a fresh install. For major upgrades, document compatibility and any backfill steps in release notes.

---

## 5. References

- [ARCHITECTURE.md](./ARCHITECTURE.md) – Bitemporal and CQRS context.
- [openapi.yaml](./openapi.yaml) – API contracts for ledger and reports.
- `scripts/setup-db.ts` – Database schema initialization.
