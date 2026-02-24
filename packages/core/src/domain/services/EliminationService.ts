/**
 * WO-GL-006: Intercompany Elimination Generator
 * Scans for transactions where counterparty_entity_id is within the same tenant
 * and creates Elimination Journal Entries that net amounts to zero for consolidated reporting.
 * Part of General Ledger Domain Layer - Hexagonal Architecture
 */

import { Money } from '../value-objects/money.js';
import { JournalEntry } from '../entities/journal-entry.js';
import { JournalEntryLine } from '../entities/journal-entry-line.js';
import type { Currency } from '../value-objects/money.js';

/**
 * Port: source of intercompany transactions (same tenant, counterparty_entity_id set).
 * Implemented by infrastructure (e.g. IAccountRepository / IJournalEntryRepository).
 */
export interface IIntercompanyTransactionSource {
  findIntercompanyTransactions(
    tenantId: string,
    fromDate: Date,
    toDate: Date
  ): Promise<JournalEntry[]>;
}

/** Net position per account (debits - credits) from intercompany entries. */
interface AccountNet {
  accountCode: string;
  accountName?: string;
  netCents: number;
  currency: Currency;
}

/**
 * Domain service for intercompany elimination.
 * Produces elimination journal entries that zero out intercompany balances for consolidation.
 */
export class EliminationService {
  constructor(
    private readonly transactionSource: IIntercompanyTransactionSource
  ) {}

  /**
   * Scan for intercompany transactions (counterparty_entity_id within same tenant)
   * and generate elimination journal entries that net those amounts to zero.
   *
   * @param tenantId - Tenant scope
   * @param fromDate - Start of period
   * @param toDate - End of period
   * @param consolidationEntityId - Entity id used as "parent" for the elimination entry (e.g. consolidation entity)
   * @param eliminationAccountCode - Account code used for the offset side of elimination (e.g. IC-Elimination)
   * @param sourceModule - sourceModule for the generated entry
   * @returns Elimination journal entries (double-entry balanced) that net intercompany to zero
   */
  async generateEliminationEntries(
    tenantId: string,
    fromDate: Date,
    toDate: Date,
    consolidationEntityId: string,
    eliminationAccountCode: string,
    sourceModule: string = 'CONSOLIDATION'
  ): Promise<JournalEntry[]> {
    const transactions =
      await this.transactionSource.findIntercompanyTransactions(
        tenantId,
        fromDate,
        toDate
      );

    const netsByAccount = this.aggregateNetsByAccount(transactions);
    if (netsByAccount.length === 0) {
      return [];
    }

    const netsByCurrency = this.groupNetsByCurrency(netsByAccount);
    const entries: JournalEntry[] = [];

    for (const [currency, nets] of netsByCurrency) {
      const entryId = crypto.randomUUID();
      const lines = this.buildEliminationLines(
        nets,
        eliminationAccountCode,
        entryId
      );
      if (lines.length === 0) continue;

      const entry = JournalEntry.create({
        id: entryId,
        tenantId,
        entityId: consolidationEntityId,
        postingDate: toDate,
        sourceModule,
        sourceDocumentId: crypto.randomUUID(),
        sourceDocumentType: 'INTERCOMPANY_ELIMINATION',
        description: `Intercompany elimination for ${fromDate.toISOString().slice(0, 10)} to ${toDate.toISOString().slice(0, 10)} (${currency})`,
        lines,
        isIntercompany: false
      });
      entries.push(entry);
    }

    return entries;
  }

  private groupNetsByCurrency(
    nets: AccountNet[]
  ): Map<Currency, AccountNet[]> {
    const byCurrency = new Map<Currency, AccountNet[]>();
    for (const net of nets) {
      const list = byCurrency.get(net.currency) ?? [];
      list.push(net);
      byCurrency.set(net.currency, list);
    }
    return byCurrency;
  }

  /**
   * Aggregate intercompany entry lines by account: sum debits and credits, then net (debits - credits).
   */
  private aggregateNetsByAccount(entries: JournalEntry[]): AccountNet[] {
    const byKey = new Map<string, { accountCode: string; debitCents: number; creditCents: number; currency: Currency; accountName?: string }>();

    for (const entry of entries) {
      if (!entry.isIntercompany || !entry.counterpartyEntityId) continue;

      for (const line of entry.lines) {
        const accountCode = line.accountCode;
        const currency = line.debitAmount.currency;
        const key = `${accountCode}|${currency}`;
        const debitCents = line.debitAmount.toCents();
        const creditCents = line.creditAmount.toCents();

        const existing = byKey.get(key);
        if (!existing) {
          byKey.set(key, {
            accountCode,
            debitCents,
            creditCents,
            currency,
            accountName: undefined
          });
        } else {
          existing.debitCents += debitCents;
          existing.creditCents += creditCents;
        }
      }
    }

    const result: AccountNet[] = [];
    for (const agg of byKey.values()) {
      const netCents = agg.debitCents - agg.creditCents;
      if (netCents !== 0) {
        result.push({
          accountCode: agg.accountCode,
          accountName: agg.accountName,
          netCents,
          currency: agg.currency
        });
      }
    }
    return result;
  }

  /**
   * Build double-entry lines that net each account to zero via the elimination account.
   * For net > 0 (debit balance): we credit the account, debit elimination. For net < 0: debit account, credit elimination.
   */
  private buildEliminationLines(
    nets: AccountNet[],
    eliminationAccountCode: string,
    entryId: string
  ): JournalEntryLine[] {
    const lines: JournalEntryLine[] = [];

    for (const { accountCode, netCents, currency } of nets) {
      const amount = Math.abs(netCents);
      if (amount === 0) continue;

      const money = Money.fromCents(amount, currency);

      if (netCents > 0) {
        lines.push(
          new JournalEntryLine({
            entryId,
            accountCode: eliminationAccountCode,
            debitAmount: money,
            creditAmount: Money.zero(currency),
            description: `Elimination ${accountCode}`
          })
        );
        lines.push(
          new JournalEntryLine({
            entryId,
            accountCode,
            debitAmount: Money.zero(currency),
            creditAmount: money,
            description: `Elimination ${accountCode}`
          })
        );
      } else {
        lines.push(
          new JournalEntryLine({
            entryId,
            accountCode,
            debitAmount: money,
            creditAmount: Money.zero(currency),
            description: `Elimination ${accountCode}`
          })
        );
        lines.push(
          new JournalEntryLine({
            entryId,
            accountCode: eliminationAccountCode,
            debitAmount: Money.zero(currency),
            creditAmount: money,
            description: `Elimination ${accountCode}`
          })
        );
      }
    }

    return lines;
  }
}
