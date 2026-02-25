/**
 * WO-GL-002: Journal Entry Entity with Strict Double-Entry Validation
 * Core entity that enforces accounting equation balance
 * Part of General Ledger Domain Layer - Hexagonal Architecture
 */

import { Money } from '../value-objects/money';
import { JournalEntryLine } from './journal-entry-line';
import { UUID, TenantId } from './account';

export type EntityId = UUID;

export class UnbalancedEntryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnbalancedEntryError';
  }
}

export interface JournalEntryProps {
  id?: UUID;
  tenantId: TenantId;
  entityId: EntityId;
  postingDate: Date;
  sourceModule: string;
  sourceDocumentId: UUID;
  sourceDocumentType: string;
  description: string;
  lines: JournalEntryLine[];
  isIntercompany?: boolean;
  counterpartyEntityId?: EntityId;
  validTimeStart?: Date;
  reversalOf?: UUID;
  version?: number;
  createdBy?: UUID;
  approvedBy?: UUID;
  approvedAt?: Date;
}

export class JournalEntry {
  public readonly id: UUID;
  public readonly tenantId: TenantId;
  public readonly entityId: EntityId;
  public readonly postingDate: Date;
  public readonly sourceModule: string;
  public readonly sourceDocumentId: UUID;
  public readonly sourceDocumentType: string;
  public readonly description: string;
  public readonly lines: readonly JournalEntryLine[];
  public readonly isIntercompany: boolean;
  public readonly counterpartyEntityId?: EntityId;
  public readonly validTimeStart: Date;
  public readonly reversalOf?: UUID;
  public readonly version: number;
  public readonly createdBy?: UUID;
  public readonly approvedBy?: UUID;
  public readonly approvedAt?: Date;

  private constructor(props: JournalEntryProps) {
    this.id = props.id || crypto.randomUUID();
    this.tenantId = props.tenantId;
    this.entityId = props.entityId;
    this.postingDate = props.postingDate;
    this.sourceModule = props.sourceModule;
    this.sourceDocumentId = props.sourceDocumentId;
    this.sourceDocumentType = props.sourceDocumentType;
    this.description = props.description;
    this.lines = Object.freeze([...props.lines]);
    this.isIntercompany = props.isIntercompany || false;
    this.counterpartyEntityId = props.counterpartyEntityId;
    this.validTimeStart = props.validTimeStart || props.postingDate;
    this.reversalOf = props.reversalOf;
    this.version = props.version || 1;
    this.createdBy = props.createdBy;
    this.approvedBy = props.approvedBy;
    this.approvedAt = props.approvedAt;

    Object.freeze(this);
  }

  /**
   * Factory method with comprehensive validation
   * CRITICAL: This is the only way to create a JournalEntry
   */
  static create(props: JournalEntryProps): JournalEntry {
    // Basic validation
    if (props.lines.length < 2) {
      throw new Error('Journal entry must have at least 2 lines');
    }

    // CRITICAL: Validate double-entry balance BEFORE object creation
    JournalEntry.validateDoubleEntryBalance(props.lines);

    // Validate intercompany constraint
    if (props.isIntercompany && !props.counterpartyEntityId) {
      throw new Error('Intercompany entries must have counterpartyEntityId');
    }

    return new JournalEntry(props);
  }

  /**
   * Get total debits
   */
  getTotalDebits(): Money {
    const currency = this.lines[0].debitAmount.currency;
    return this.lines.reduce(
      (sum, line) => sum.add(line.debitAmount),
      Money.zero(currency)
    );
  }

  /**
   * Get total credits
   */
  getTotalCredits(): Money {
    const currency = this.lines[0].creditAmount.currency;
    return this.lines.reduce(
      (sum, line) => sum.add(line.creditAmount),
      Money.zero(currency)
    );
  }

  /**
   * Check if entry is balanced (should always be true for valid entries)
   */
  isBalanced(): boolean {
    try {
      JournalEntry.validateDoubleEntryBalance(this.lines);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get accounts affected by this entry
   */
  getAffectedAccountCodes(): string[] {
    return [...new Set(this.lines.map(line => line.accountCode))];
  }

  /**
   * CRITICAL VALIDATION: Enforce double-entry accounting equation
   * This is the core business rule that must NEVER be violated
   */
  private static validateDoubleEntryBalance(lines: JournalEntryLine[]): void {
    if (lines.length === 0) {
      throw new UnbalancedEntryError('Journal entry cannot be empty');
    }

    // Get currency from first line
    const currency = lines[0].debitAmount.currency;

    // Validate all lines use same currency
    for (const line of lines) {
      if (line.debitAmount.currency !== currency || line.creditAmount.currency !== currency) {
        throw new UnbalancedEntryError('All journal entry lines must use the same currency');
      }
    }

    // Calculate totals
    const totalDebits = lines.reduce(
      (sum, line) => sum.add(line.debitAmount),
      Money.zero(currency)
    );

    const totalCredits = lines.reduce(
      (sum, line) => sum.add(line.creditAmount),
      Money.zero(currency)
    );

    // CRITICAL: Debits must exactly equal credits
    if (!totalDebits.equals(totalCredits)) {
      throw new UnbalancedEntryError(
        `Journal entry violates double-entry principle. ` +
        `Total debits: ${totalDebits.toString()}, ` +
        `Total credits: ${totalCredits.toString()}`
      );
    }
  }
}
