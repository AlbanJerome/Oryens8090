/**
 * WO-GL-002: Account Entity
 * Represents a Chart of Accounts entry with hierarchical support
 * Part of General Ledger Domain Layer - Hexagonal Architecture
 */

/** Enum of account types with capitalized values for consistent comparison. */
export enum AccountTypeEnum {
  Asset = 'Asset',
  Liability = 'Liability',
  Equity = 'Equity',
  Revenue = 'Revenue',
  Expense = 'Expense',
}

export type AccountType = 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';

/** Type guard: case-insensitive check that type is Asset (e.g. 'asset', 'Asset', 'ASSET'). */
export function isAsset(type: string): type is typeof AccountTypeEnum.Asset {
  return type != null && String(type).toLowerCase() === AccountTypeEnum.Asset.toLowerCase();
}

/** Type guard: case-insensitive check that type is Liability. */
export function isLiability(type: string): type is typeof AccountTypeEnum.Liability {
  return type != null && String(type).toLowerCase() === AccountTypeEnum.Liability.toLowerCase();
}

/** Type guard: case-insensitive check that type is Equity. */
export function isEquity(type: string): type is typeof AccountTypeEnum.Equity {
  return type != null && String(type).toLowerCase() === AccountTypeEnum.Equity.toLowerCase();
}
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
