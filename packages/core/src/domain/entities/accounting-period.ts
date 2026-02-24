/**
 * Period Close Workflow: Accounting Period Entity
 * Represents an accounting period with open/closed status for posting control.
 * Part of General Ledger Domain Layer - Hexagonal Architecture
 */

import type { UUID, TenantId } from './account.js';

export type PeriodStatus = 'OPEN' | 'SOFT_CLOSED' | 'HARD_CLOSED';

export interface AccountingPeriodProps {
  id: UUID;
  tenantId: TenantId;
  name: string;
  startDate: Date;
  endDate: Date;
  status: PeriodStatus;
  createdAt?: Date;
  closedAt?: Date;
}

export class AccountingPeriod {
  public readonly id: UUID;
  public readonly tenantId: TenantId;
  public readonly name: string;
  public readonly startDate: Date;
  public readonly endDate: Date;
  public readonly status: PeriodStatus;
  public readonly createdAt: Date;
  public readonly closedAt?: Date;

  constructor(props: AccountingPeriodProps) {
    this.id = props.id;
    this.tenantId = props.tenantId;
    this.name = props.name;
    this.startDate = new Date(props.startDate);
    this.endDate = new Date(props.endDate);
    this.status = props.status;
    this.createdAt = props.createdAt ?? new Date();
    this.closedAt = props.closedAt;

    this.validate();
    Object.freeze(this);
  }

  /** True if no new entries are allowed (SOFT_CLOSED or HARD_CLOSED). */
  isClosed(): boolean {
    return this.status === 'SOFT_CLOSED' || this.status === 'HARD_CLOSED';
  }

  /** True if the given date falls within this period (inclusive). */
  containsDate(date: Date): boolean {
    const d = new Date(date).getTime();
    return d >= this.startDate.getTime() && d <= this.endDate.getTime();
  }

  private validate(): void {
    if (!this.name?.trim()) {
      throw new Error('Accounting period name is required');
    }
    if (this.startDate.getTime() > this.endDate.getTime()) {
      throw new Error('Period startDate must be before or equal to endDate');
    }
    const valid: PeriodStatus[] = ['OPEN', 'SOFT_CLOSED', 'HARD_CLOSED'];
    if (!valid.includes(this.status)) {
      throw new Error(`Invalid period status: ${this.status}`);
    }
  }
}
