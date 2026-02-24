/**
 * WO-GL-005: Multi-Entity Consolidation Service
 * Query and handler for consolidated balance sheet.
 * Entity from domain; TrialBalanceAccount from repository interfaces.
 * NCI calculation uses Map for account lookups; Money uses cents × ownership% then round for precision.
 */

import { Money, type Currency } from '../../domain/value-objects/money.js';
import { Entity } from '../../domain/entities/entity.js';
import { ConsolidationService } from '../../domain/services/ConsolidationService.js';
import type {
  TrialBalanceAccount,
  ITrialBalanceRepository,
  IEntityRepository
} from '../repositories/interfaces.js';
import type {
  GetConsolidatedBalanceSheetQuery,
  ConsolidatedBalanceSheetResultDto,
  ConsolidatedBalanceSheetLineDto
} from '../../api/dto/consolidation.dto.js';

export type { GetConsolidatedBalanceSheetQuery };

/**
 * Builds a Map from accountCode to TrialBalanceAccount for O(1) lookups.
 */
function toAccountMap(
  accounts: TrialBalanceAccount[]
): Map<string, TrialBalanceAccount> {
  const map = new Map<string, TrialBalanceAccount>();
  for (const acc of accounts) {
    map.set(acc.accountCode, acc);
  }
  return map;
}

/**
 * Convert trial balance line to Money. Handles signed balanceCents (positive = debit, negative = credit).
 * Uses Math.abs() before fromCents so we never pass negative values (fromCents rejects them).
 */
function balanceToMoney(acc: TrialBalanceAccount): Money {
  const currency = acc.currency as Currency;
  const cents = acc.balanceCents;
  if (cents >= 0) {
    return Money.fromCents(cents, currency);
  }
  return Money.fromCents(Math.abs(cents), currency).negate();
}

/**
 * Compute subsidiary Net Equity (sum of Equity-type account balances).
 * Equity accounts have credit normal balance, so balanceCents is negative; net equity is -balanceCents.
 */
function subsidiaryNetEquityCents(accountMap: Map<string, TrialBalanceAccount>): number {
  let netEquityCents = 0;
  for (const acc of accountMap.values()) {
    if (acc.accountType === 'Equity') {
      netEquityCents += -acc.balanceCents;
    }
  }
  return netEquityCents;
}

export class GetConsolidatedBalanceSheetQueryHandler {
  constructor(
    private readonly entityRepository: IEntityRepository,
    private readonly trialBalanceRepository: ITrialBalanceRepository,
    private readonly consolidationService: ConsolidationService
  ) {}

  async execute(
    query: GetConsolidatedBalanceSheetQuery
  ): Promise<ConsolidatedBalanceSheetResultDto> {
    const parent = await this.entityRepository.findById(
      query.tenantId,
      query.parentEntityId
    );
    if (!parent) {
      throw new Error(`Parent entity not found: ${query.parentEntityId}`);
    }

    const subsidiaryEntities =
      query.subsidiaryEntityIds != null
        ? await Promise.all(
            query.subsidiaryEntityIds.map((id) =>
              this.entityRepository.findById(query.tenantId, id)
            )
          ).then((list) => list.filter((e): e is Entity => e != null))
        : await this.entityRepository.findSubsidiaries(
            query.tenantId,
            query.parentEntityId
          );

    const parentTb = await this.trialBalanceRepository.getTrialBalance(
      query.tenantId,
      query.parentEntityId,
      query.asOfDate
    );
    const parentMap = toAccountMap(parentTb);
    const currency = (parentTb[0]?.currency ?? 'USD') as Currency;

    const allAccountCodes = new Set<string>(parentMap.keys());
    const subsidiaryData: {
      entity: Entity;
      accountMap: Map<string, TrialBalanceAccount>;
    }[] = [];

    let totalNciCents = 0;

    for (const sub of subsidiaryEntities) {
      const tb = await this.trialBalanceRepository.getTrialBalance(
        query.tenantId,
        sub.id,
        query.asOfDate
      );
      const accountMap = toAccountMap(tb);
      for (const code of accountMap.keys()) allAccountCodes.add(code);

      if (sub.consolidationMethod === 'Full') {
        const netEquityCents = subsidiaryNetEquityCents(accountMap);
        const nciShare = sub.getNonControllingInterestShare();
        totalNciCents += Math.round(nciShare * netEquityCents);
      }

      subsidiaryData.push({ entity: sub, accountMap });
    }

    const lines: ConsolidatedBalanceSheetLineDto[] = [];

    for (const accountCode of allAccountCodes) {
      const parentAcc = parentMap.get(accountCode);
      const parentMoney =
        parentAcc != null ? balanceToMoney(parentAcc) : Money.zero(currency);

      let consolidatedMoney = parentMoney;

      for (const { entity: subEntity, accountMap } of subsidiaryData) {
        const subAcc = accountMap.get(accountCode);
        if (!subAcc) continue;

        const subMoney = balanceToMoney(subAcc);

        if (subEntity.consolidationMethod === 'Full') {
          const result = this.consolidationService.consolidateFull(
            consolidatedMoney,
            subMoney,
            subEntity
          );
          consolidatedMoney = result.consolidated;
        } else if (subEntity.consolidationMethod === 'Proportional') {
          consolidatedMoney =
            this.consolidationService.consolidateProportional(
              consolidatedMoney,
              subMoney,
              subEntity
            );
        } else if (subEntity.consolidationMethod === 'Equity') {
          consolidatedMoney = this.consolidationService.consolidateEquity(
            consolidatedMoney,
            subMoney,
            subEntity
          );
        }
      }

      const amountCents = consolidatedMoney.toCents();
      if (amountCents !== 0) {
        lines.push({
          accountCode,
          accountName: parentAcc?.accountName,
          amountCents,
          currency
        });
      }
    }

    return {
      parentEntityId: query.parentEntityId,
      asOfDate: query.asOfDate.toISOString(),
      currency,
      consolidationMethod: parent.consolidationMethod,
      lines,
      totalNciCents
    };
  }
}
