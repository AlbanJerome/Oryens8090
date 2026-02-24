/**
 * Verification script for consolidation math (WO-GL-011).
 * Setup: Parent (100% ownership), Subsidiary (80% ownership, Full).
 * Data: Post JE to subsidiary (Debit Cash $1000, Credit Equity $1000).
 * Verification: Total Assets = $1000, NCI = $200 (20% of subsidiary equity).
 *
 * Run: DATABASE_URL=postgres://... npx tsx tests/integration/verify-consolidation.ts
 */

import type { Client } from 'pg';
// Corrected path: Up two levels to reach project root
import type { TrialBalanceAccount } from '../../packages/core/src/application/repositories/interfaces.js';

async function main(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  const pg = await import('pg');
  const client = new pg.default.Client({ connectionString: dbUrl });
  await client.connect();

  try {
    const tenantId = crypto.randomUUID();
    const systemUserId = crypto.randomUUID();
    const parentEntityId = crypto.randomUUID();
    const subsidiaryEntityId = crypto.randomUUID();
    const asOfDate = new Date('2024-06-15');

    // --- Setup: Parent (100% ownership), Subsidiary (80%, Full) ---
    await seedAccounts(client, tenantId, systemUserId);
    await seedPeriod(client, tenantId);
    await seedEntities(client, tenantId, parentEntityId, subsidiaryEntityId);

    // --- Data: Post journal entry to subsidiary (Debit Cash $1000, Credit Equity $1000) ---
    await postSubsidiaryJournalEntry(client, tenantId, subsidiaryEntityId, systemUserId);

    // --- Execution: Run GetConsolidatedBalanceSheetQueryHandler ---
    const entityRepo = await createEntityRepository(client);
    const trialBalanceRepo = createTrialBalanceRepo(client);
    
    // Corrected paths for core application logic
    const { GetConsolidatedBalanceSheetQueryHandler } = await import(
      '../../packages/core/src/application/index.js'
    );
    const { ConsolidationService } = await import(
      '../../packages/core/src/domain/services/ConsolidationService.js'
    );

    const handler = new GetConsolidatedBalanceSheetQueryHandler(
      entityRepo,
      trialBalanceRepo,
      new ConsolidationService()
    );

    const result = await handler.execute({
      tenantId,
      parentEntityId,
      asOfDate
    });

    // --- Verification ---
    const cashLine = result.lines.find((l) => l.accountCode === '1000-CASH');
    const totalAssetsCents = cashLine?.amountCents ?? 0;
    const expectedAssetsCents = 100000; // $1000
    const totalNciCents = result.totalNciCents ?? 0;
    const expectedNciCents = 20000; // $200 (20% of $1000 equity)

    if (totalAssetsCents !== expectedAssetsCents) {
      console.error(
        `FAIL: Total Assets = $${totalAssetsCents / 100}, expected $${expectedAssetsCents / 100}`
      );
      process.exit(1);
    }
    if (totalNciCents !== expectedNciCents) {
      console.error(
        `FAIL: NCI = $${totalNciCents / 100}, expected $${expectedNciCents / 100}`
      );
      process.exit(1);
    }

    console.log('SUCCESS: Consolidation Math Verified');
    console.log(`  isBalanced: ${result.isBalanced}`);
    console.log('  Total Assets = $1000 (Full consolidation).');
    console.log('  Non-Controlling Interest (NCI) = $200 (20% of subsidiary equity).');
  } finally {
    await client.end();
  }
}

async function seedAccounts(
  client: Client,
  tenantId: string,
  systemUserId: string
): Promise<void> {
  await client.query(
    `INSERT INTO accounts (id, tenant_id, code, name, account_type, normal_balance, created_by)
     VALUES ($1, $2, '1000-CASH', 'Cash', 'Asset', 'Debit', $3), ($4, $2, '3000-EQUITY', 'Equity', 'Equity', 'Credit', $3)
     ON CONFLICT (tenant_id, code) DO NOTHING`,
    [crypto.randomUUID(), tenantId, systemUserId, crypto.randomUUID()]
  );
}

async function seedPeriod(client: Client, tenantId: string): Promise<void> {
  await client.query(
    `INSERT INTO accounting_periods (id, tenant_id, name, start_date, end_date, status)
     VALUES ($1, $2, '2024-06', '2024-06-01', '2024-06-30', 'OPEN')
     ON CONFLICT (tenant_id, name) DO NOTHING`,
    [crypto.randomUUID(), tenantId]
  );
}

async function seedEntities(
  client: Client,
  tenantId: string,
  parentEntityId: string,
  subsidiaryEntityId: string
): Promise<void> {
  await client.query(
    `INSERT INTO entities (id, tenant_id, name, parent_entity_id, ownership_percentage, consolidation_method, currency)
     VALUES ($1, $2, 'Parent', NULL, 100, 'Full', 'USD'),
            ($3, $2, 'Subsidiary', $1, 80, 'Full', 'USD')
     ON CONFLICT (id) DO NOTHING`,
    [parentEntityId, tenantId, subsidiaryEntityId]
  );
}

async function postSubsidiaryJournalEntry(
  client: Client,
  tenantId: string,
  entityId: string,
  systemUserId: string
): Promise<void> {
  // Corrected paths for imports
  const {
    CreateJournalEntryCommandHandler,
    JournalEntryService,
    IdempotencyService,
    AuditLoggerService
  } = await import('../../packages/core/src/application/index.js');
  const { TemporalBalanceService } = await import('../../packages/core/src/domain/index.js');

  const journalEntryRepo = createJournalEntryRepo(client);
  const auditLogRepo = createAuditLogRepo(client);
  const accountRepo = createAccountRepo(tenantId, systemUserId);
  const periodRepo = createPeriodRepo(tenantId);
  const idempotencyRepo = { findByKey: async () => null, save: async () => {} };
  const eventBus = { publish: async () => {} };
  const temporalBalanceService = { applyJournalEntry: async () => {} } as unknown as any;
  const journalEntryService = new JournalEntryService(periodRepo);
  const auditLogger = new AuditLoggerService(auditLogRepo);

  const handler = new CreateJournalEntryCommandHandler(
    journalEntryRepo,
    accountRepo,
    periodRepo,
    temporalBalanceService,
    eventBus,
    new IdempotencyService(idempotencyRepo),
    journalEntryService,
    auditLogger
  );

  await handler.handle({
    tenantId,
    entityId,
    postingDate: new Date('2024-06-15'),
    sourceModule: 'VERIFY_CONSOLIDATION',
    sourceDocumentId: crypto.randomUUID(),
    sourceDocumentType: 'VERIFY',
    description: 'Subsidiary: Debit Cash $1000, Credit Equity $1000',
    currency: 'USD',
    lines: [
      { accountCode: '1000-CASH', debitAmountCents: 100000, creditAmountCents: 0 },
      { accountCode: '3000-EQUITY', debitAmountCents: 0, creditAmountCents: 100000 }
    ],
    createdBy: systemUserId
  });
}

function createJournalEntryRepo(client: Client) {
  return {
    save: async (entry: any) => {
      await client.query(
        `INSERT INTO journal_entries (id, tenant_id, entity_id, posting_date, source_module, source_document_id, source_document_type, description, is_intercompany, valid_time_start, version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [entry.id, entry.tenantId, entry.entityId, entry.postingDate, entry.sourceModule, entry.sourceDocumentId, entry.sourceDocumentType, entry.description, entry.isIntercompany, entry.validTimeStart, entry.version]
      );
      for (const line of entry.lines) {
        await client.query(
          `INSERT INTO journal_entry_lines (id, entry_id, account_code, debit_amount_cents, credit_amount_cents, description)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [line.id, line.entryId, line.accountCode, line.debitAmount.toCents(), line.creditAmount.toCents(), line.description ?? null]
        );
      }
    },
    findById: async () => null,
    findByIdempotencyKey: async () => null,
    findIntercompanyTransactions: async () => [],
    getTrialBalanceData: async () => []
  };
}

function createAuditLogRepo(client: Client) {
  return {
    append: async (entry: any) => {
      await client.query(
        `INSERT INTO audit_log (tenant_id, user_id, action, entity_type, entity_id, payload)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
        [entry.tenantId, entry.userId ?? null, entry.action, entry.entityType ?? null, entry.entityId ?? null, JSON.stringify(entry.payload)]
      );
    }
  };
}

function createAccountRepo(tenantId: string, systemUserId: string) {
  const accounts = [
    { tenantId, code: '1000-CASH', name: 'Cash', accountType: 'Asset' as const, normalBalance: 'Debit' as const, createdBy: systemUserId },
    { tenantId, code: '3000-EQUITY', name: 'Equity', accountType: 'Equity' as const, normalBalance: 'Credit' as const, createdBy: systemUserId }
  ];
  return {
    findById: async () => null,
    findByCode: async () => null,
    findByCodes: async (_t: string, codes: string[]) =>
      accounts.filter((a) => codes.includes(a.code))
  };
}

function createPeriodRepo(tenantId: string) {
  return {
    canPostToDate: async () => ({
      allowed: true,
      period: { id: crypto.randomUUID(), tenantId, name: '2024-06', startDate: new Date('2024-06-01'), endDate: new Date('2024-06-30'), status: 'OPEN' }
    })
  };
}

function createTrialBalanceRepo(client: Client) {
  return {
    getTrialBalance: async (tenantId: string, entityId: string, asOfDate: Date): Promise<TrialBalanceAccount[]> => {
      const dateStr = asOfDate.toISOString().slice(0, 10);
      const res = await client.query(
        `SELECT jel.account_code, a.name AS account_name, SUM(jel.debit_amount_cents - jel.credit_amount_cents) AS balance_cents, 'USD' AS currency, a.account_type AS account_type
         FROM journal_entry_lines jel
         JOIN journal_entries je ON je.id = jel.entry_id
         LEFT JOIN accounts a ON a.tenant_id = je.tenant_id AND a.code = jel.account_code
         WHERE je.tenant_id = $1 AND je.entity_id = $2 AND je.posting_date <= $3::date
         GROUP BY jel.account_code, a.name, a.account_type`,
        [tenantId, entityId, dateStr]
      );
      return res.rows.map((r: any) => ({
        accountCode: r.account_code,
        accountName: r.account_name ?? undefined,
        balanceCents: Number(r.balance_cents),
        currency: r.currency,
        accountType: r.account_type ?? undefined
      }));
    }
  };
}

async function createEntityRepository(client: Client) {
  // Corrected path for infrastructure
  const { EntityRepositoryPostgres } = await import('../../packages/core/src/infrastructure/index.js');
  return new EntityRepositoryPostgres(client as any);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
