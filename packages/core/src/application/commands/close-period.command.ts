/**
 * WO-GL-014: Close period command (year-end closing entry).
 */

export interface ClosePeriodCommand {
  tenantId: string;
  entityId: string;
  periodEndDate: Date;
  retainedEarningsAccountCode: string;
  reportingCurrency?: string;
  /** User performing the close (for audit log). */
  closedBy?: string;
}
