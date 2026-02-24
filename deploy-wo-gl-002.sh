
#!/bin/bash

# =============================================================================
# WO-GL-002: Domain Layer Generator Script
# Generates all TypeScript domain classes for General Ledger
# =============================================================================

set -e  # Exit on any error

echo "🚀 Deploying WO-GL-002: Bitemporal Logic & Domain Services"
echo "=============================================================="

# Create directory structure
echo "📁 Creating directory structure..."
mkdir -p packages/core/src/domain/value-objects
mkdir -p packages/core/src/domain/entities  
mkdir -p packages/core/src/domain/services

# =============================================================================
# File 1: Money.ts - High-Precision Currency Value Object
# =============================================================================

echo "💰 Creating Money.ts..."
cat > packages/core/src/domain/value-objects/money.ts << 'EOF'
/**
 * WO-GL-002: Money Value Object
 * High-precision currency handling using BigInt to eliminate floating-point errors
 * Part of General Ledger Domain Layer - Hexagonal Architecture
 */

export type Currency = 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD' | 'JPY' | 'CHF' | 'CNY';

export class Money {
  private constructor(
    private readonly amountInSmallestUnit: bigint,
    public readonly currency: Currency
  ) {
    Object.freeze(this);
  }

  /**
   * Create Money from cents (or smallest currency unit)
   */
  static fromCents(cents: number | bigint, currency: Currency): Money {
    const bigintCents = typeof cents === 'number' ? BigInt(Math.round(cents)) : cents;
    
    if (bigintCents < 0n) {
      throw new Error(`Money amount cannot be negative: ${bigintCents}`);
    }
    
    return new Money(bigintCents, currency);
  }

  /**
   * Create Money from decimal amount (e.g., 123.45)
   */
  static fromDecimal(amount: number, currency: Currency): Money {
    if (amount < 0) {
      throw new Error(`Money amount cannot be negative: ${amount}`);
    }
    
    if (!Number.isFinite(amount)) {
      throw new Error(`Money amount must be finite: ${amount}`);
    }
    
    const cents = Math.round(amount * 100);
    return new Money(BigInt(cents), currency);
  }

  /**
   * Create zero money
   */
  static zero(currency: Currency): Money {
    return new Money(0n, currency);
  }

  /**
   * Add another Money amount
   */
  add(other: Money): Money {
    this.validateSameCurrency(other);
    return new Money(
      this.amountInSmallestUnit + other.amountInSmallestUnit,
      this.currency
    );
  }

  /**
   * Subtract another Money amount
   */
  subtract(other: Money): Money {
    this.validateSameCurrency(other);
    const result = this.amountInSmallestUnit - other.amountInSmallestUnit;
    
    if (result < 0n) {
      throw new Error(
        `Subtraction would result in negative amount: ${this.toString()} - ${other.toString()}`
      );
    }
    
    return new Money(result, this.currency);
  }

  /**
   * Create negative amount (for reversing entries)
   */
  negate(): Money {
    return new Money(-this.amountInSmallestUnit, this.currency);
  }

  /**
   * Check if amount is zero
   */
  isZero(): boolean {
    return this.amountInSmallestUnit === 0n;
  }

  /**
   * Check if amount is positive
   */
  isPositive(): boolean {
    return this.amountInSmallestUnit > 0n;
  }

  /**
   * Check if amount is negative
   */
  isNegative(): boolean {
    return this.amountInSmallestUnit < 0n;
  }

  /**
   * Compare with another Money amount
   */
  equals(other: Money): boolean {
    return this.currency === other.currency &&
           this.amountInSmallestUnit === other.amountInSmallestUnit;
  }

  /**
   * Get amount in cents
   */
  toCents(): number {
    return Number(this.amountInSmallestUnit);
  }

  /**
   * Get amount as decimal
   */
  toDecimal(): number {
    return Number(this.amountInSmallestUnit) / 100;
  }

  /**
   * Format as string for display
   */
  toString(): string {
    const decimal = this.toDecimal();
    return `${this.currency} ${decimal.toFixed(2)}`;
  }

  /**
   * Convert to JSON (for serialization)
   */
  toJSON(): { amountInCents: number; currency: Currency } {
    return {
      amountInCents: this.toCents(),
      currency: this.currency
    };
  }

  /**
   * Create from JSON
   */
  static fromJSON(json: { amountInCents: number; currency: Currency }): Money {
    return Money.fromCents(json.amountInCents, json.currency);
  }

  private validateSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new Error(
        `Cannot perform operation on different currencies: ${this.currency} and ${other.currency}`
      );
    }
  }
}
EOF

# =============================================================================
# File 2: Account.ts - Chart of Accounts Entity
# =============================================================================

echo "📊 Creating Account.ts..."
cat > packages/core/src/domain/entities/account.ts << 'EOF'
/**
 * WO-GL-002: Account Entity
 * Represents a Chart of Accounts entry with hierarchical support
 * Part of General Ledger Domain Layer - Hexagonal Architecture
 */

export type AccountType = 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';
export type NormalBalance = 'Debit' | 'Credit';
export type UUID = string;
export type TenantId = UUID;

export interface AccountProps {
  id?: UUID;
  tenantId: TenantId;
  code: string;
  name: string;
  accountType: AccountType;
  normalBalance: NormalBalance;
  parentAccountId?: UUID;
  isSystemControlled?: boolean;
  allowsIntercompany?: boolean;
  requiredApprovalAboveCents?: number;
  defaultCostCenter?: string;
  defaultProjectId?: UUID;
  taxCategory?: string;
  externalMapping?: Record<string, string>;
  createdBy: UUID;
  deletedAt?: Date;
}

export class Account {
  public readonly id: UUID;
  public readonly tenantId: TenantId;
  public readonly code: string;
  public readonly name: string;
  public readonly accountType: AccountType;
  public readonly normalBalance: NormalBalance;
  public readonly parentAccountId?: UUID;
  public readonly isSystemControlled: boolean;
  public readonly allowsIntercompany: boolean;
  public readonly requiredApprovalAboveCents?: number;
  public readonly defaultCostCenter?: string;
  public readonly defaultProjectId?: UUID;
  public readonly taxCategory?: string;
  public readonly externalMapping: Record<string, string>;
  public readonly createdBy: UUID;
  public readonly deletedAt?: Date;

  constructor(props: AccountProps) {
    this.id = props.id || crypto.randomUUID();
    this.tenantId = props.tenantId;
    this.code = props.code;
    this.name = props.name;
    this.accountType = props.accountType;
    this.normalBalance = props.normalBalance;
    this.parentAccountId = props.parentAccountId;
    this.isSystemControlled = props.isSystemControlled || false;
    this.allowsIntercompany = props.allowsIntercompany || false;
    this.requiredApprovalAboveCents = props.requiredApprovalAboveCents;
    this.defaultCostCenter = props.defaultCostCenter;
    this.defaultProjectId = props.defaultProjectId;
    this.taxCategory = props.taxCategory;
    this.externalMapping = props.externalMapping || {};
    this.createdBy = props.createdBy;
    this.deletedAt = props.deletedAt;

    this.validate();
    Object.freeze(this);
  }

  /**
   * Check if account is active (not deleted)
   */
  isActive(): boolean {
    return this.deletedAt === undefined;
  }

  /**
   * Validate normal balance matches account type conventions
   */
  hasCorrectNormalBalance(): boolean {
    const debitTypes: AccountType[] = ['Asset', 'Expense'];
    const creditTypes: AccountType[] = ['Liability', 'Equity', 'Revenue'];
    
    if (debitTypes.includes(this.accountType)) {
      return this.normalBalance === 'Debit';
    }
    
    if (creditTypes.includes(this.accountType)) {
      return this.normalBalance === 'Credit';
    }
    
    return false;
  }

  /**
   * Convert to plain object for persistence
   */
  toProps(): AccountProps {
    return {
      id: this.id,
      tenantId: this.tenantId,
      code: this.code,
      name: this.name,
      accountType: this.accountType,
      normalBalance: this.normalBalance,
      parentAccountId: this.parentAccountId,
      isSystemControlled: this.isSystemControlled,
      allowsIntercompany: this.allowsIntercompany,
      requiredApprovalAboveCents: this.requiredApprovalAboveCents,
      defaultCostCenter: this.defaultCostCenter,
      defaultProjectId: this.defaultProjectId,
      taxCategory: this.taxCategory,
      externalMapping: this.externalMapping,
      createdBy: this.createdBy,
      deletedAt: this.deletedAt
    };
  }

  private validate(): void {
    if (!this.code.trim()) {
      throw new Error('Account code is required');
    }

    if (!this.name.trim()) {
      throw new Error('Account name is required');
    }

    if (!this.hasCorrectNormalBalance()) {
      throw new Error(
        `Account type ${this.accountType} should have ${
          ['Asset', 'Expense'].includes(this.accountType) ? 'Debit' : 'Credit'
        } normal balance, but has ${this.normalBalance}`
      );
    }
  }
}
EOF

# =============================================================================
# File 3: JournalEntryLine.ts
# =============================================================================

echo "📝 Creating JournalEntryLine.ts..."
cat > packages/core/src/domain/entities/journal-entry-line.ts << 'EOF'
/**
 * WO-GL-002: Journal Entry Line Entity
 * Individual debit/credit line within a journal entry
 * Part of General Ledger Domain Layer - Hexagonal Architecture
 */

import { Money } from '../value-objects/money.js';
import { UUID } from './account.js';

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
      description: this.description
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
EOF

# =============================================================================
# File 4: JournalEntry.ts - Core Entity with Double-Entry Validation
# =============================================================================

echo "🧾 Creating JournalEntry.ts..."
cat > packages/core/src/domain/entities/journal-entry.ts << 'EOF'
/**
 * WO-GL-002: Journal Entry Entity with Strict Double-Entry Validation
 * Core entity that enforces accounting equation balance
 * Part of General Ledger Domain Layer - Hexagonal Architecture
 */

import { Money } from '../value-objects/money.js';
import { JournalEntryLine } from './journal-entry-line.js';
import { UUID, TenantId } from './account.js';

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
EOF

# =============================================================================
# File 5: TemporalBalance.ts
# =============================================================================

echo "⏱️  Creating TemporalBalance.ts..."
cat > packages/core/src/domain/entities/temporal-balance.ts << 'EOF'
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
EOF

# =============================================================================
# File 6: TemporalBalanceService.ts
# =============================================================================

echo "⚙️  Creating TemporalBalanceService.ts..."
cat > packages/core/src/domain/services/temporal-balance.service.ts << 'EOF'
/**
 * WO-GL-002: Temporal Balance Service for Historical Queries
 * Business logic for managing bitemporal account balances
 * Part of General Ledger Domain Layer - Hexagonal Architecture
 */

import { Money } from '../value-objects/money.js';
import { JournalEntry } from '../entities/journal-entry.js';
import { TemporalBalance } from '../entities/temporal-balance.js';
import { TenantId, UUID } from '../entities/account.js';

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
EOF

# =============================================================================
# Create index file for easy imports
# =============================================================================

echo "📦 Creating domain index.ts..."
cat > packages/core/src/domain/index.ts << 'EOF'
/**
 * WO-GL-002: Domain Layer Exports
 * Central export point for all domain entities, value objects, and services
 */

// Value Objects
export { Money, Currency } from './value-objects/money.js';

// Entities
export { 
  Account, 
  AccountType, 
  NormalBalance, 
  UUID, 
  TenantId,
  AccountProps 
} from './entities/account.js';

export { 
  JournalEntryLine, 
  JournalEntryLineProps 
} from './entities/journal-entry-line.js';

export { 
  JournalEntry, 
  JournalEntryProps,
  UnbalancedEntryError,
  EntityId 
} from './entities/journal-entry.js';

export { 
  TemporalBalance, 
  TemporalBalanceProps 
} from './entities/temporal-balance.js';

// Services
export { 
  TemporalBalanceService, 
  ITemporalBalanceRepository 
} from './services/temporal-balance.service.js';
EOF

# =============================================================================
# Git operations (optional)
# =============================================================================

echo ""
echo "✅ Successfully created all domain classes!"
echo ""
echo "📂 Generated files:"
echo "   📁 packages/core/src/domain/"
echo "   ├── 💰 value-objects/money.ts"
echo "   ├── 📊 entities/account.ts"
echo "   ├── 📝 entities/journal-entry-line.ts"
echo "   ├── 🧾 entities/journal-entry.ts"
echo "   ├── ⏱️  entities/temporal-balance.ts"
echo "   ├── ⚙️  services/temporal-balance.service.ts"
echo "   └── 📦 index.ts"
echo ""

# Ask user if they want to commit
read -p "🔄 Do you want to commit these changes to git? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "📝 Adding files to git..."
    git add packages/core/src/domain/
    
    echo "💾 Committing changes..."
    git commit -m "feat(GL): Complete WO-GL-002 - Bitemporal Logic & Domain Services

- Implement Money value object with high-precision BigInt arithmetic
- Create Account entity with hierarchical support and validation
- Add JournalEntryLine with strict debit/credit validation
- Implement JournalEntry with mandatory double-entry balance validation
- Create TemporalBalance entity for bitemporal tracking
- Add TemporalBalanceService with historical query capabilities
- All classes follow Hexagonal Architecture principles
- Full TypeScript typing with comprehensive business rule validation

Resolves: WO-GL-002"
    
    echo "🚀 Pushing to remote repository..."
    git push origin main
    
    echo ""
    echo "✅ WO-GL-002 successfully deployed and committed!"
else
    echo "⏭️  Files created but not committed. You can commit manually later."
fi

echo ""
echo "🎉 WO-GL-002 Domain Layer Implementation Complete!"
echo "Ready to proceed with WO-GL-003: CreateJournalEntryCommand Handler"
echo ""


