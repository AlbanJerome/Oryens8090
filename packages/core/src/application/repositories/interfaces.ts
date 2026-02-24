import { JournalEntry, Account } from '../../domain/index.js';
import type { Entity } from '../../domain/entities/entity.js';
import type { Money } from '../../domain/value-objects/money.js';
import type { Currency } from '../../domain/value-objects/money.js';

export interface IJournalEntryRepository {
  save(entry: JournalEntry): Promise<void>;
  findById(id: string): Promise<JournalEntry | null>;
  findByIdempotencyKey(tenantId: string, idempotencyKey: string): Promise<JournalEntry | null>;
  /**
   * WO-GL-006: Intercompany transactions (counterparty_entity_id within same tenant).
   * Returns journal entries where isIntercompany === true for the given tenant and date range.
   */
  findIntercompanyTransactions(
    tenantId: string,
    fromDate: Date,
    toDate: Date
  ): Promise<JournalEntry[]>;
}

export interface IAccountRepository {
  findById(tenantId: string, accountId: string): Promise<Account | null>;
  findByCode(tenantId: string, accountCode: string): Promise<Account | null>;
  findByCodes(tenantId: string, accountCodes: string[]): Promise<Account[]>;
}

/** Snapshot shape returned by IPeriodRepository (avoids shadowing domain AccountingPeriod entity). */
export interface PeriodSnapshot {
  id: string;
  tenantId: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: 'OPEN' | 'SOFT_CLOSED' | 'HARD_CLOSED';
}

export interface IPeriodRepository {
  canPostToDate(tenantId: string, date: Date): Promise<{
    allowed: boolean;
    period: PeriodSnapshot | null;
    reason?: string;
  }>;
}

export interface DomainEvent {
  eventId: string;
  tenantId: string;
  occurredAt: Date;
  eventType: string;
  payload: Record<string, any>;
}

export interface IDomainEventBus {
  publish(event: DomainEvent): Promise<void>;
}

/** WO-GL-005: Single account line for trial balance / balance sheet (per entity). */
export interface TrialBalanceAccount {
  accountCode: string;
  accountName?: string;
  /** Signed balance in smallest unit (cents): positive = debit balance, negative = credit. */
  balanceCents: number;
  currency: string;
}

export interface ITrialBalanceRepository {
  getTrialBalance(
    tenantId: string,
    entityId: string,
    asOfDate: Date
  ): Promise<TrialBalanceAccount[]>;
}

export interface IEntityRepository {
  findById(tenantId: string, entityId: string): Promise<Entity | null>;
  findSubsidiaries(tenantId: string, parentEntityId: string): Promise<Entity[]>;
}

/**
 * Converts amounts between currencies at a given date.
 * Throws if no conversion rate is available (caller must handle).
 */
export interface ICurrencyConverter {
  convert(amount: Money, toCurrency: Currency, asOfDate: Date): Promise<Money>;
}
