/**
 * WO-GL-014: Verification script for Who-What-When audit link.
 * Creates a journal entry via the handler, then verifies that audit_log.entity_id
 * matches the journal entry id and payload is valid JSON.
 *
 * Run: DATABASE_URL=postgres://... npx tsx scripts/verify-audit-link.ts
 * Prerequisite: Schema applied (npx tsx scripts/setup-db.ts "$DATABASE_URL")
 */

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
    const entityId = crypto.randomUUID();
    const userId = crypto.randomUUID();
    const systemUserId = crypto.randomUUID();

    await seedMinimalData(client, tenantId, systemUserId);

    const {
      CreateJournalEntryCommandHandler,
      JournalEntryService,
      IdempotencyService,
      AuditLoggerService
    } = await import('../packages/core/src/application/index.js');
    const { TemporalBalanceService } = await import('../packages/core/src/domain/index.js');

    const journalEntryRepo = createJournalEntryRepo(client);
    const auditLogRepo = createAuditLogRepo(client);
    const accountRepo = createAccountRepo(tenantId, systemUserId);
    const periodRepo = createPeriodRepo(tenantId);
    const idempotencyRepo = { findByKey: async () => null, save: async () => {} };
    const eventBus = { publish: async () => {} };
    const temporalBalanceService = { applyJournalEntry: async () => {} } as unknown as InstanceType<
      typeof TemporalBalanceService
    >;
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

    const command = {
      tenantId,
      entityId,
      postingDate: new Date('2025-02-15'),
      sourceModule: 'VERIFY_AUDIT',
      sourceDocumentId: crypto.randomUUID(),
      sourceDocumentType: 'VERIFY',
      description: 'Verify audit link',
      currency: 'USD' as const,
      lines: [
        { accountCode: '1000-CASH', debitAmountCents: 10000, creditAmountCents: 0 },
        { accountCode: '4000-REV', debitAmountCents: 0, creditAmountCents: 10000 }
      ],
      createdBy: userId
    };

    const result = await handler.handle(command);
    const journalEntryId = result.journalEntryId;

    const journalRow = await client.query(
      'SELECT id FROM journal_entries WHERE id = $1',
      [journalEntryId]
    );
    const auditRow = await client.query(
      "SELECT entity_id, payload, action FROM audit_log WHERE entity_id = $1 AND action = 'JournalEntryCreated' ORDER BY created_at DESC LIMIT 1",
      [journalEntryId]
    );

    const journalFound = journalRow.rows[0];
    const auditFound = auditRow.rows[0];

    if (!journalFound) {
      console.error('FAIL: Journal entry not found in DB for id', journalEntryId);
      process.exit(1);
    }
    if (!auditFound) {
      console.error('FAIL: No audit_log row found for entity_id', journalEntryId);
      process.exit(1);
    }

    const uuidMatch = journalFound.id === auditFound.entity_id;
    let payloadValid = false;
    let payloadHasTenantAndUser = false;
    try {
      const payload =
        typeof auditFound.payload === 'string' ? JSON.parse(auditFound.payload) : auditFound.payload;
      payloadValid = payload !== null && typeof payload === 'object';
      payloadHasTenantAndUser =
        payloadValid &&
        payload.tenantId === tenantId &&
        (payload.userId === userId || payload.userId === null);
    } catch {
      payloadValid = false;
    }

    if (!uuidMatch) {
      console.error('FAIL: UUID mismatch. journal_entries.id:', journalFound.id, 'audit_log.entity_id:', auditFound.entity_id);
      process.exit(1);
    }
    if (!payloadValid) {
      console.error('FAIL: audit_log.payload is not valid JSON or is not an object');
      process.exit(1);
    }
    if (!payloadHasTenantAndUser) {
      console.error('FAIL: Payload must include tenantId and userId. tenantId:', tenantId, 'userId:', userId);
      process.exit(1);
    }

    console.log('SUCCESS: Who-What-When audit link verified.');
    console.log('  journal_entries.id === audit_log.entity_id:', journalEntryId);
    console.log('  payload JSON-serialized with tenantId and userId.');
  } finally {
    await client.end();
  }
}

function createJournalEntryRepo(client: import('pg').Client) {
  return {
    save: async (entry: import('../packages/core/src/domain/entities/journal-entry.js').JournalEntry) => {
      await client.query(
        `INSERT INTO journal_entries (id, tenant_id, entity_id, posting_date, source_module, source_document_id, source_document_type, description, is_intercompany, valid_time_start, version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          entry.id,
          entry.tenantId,
          entry.entityId,
          entry.postingDate,
          entry.sourceModule,
          entry.sourceDocumentId,
          entry.sourceDocumentType,
          entry.description,
          entry.isIntercompany,
          entry.validTimeStart,
          entry.version
        ]
      );
      for (const line of entry.lines) {
        await client.query(
          `INSERT INTO journal_entry_lines (id, entry_id, account_code, debit_amount_cents, credit_amount_cents, description)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            line.id,
            line.entryId,
            line.accountCode,
            line.debitAmount.toCents(),
            line.creditAmount.toCents(),
            line.description ?? null
          ]
        );
      }
    },
    findById: async (id: string) => null,
    findByIdempotencyKey: async () => null,
    findIntercompanyTransactions: async () => [],
    getTrialBalanceData: async () => []
  };
}

function createAuditLogRepo(client: import('pg').Client) {
  return {
    append: async (entry: import('../packages/core/src/application/services/audit-logger.service.js').AuditLogEntry) => {
      await client.query(
        `INSERT INTO audit_log (tenant_id, user_id, action, entity_type, entity_id, payload)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
        [
          entry.tenantId,
          entry.userId ?? null,
          entry.action,
          entry.entityType ?? null,
          entry.entityId ?? null,
          JSON.stringify(entry.payload)
        ]
      );
    }
  };
}

function createAccountRepo(tenantId: string, systemUserId: string) {
  const accounts = [
    { tenantId, code: '1000-CASH', name: 'Cash', accountType: 'Asset' as const, normalBalance: 'Debit' as const, createdBy: systemUserId, isSystemControlled: false, allowsIntercompany: false, externalMapping: {} },
    { tenantId, code: '4000-REV', name: 'Revenue', accountType: 'Revenue' as const, normalBalance: 'Credit' as const, createdBy: systemUserId, isSystemControlled: false, allowsIntercompany: false, externalMapping: {} }
  ];
  return {
    findById: async () => null,
    findByCode: async () => null,
    findByCodes: async (_t: string, codes: string[]) =>
      accounts.filter((a) => codes.includes(a.code))
  };
}

function createPeriodRepo(tenantId: string) {
  const periodId = crypto.randomUUID();
  return {
    canPostToDate: async () => ({
      allowed: true,
      period: {
        id: periodId,
        tenantId,
        name: '2025-02',
        startDate: new Date('2025-02-01'),
        endDate: new Date('2025-02-28'),
        status: 'OPEN'
      }
    })
  };
}

async function seedMinimalData(client: import('pg').Client, tenantId: string, systemUserId: string): Promise<void> {
  const accountIds = [crypto.randomUUID(), crypto.randomUUID()];
  await client.query(
    `INSERT INTO accounts (id, tenant_id, code, name, account_type, normal_balance, created_by)
     VALUES ($1, $2, '1000-CASH', 'Cash', 'Asset', 'Debit', $4), ($3, $2, '4000-REV', 'Revenue', 'Revenue', 'Credit', $4)
     ON CONFLICT (tenant_id, code) DO NOTHING`,
    [accountIds[0], tenantId, accountIds[1], systemUserId]
  );
  const periodId = crypto.randomUUID();
  await client.query(
    `INSERT INTO accounting_periods (id, tenant_id, name, start_date, end_date, status)
     VALUES ($1, $2, '2025-02', '2025-02-01', '2025-02-28', 'OPEN')
     ON CONFLICT (tenant_id, name) DO NOTHING`,
    [periodId, tenantId]
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
