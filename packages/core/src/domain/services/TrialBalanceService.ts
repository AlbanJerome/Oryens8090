/**
 * WO-GL-012: Trial Balance Service
 * Calculates Opening Balance (sum of entries before period) and Net Movement (sum within period).
 * Ensures Total Debits === Total Credits or throws UnbalancedLedgerError.
 */

/** Input line per account: opening and period movement in cents. */
export interface TrialBalanceDataLine {
  accountCode: string;
  accountName?: string;
  currency: string;
  openingDebitCents: number;
  openingCreditCents: number;
  periodDebitCents: number;
  periodCreditCents: number;
}

/** WO-GL-012: Trial balance report totals (debits vs credits) do not match. */
export class UnbalancedLedgerError extends Error {
  constructor(
    public readonly totalDebitCents: number,
    public readonly totalCreditCents: number
  ) {
    super(
      `Trial balance is unbalanced: total debits (${totalDebitCents}) do not equal total credits (${totalCreditCents})`
    );
    this.name = 'UnbalancedLedgerError';
  }
}

/** One line in the trial balance report. */
export interface TrialBalanceReportLine {
  accountCode: string;
  accountName?: string;
  currency: string;
  /** Opening balance: debits - credits before period (signed; positive = net debit). */
  openingBalanceCents: number;
  /** Net movement debits in the period. */
  periodDebitCents: number;
  /** Net movement credits in the period. */
  periodCreditCents: number;
  /** Closing balance: opening + period debits - period credits (signed). */
  closingBalanceCents: number;
}

export interface TrialBalanceReport {
  periodStart: Date;
  periodEnd: Date;
  lines: TrialBalanceReportLine[];
  totalDebitCents: number;
  totalCreditCents: number;
}

export class TrialBalanceService {
  /**
   * Builds a trial balance report from per-account data.
   * Opening Balance = sum of entries before period; Net Movement = sum within period.
   * Throws UnbalancedLedgerError if total debits !== total credits.
   */
  buildReport(
    data: TrialBalanceDataLine[],
    periodStart: Date,
    periodEnd: Date
  ): TrialBalanceReport {
    const lines: TrialBalanceReportLine[] = data.map((row) => {
      const openingBalanceCents = row.openingDebitCents - row.openingCreditCents;
      const closingBalanceCents =
        openingBalanceCents + row.periodDebitCents - row.periodCreditCents;
      return {
        accountCode: row.accountCode,
        accountName: row.accountName,
        currency: row.currency,
        openingBalanceCents,
        periodDebitCents: row.periodDebitCents,
        periodCreditCents: row.periodCreditCents,
        closingBalanceCents
      };
    });

    // Trial balance: total of debit column === total of credit column (each line is one or the other)
    const totalDebitCents = lines.reduce(
      (sum, line) => sum + (line.closingBalanceCents > 0 ? line.closingBalanceCents : 0),
      0
    );
    const totalCreditCents = lines.reduce(
      (sum, line) =>
        sum + (line.closingBalanceCents < 0 ? -line.closingBalanceCents : 0),
      0
    );

    if (totalDebitCents !== totalCreditCents) {
      throw new UnbalancedLedgerError(totalDebitCents, totalCreditCents);
    }

    return {
      periodStart,
      periodEnd,
      lines,
      totalDebitCents,
      totalCreditCents
    };
  }
}
