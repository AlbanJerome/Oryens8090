/**
 * WO-GL-008: General Ledger API Endpoints
 * DTOs for Account API responses
 */

import type {
  Account,
  AccountType,
  NormalBalance
} from '../../domain/entities/account.js';

/**
 * Account response DTO. Maps from Account entity for API responses.
 */
export interface AccountDto {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  accountType: AccountType;
  normalBalance: NormalBalance;
  parentAccountId?: string;
  isSystemControlled: boolean;
  allowsIntercompany: boolean;
  requiredApprovalAboveCents?: number;
  defaultCostCenter?: string;
  defaultProjectId?: string;
  taxCategory?: string;
  externalMapping: Record<string, string>;
  createdBy: string;
  deletedAt?: string; // ISO date string when present
}

/**
 * Balance response DTO. Used for getBalanceAt and getAuditBalanceAt endpoints.
 */
export interface AccountBalanceDto {
  accountId: string;
  amountCents: number;
  currency: string;
  validTime: string; // ISO date string
  transactionTime?: string; // ISO date string, present for audit balance
}

/**
 * Map Account entity to AccountDto for API responses.
 */
export function toAccountDto(account: Account): AccountDto {
  return {
    id: account.id,
    tenantId: account.tenantId,
    code: account.code,
    name: account.name,
    accountType: account.accountType,
    normalBalance: account.normalBalance,
    parentAccountId: account.parentAccountId,
    isSystemControlled: account.isSystemControlled,
    allowsIntercompany: account.allowsIntercompany,
    requiredApprovalAboveCents: account.requiredApprovalAboveCents,
    defaultCostCenter: account.defaultCostCenter,
    defaultProjectId: account.defaultProjectId,
    taxCategory: account.taxCategory,
    externalMapping: account.externalMapping,
    createdBy: account.createdBy,
    deletedAt: account.deletedAt?.toISOString()
  };
}
