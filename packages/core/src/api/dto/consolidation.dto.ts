/**
 * WO-GL-005: Multi-Entity Consolidation Service
 * DTOs for consolidated balance sheet query and result.
 */

import type { ConsolidationMethod } from '../../domain/entities/entity';

/** Input for consolidated balance sheet request. */
export interface GetConsolidatedBalanceSheetQuery {
  tenantId: string;
  parentEntityId: string;
  asOfDate: Date;
  subsidiaryEntityIds?: string[];
}

/** Single line on the consolidated balance sheet. */
export interface ConsolidatedBalanceSheetLineDto {
  accountCode: string;
  accountName?: string;
  amountCents: number;
  currency: string;
  /** Account type for balance check: Asset | Liability | Equity. */
  accountType?: string;
  /** Non-controlling interest portion (Full method only). Present when > 0. */
  nciCents?: number;
}

/** Result of consolidated balance sheet calculation. */
export interface ConsolidatedBalanceSheetResultDto {
  parentEntityId: string;
  asOfDate: string;
  currency: string;
  consolidationMethod: ConsolidationMethod;
  lines: ConsolidatedBalanceSheetLineDto[];
  /** Total NCI in cents (Full consolidation only). */
  totalNciCents?: number;
  /** True when Assets = Liabilities + (Controlling Equity + NCI). */
  isBalanced?: boolean;
}
