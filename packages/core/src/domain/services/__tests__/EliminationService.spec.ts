/**
 * WO-GL-006: EliminationService QC
 * Mock Company A and Company B; Company A has $1,000 receivable from Company B.
 * Assert that after running EliminationService, the consolidated total for that account is $0.
 */

import { describe, it, expect } from 'vitest';
import { Money } from '../../value-objects/money.js';
import { JournalEntry } from '../../entities/journal-entry.js';
import { JournalEntryLine } from '../../entities/journal-entry-line.js';
import {
  EliminationService,
  type IIntercompanyTransactionSource
} from '../EliminationService.js';

const RECV_IC = 'RECV-IC';
const REVENUE = '4000-REV';
const ELIMINATION_ACCOUNT = 'IC-ELIM';
const TENANT_ID = 'tenant-1';
const COMPANY_A = 'company-a';
const COMPANY_B = 'company-b';
const CONSOLIDATION_ENTITY = 'consolidation-entity';
const USD = 'USD' as const;
const ONE_THOUSAND_CENTS = 100_000; // $1,000.00

function makeIntercompanyReceivableEntry(): JournalEntry {
  const entryId = crypto.randomUUID();
  return JournalEntry.create({
    tenantId: TENANT_ID,
    entityId: COMPANY_A,
    counterpartyEntityId: COMPANY_B,
    isIntercompany: true,
    postingDate: new Date('2025-01-15'),
    sourceModule: 'AR',
    sourceDocumentId: crypto.randomUUID(),
    sourceDocumentType: 'INVOICE',
    description: 'Company A receivable from Company B',
    lines: [
      new JournalEntryLine({
        entryId,
        accountCode: RECV_IC,
        debitAmount: Money.fromCents(ONE_THOUSAND_CENTS, USD),
        creditAmount: Money.zero(USD)
      }),
      new JournalEntryLine({
        entryId,
        accountCode: REVENUE,
        debitAmount: Money.zero(USD),
        creditAmount: Money.fromCents(ONE_THOUSAND_CENTS, USD)
      })
    ]
  });
}

function netBalanceCentsForAccount(entries: JournalEntry[], accountCode: string): number {
  let net = 0;
  for (const entry of entries) {
    for (const line of entry.lines) {
      if (line.accountCode !== accountCode) continue;
      net += line.debitAmount.toCents() - line.creditAmount.toCents();
    }
  }
  return net;
}

describe('EliminationService', () => {
  describe('generateEliminationEntries', () => {
    it('zeros out intercompany receivable so consolidated total for account is $0', async () => {
      const intercompanyEntry = makeIntercompanyReceivableEntry();
      const mockSource: IIntercompanyTransactionSource = {
        findIntercompanyTransactions: async () => [intercompanyEntry]
      };

      const service = new EliminationService(mockSource);
      const fromDate = new Date('2025-01-01');
      const toDate = new Date('2025-01-31');

      const eliminationEntries = await service.generateEliminationEntries(
        TENANT_ID,
        fromDate,
        toDate,
        CONSOLIDATION_ENTITY,
        ELIMINATION_ACCOUNT
      );

      expect(eliminationEntries.length).toBeGreaterThanOrEqual(1);

      const intercompanyNet = netBalanceCentsForAccount([intercompanyEntry], RECV_IC);
      expect(intercompanyNet).toBe(ONE_THOUSAND_CENTS);

      const eliminationNet = netBalanceCentsForAccount(eliminationEntries, RECV_IC);
      expect(eliminationNet).toBe(-ONE_THOUSAND_CENTS);

      const consolidatedTotalCents =
        netBalanceCentsForAccount([intercompanyEntry], RECV_IC) +
        netBalanceCentsForAccount(eliminationEntries, RECV_IC);
      expect(consolidatedTotalCents).toBe(0);
    });
  });
});
