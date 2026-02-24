/**
 * WO-GL-011: Entity (Legal Entity / Subsidiary) for Consolidation
 * Represents a reporting entity with ownership and consolidation method
 * Part of General Ledger Domain Layer - Hexagonal Architecture
 */

import type { UUID, TenantId } from './account.js';

export type ConsolidationMethod = 'Full' | 'Proportional' | 'Equity';

export interface EntityProps {
  id?: UUID;
  tenantId: TenantId;
  name: string;
  parentEntityId?: UUID;
  /** Ownership percentage of the parent (0–100). Used for NCI and proportional consolidation. */
  ownershipPercentage: number;
  /** How this entity is consolidated into the parent. */
  consolidationMethod: ConsolidationMethod;
  currency?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Entity {
  public readonly id: UUID;
  public readonly tenantId: TenantId;
  public readonly name: string;
  public readonly parentEntityId?: UUID;
  public readonly ownershipPercentage: number;
  public readonly consolidationMethod: ConsolidationMethod;
  public readonly currency: string;
  public readonly createdAt: Date;
  public readonly updatedAt?: Date;

  constructor(props: EntityProps) {
    this.id = props.id ?? crypto.randomUUID();
    this.tenantId = props.tenantId;
    this.name = props.name;
    this.parentEntityId = props.parentEntityId;
    this.ownershipPercentage = props.ownershipPercentage;
    this.consolidationMethod = props.consolidationMethod;
    this.currency = props.currency ?? 'USD';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt;

    this.validate();
    Object.freeze(this);
  }

  /** True if consolidated under a parent (subsidiary). */
  isSubsidiary(): boolean {
    return this.parentEntityId != null;
  }

  /** Non-controlling interest share (1 - ownership). Only meaningful for Full consolidation. */
  getNonControllingInterestShare(): number {
    return Math.max(0, 100 - this.ownershipPercentage) / 100;
  }

  /** Parent's ownership as a fraction in [0, 1]. */
  getOwnershipFraction(): number {
    return Math.max(0, Math.min(100, this.ownershipPercentage)) / 100;
  }

  toProps(): EntityProps {
    return {
      id: this.id,
      tenantId: this.tenantId,
      name: this.name,
      parentEntityId: this.parentEntityId,
      ownershipPercentage: this.ownershipPercentage,
      consolidationMethod: this.consolidationMethod,
      currency: this.currency,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  private validate(): void {
    if (!this.name?.trim()) {
      throw new Error('Entity name is required');
    }
    if (
      typeof this.ownershipPercentage !== 'number' ||
      this.ownershipPercentage < 0 ||
      this.ownershipPercentage > 100
    ) {
      throw new Error(
        `ownershipPercentage must be a number between 0 and 100, got: ${this.ownershipPercentage}`
      );
    }
    const validMethods: ConsolidationMethod[] = ['Full', 'Proportional', 'Equity'];
    if (!validMethods.includes(this.consolidationMethod)) {
      throw new Error(
        `consolidationMethod must be one of Full, Proportional, Equity, got: ${this.consolidationMethod}`
      );
    }
  }
}
