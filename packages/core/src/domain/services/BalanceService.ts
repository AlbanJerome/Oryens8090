/**
 * WO-GL-004: Account Balance Calculation
 * Calculates account balances using BigInt logic from Money
 * Supports valid-time and bitemporal (audit) balance queries
 * Part of General Ledger Domain Layer - Hexagonal Architecture
 */

import { Money, Currency } from '../value-objects/money.js';

/**
 * Minimal line representation for balance calculation (port contract).
 * Infrastructure adapters map from journal entry lines to this type.
 */
export interface BalanceLine {
  debitAmount: Money;
  creditAmount: Money;
}

/**
 * Repository interface (Hexagonal Architecture - Port).
 * Infrastructure layer implements this to provide lines filtered by time.
 */
export interface IBalanceQueryRepository {
  /**
   * Lines that contribute to balance at validTime (posting date ≤ validTime,
   * excluding reversals that are effective after validTime).
   */
  findLinesForBalance(accountId: string, validTime: Date): Promise<BalanceLine[]>;

  /**
   * Lines that contribute to balance as known at transactionTime,
   * for validity at validTime (bitemporal audit query).
   */
  findLinesForAuditBalance(
    accountId: string,
    validTime: Date,
    transactionTime: Date
  ): Promise<BalanceLine[]>;
}

const DEFAULT_CURRENCY: Currency = 'USD';

/**
 * Domain service for account balance calculation.
 * Uses Money (BigInt) for all arithmetic to avoid floating-point errors.
 */
export class BalanceService {
  constructor(private readonly repository: IBalanceQueryRepository) {}

  /**
   * Get account balance at a point in valid time.
   * Sums (debit - credit) for all lines effective at or before validTime.
   */
  async getBalanceAt(
    accountId: string,
    validTime: Date,
    currency: Currency = DEFAULT_CURRENCY
  ): Promise<Money> {
    const lines = await this.repository.findLinesForBalance(accountId, validTime);
    return this.sumLines(lines, currency);
  }

  /**
   * Get audit balance: balance at validTime as it was known at transactionTime.
   * Used for bitemporal reporting and audit trails.
   */
  async getAuditBalanceAt(
    accountId: string,
    validTime: Date,
    transactionTime: Date,
    currency: Currency = DEFAULT_CURRENCY
  ): Promise<Money> {
    const lines = await this.repository.findLinesForAuditBalance(
      accountId,
      validTime,
      transactionTime
    );
    return this.sumLines(lines, currency);
  }

  /**
   * Sum line effects using Money (BigInt). Net per line = debit - credit.
   * Uses first line's currency when present; otherwise default currency.
   */
  private sumLines(lines: BalanceLine[], defaultCurrency: Currency): Money {
    const currency =
      lines.length > 0 ? lines[0].debitAmount.currency : defaultCurrency;
    let sum = Money.zero(currency);
    for (const line of lines) {
      const net = line.debitAmount.add(line.creditAmount.negate());
      sum = sum.add(net);
    }
    return sum;
  }
}
