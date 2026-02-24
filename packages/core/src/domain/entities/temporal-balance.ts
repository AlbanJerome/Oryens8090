/**
 * WO-GL-002: Temporal Balance Entity for Bitemporal Tracking
 * Maintains account balance history with valid-time and transaction-time dimensions
 * Part of General Ledger Domain Layer - Hexagonal Architecture
 */

import { Money } from '../value-objects/money.js';
import { TenantId, UUID } from './account.js';

export type EntityId = UUID;

export interface TemporalBalanceProps {
  id?: UUID;
  tenantId: TenantId;
  entityId: EntityId;
  accountCode: string;
  balance: Money;
  validTimeStart: Date;
  validTimeEnd?: Date;
  transactionTimeStart?: Date;
  transactionTimeEnd?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export class TemporalBalance {
  public readonly id: UUID;
  public readonly tenantId: TenantId;
  public readonly entityId: EntityId;
  public readonly accountCode: string;
  public readonly balance: Money;
  public readonly validTimeStart: Date;
  public readonly validTimeEnd: Date;
  public readonly transactionTimeStart: Date;
  public readonly transactionTimeEnd: Date;
  public readonly createdAt: Date;
  public readonly updatedAt?: Date;

  // Infinity timestamp for active records
  private static readonly INFINITY_DATE = new Date('9999-12-31T23:59:59.999Z');

  constructor(props: TemporalBalanceProps) {
    this.id = props.id || crypto.randomUUID();
    this.tenantId = props.tenantId;
    this.entityId = props.entityId;
    this.accountCode = props.accountCode;
    this.balance = props.balance;
    this.validTimeStart = props.validTimeStart;
    this.validTimeEnd = props.validTimeEnd || TemporalBalance.INFINITY_DATE;
    this.transactionTimeStart = props.transactionTimeStart || new Date();
    this.transactionTimeEnd = props.transactionTimeEnd || TemporalBalance.INFINITY_DATE;
    this.createdAt = props.createdAt || new Date();
    this.updatedAt = props.updatedAt;

    this.validate();
    Object.freeze(this);
  }

  /**
   * Check if this balance is currently active (valid and recorded)
   */
  isCurrent(): boolean {
    const now = new Date();
    return this.isValidAt(now) && 
           this.transactionTimeEnd.getTime() === TemporalBalance.INFINITY_DATE.getTime() &&
           this.validTimeEnd.getTime() === TemporalBalance.INFINITY_DATE.getTime();
  }

  /**
   * Check if this balance was valid at a specific date
   */
  isValidAt(date: Date): boolean {
    return date >= this.validTimeStart && date <= this.validTimeEnd;
  }

  /**
   * Create a new balance record with updated amount
   */
  updateBalance(newBalance: Money, validTimeStart?: Date): TemporalBalance {
    return new TemporalBalance({
      tenantId: this.tenantId,
      entityId: this.entityId,
      accountCode: this.accountCode,
      balance: newBalance,
      validTimeStart: validTimeStart || new Date(),
      validTimeEnd: TemporalBalance.INFINITY_DATE,
      transactionTimeStart: new Date(),
      transactionTimeEnd: TemporalBalance.INFINITY_DATE
    });
  }

  /**
   * Close this temporal balance by setting end times
   */
  close(validTimeEnd?: Date, transactionTimeEnd?: Date): TemporalBalance {
    return new TemporalBalance({
      id: this.id,
      tenantId: this.tenantId,
      entityId: this.entityId,
      accountCode: this.accountCode,
      balance: this.balance,
      validTimeStart: this.validTimeStart,
      validTimeEnd: validTimeEnd || new Date(),
      transactionTimeStart: this.transactionTimeStart,
      transactionTimeEnd: transactionTimeEnd || new Date(),
      createdAt: this.createdAt,
      updatedAt: new Date()
    });
  }

  private validate(): void {
    if (!this.accountCode.trim()) {
      throw new Error('Account code is required');
    }

    if (this.validTimeStart > this.validTimeEnd) {
      throw new Error('Valid time start must be before valid time end');
    }

    if (this.transactionTimeStart > this.transactionTimeEnd) {
      throw new Error('Transaction time start must be before transaction time end');
    }
  }
}
