/**
 * WO-GL-002: Journal Entry Line Entity
 * Individual debit/credit line within a journal entry
 * Part of General Ledger Domain Layer - Hexagonal Architecture
 */

import { Money } from '../value-objects/money';
import { UUID } from './account';

/** Global Scale: optional metadata stored in JSONB. */
export type JournalEntryLineMetadata = Record<string, string | number | boolean>;

/** Triple-Entry: amount in original transaction currency (smallest unit). */
export interface JournalEntryLineProps {
  id?: UUID;
  entryId: UUID;
  accountCode: string;
  debitAmount: Money;
  creditAmount: Money;
  costCenter?: string;
  projectId?: UUID;
  intercompanyPartnerId?: UUID;
  eliminationAccountCode?: string;
  description?: string;
  metadata?: JournalEntryLineMetadata;
  /** Multi-currency: amount in original currency (smallest unit, e.g. yen for JPY). */
  transactionAmountCents?: number;
  /** Multi-currency: original currency code (e.g. JPY). */
  transactionCurrencyCode?: string;
  /** Multi-currency: rate at posting (1 transaction unit = exchangeRate reporting units, decimal). */
  exchangeRate?: number;
}

export class JournalEntryLine {
  public readonly id: UUID;
  public readonly entryId: UUID;
  public readonly accountCode: string;
  public readonly debitAmount: Money;
  public readonly creditAmount: Money;
  public readonly costCenter?: string;
  public readonly projectId?: UUID;
  public readonly intercompanyPartnerId?: UUID;
  public readonly eliminationAccountCode?: string;
  public readonly description?: string;
  public readonly metadata?: JournalEntryLineMetadata;
  public readonly transactionAmountCents?: number;
  public readonly transactionCurrencyCode?: string;
  public readonly exchangeRate?: number;

  constructor(props: JournalEntryLineProps) {
    this.id = props.id || crypto.randomUUID();
    this.entryId = props.entryId;
    this.accountCode = props.accountCode;
    this.debitAmount = props.debitAmount;
    this.creditAmount = props.creditAmount;
    this.costCenter = props.costCenter;
    this.projectId = props.projectId;
    this.intercompanyPartnerId = props.intercompanyPartnerId;
    this.eliminationAccountCode = props.eliminationAccountCode;
    this.description = props.description;
    this.metadata = props.metadata ? { ...props.metadata } : undefined;
    this.transactionAmountCents = props.transactionAmountCents;
    this.transactionCurrencyCode = props.transactionCurrencyCode;
    this.exchangeRate = props.exchangeRate;

    this.validate();
    Object.freeze(this);
  }

  /**
   * Check if this is a debit line
   */
  isDebit(): boolean {
    return !this.debitAmount.isZero() && this.creditAmount.isZero();
  }

  /**
   * Check if this is a credit line
   */
  isCredit(): boolean {
    return this.debitAmount.isZero() && !this.creditAmount.isZero();
  }

  /**
   * Get the effective amount (always positive)
   */
  getAmount(): Money {
    return this.isDebit() ? this.debitAmount : this.creditAmount;
  }

  /**
   * Create reversal line (swap debit/credit)
   */
  createReversal(): JournalEntryLine {
    return new JournalEntryLine({
      entryId: this.entryId,
      accountCode: this.accountCode,
      debitAmount: this.creditAmount, // Swap
      creditAmount: this.debitAmount, // Swap
      costCenter: this.costCenter,
      projectId: this.projectId,
      intercompanyPartnerId: this.intercompanyPartnerId,
      eliminationAccountCode: this.eliminationAccountCode,
      description: this.description,
      metadata: this.metadata,
      transactionAmountCents: this.transactionAmountCents,
      transactionCurrencyCode: this.transactionCurrencyCode,
      exchangeRate: this.exchangeRate,
    });
  }

  private validate(): void {
    if (!this.accountCode.trim()) {
      throw new Error('Account code is required');
    }

    // Ensure exactly one of debit or credit is non-zero
    const hasDebit = !this.debitAmount.isZero();
    const hasCredit = !this.creditAmount.isZero();

    if (!hasDebit && !hasCredit) {
      throw new Error('Journal entry line must have either debit or credit amount');
    }

    if (hasDebit && hasCredit) {
      throw new Error('Journal entry line cannot have both debit and credit amounts');
    }

    // Validate currency consistency
    if (this.debitAmount.currency !== this.creditAmount.currency) {
      throw new Error('Debit and credit amounts must use the same currency');
    }
  }
}
