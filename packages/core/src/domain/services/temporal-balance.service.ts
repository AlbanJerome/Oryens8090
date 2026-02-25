/**
 * WO-GL-002: Temporal Balance Service for Historical Queries
 * Business logic for managing bitemporal account balances
 * Part of General Ledger Domain Layer - Hexagonal Architecture
 */

import { Money } from '../value-objects/money';
import { JournalEntry } from '../entities/journal-entry';
import { TemporalBalance } from '../entities/temporal-balance';
import { TenantId, UUID } from '../entities/account';

export type EntityId = UUID;

/**
 * Repository interface (Hexagonal Architecture - Port)
 * Infrastructure layer will implement this interface
 */
export interface ITemporalBalanceRepository {
  /**
   * Get current balance (what is true now)
   */
  findCurrentBalance(
    tenantId: TenantId,
    entityId: EntityId,
    accountCode: string
  ): Promise<TemporalBalance | null>;

  /**
   * Get balance as-of past date (what was valid when)
   */
  findHistoricalBalance(
    tenantId: TenantId,
    entityId: EntityId,
    accountCode: string,
    asOfDate: Date
  ): Promise<TemporalBalance | null>;

  /**
   * Get full history (all temporal versions)
   */
  findHistory(
    tenantId: TenantId,
    accountCode: string
  ): Promise<TemporalBalance[]>;

  /**
   * Close current balance and create new one
   */
  updateBalance(
    tenantId: TenantId,
    entityId: EntityId,
    accountCode: string,
    newBalance: Money,
    validTimeStart: Date
  ): Promise<TemporalBalance>;

  /**
   * Save a temporal balance
   */
  save(balance: TemporalBalance): Promise<void>;
}

/**
 * Domain service for temporal balance operations
 * Contains business logic for bitemporal balance management
 */
export class TemporalBalanceService {
  constructor(private repository: ITemporalBalanceRepository) {}

  /**
   * Get current balance for an account
   */
  async getCurrentBalance(
    tenantId: TenantId,
    entityId: EntityId,
    accountCode: string,
    currency: string = 'USD'
  ): Promise<Money> {
    const balance = await this.repository.findCurrentBalance(tenantId, entityId, accountCode);
    return balance?.balance || Money.zero(currency as any);
  }

  /**
   * Get historical balance as it existed at a specific date
   */
  async getHistoricalBalance(
    tenantId: TenantId,
    entityId: EntityId,
    accountCode: string,
    asOfDate: Date,
    currency: string = 'USD'
  ): Promise<Money> {
    const balance = await this.repository.findHistoricalBalance(
      tenantId, entityId, accountCode, asOfDate
    );
    return balance?.balance || Money.zero(currency as any);
  }

  /**
   * Apply a journal entry to update account balances
   * This is called when journal entries are posted
   */
  async applyJournalEntry(
    tenantId: TenantId,
    entityId: EntityId,
    entry: JournalEntry
  ): Promise<void> {
    // Group lines by account code to handle multiple lines for same account
    const accountUpdates = new Map<string, Money>();

    for (const line of entry.lines) {
      const currentNet = accountUpdates.get(line.accountCode) || 
                        Money.zero(line.debitAmount.currency);
      
      // Calculate net effect: debits increase balance, credits decrease
      const lineNet = line.debitAmount.subtract(line.creditAmount);
      accountUpdates.set(line.accountCode, currentNet.add(lineNet));
    }

    // Apply updates to each affected account
    for (const [accountCode, netChange] of accountUpdates) {
      if (!netChange.isZero()) {
        await this.updateAccountBalance(
          tenantId, entityId, accountCode, netChange, entry.postingDate
        );
      }
    }
  }

  /**
   * Get balance history for audit purposes
   */
  async getBalanceHistory(
    tenantId: TenantId,
    accountCode: string
  ): Promise<TemporalBalance[]> {
    return this.repository.findHistory(tenantId, accountCode);
  }

  private async updateAccountBalance(
    tenantId: TenantId,
    entityId: EntityId,
    accountCode: string,
    netChange: Money,
    validTimeStart: Date
  ): Promise<void> {
    // Get current balance
    const currentBalance = await this.getCurrentBalance(
      tenantId, entityId, accountCode, netChange.currency
    );

    // Calculate new balance
    const newBalance = currentBalance.add(netChange);

    // Update balance record
    await this.repository.updateBalance(
      tenantId, entityId, accountCode, newBalance, validTimeStart
    );
  }
}
