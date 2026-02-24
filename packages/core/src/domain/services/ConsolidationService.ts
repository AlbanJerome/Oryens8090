/**
 * WO-GL-011: Consolidation Service
 * Handles Full, Proportional, and Equity consolidation methods.
 * Full consolidation correctly calculates Non-Controlling Interest (NCI).
 * Part of General Ledger Domain Layer - Hexagonal Architecture
 */

import { Money } from '../value-objects/money.js';
import type { Entity } from '../entities/entity.js';

/** Result of full consolidation: consolidated amounts plus NCI. */
export interface FullConsolidationResult {
  /** Consolidated amount (parent + 100% of subsidiary). */
  consolidated: Money;
  /** Non-Controlling Interest: (1 - ownership%) × subsidiary amount. */
  nci: Money;
}

/**
 * Consolidation service. All arithmetic uses Money (BigInt) for precision.
 */
export class ConsolidationService {
  /**
   * Full consolidation: combine 100% of parent and subsidiary, then compute NCI.
   * NCI = (1 - ownershipPercentage/100) × subsidiary amount (the share not owned by parent).
   */
  consolidateFull(
    parentAmount: Money,
    subsidiaryAmount: Money,
    entity: Entity
  ): FullConsolidationResult {
    this.validateSameCurrency(parentAmount, subsidiaryAmount);
    const currency = parentAmount.currency;

    const consolidated = parentAmount.add(subsidiaryAmount);
    const nciFraction = entity.getNonControllingInterestShare();
    const nci = this.scaleMoney(subsidiaryAmount, nciFraction);

    return { consolidated, nci };
  }

  /**
   * Proportional consolidation: parent + ownership% of subsidiary only.
   */
  consolidateProportional(
    parentAmount: Money,
    subsidiaryAmount: Money,
    entity: Entity
  ): Money {
    this.validateSameCurrency(parentAmount, subsidiaryAmount);
    const fraction = entity.getOwnershipFraction();
    const subsidiaryShare = this.scaleMoney(subsidiaryAmount, fraction);
    return parentAmount.add(subsidiaryShare);
  }

  /**
   * Equity method: parent only includes its share of subsidiary (ownership% × subsidiary).
   * No 100% line-by-line consolidation; single-line “investment in subsidiary” effect.
   */
  consolidateEquity(
    parentAmount: Money,
    subsidiaryAmount: Money,
    entity: Entity
  ): Money {
    this.validateSameCurrency(parentAmount, subsidiaryAmount);
    const fraction = entity.getOwnershipFraction();
    const share = this.scaleMoney(subsidiaryAmount, fraction);
    return parentAmount.add(share);
  }

  /**
   * Scale a Money amount by a fraction in [0, 1]. Uses cents and rounding; supports negative amounts.
   * Uses Math.abs() before fromCents so we never pass negative values (fromCents rejects them).
   */
  scaleMoney(money: Money, fraction: number): Money {
    const currency = money.currency;
    const cents = money.toCents();
    const scaledCents = Math.round(cents * fraction);
    if (scaledCents >= 0) {
      return Money.fromCents(scaledCents, currency);
    }
    return Money.fromCents(Math.abs(scaledCents), currency).negate();
  }

  private validateSameCurrency(a: Money, b: Money): void {
    if (a.currency !== b.currency) {
      throw new Error(
        `Consolidation requires same currency: ${a.currency} vs ${b.currency}`
      );
    }
  }
}
