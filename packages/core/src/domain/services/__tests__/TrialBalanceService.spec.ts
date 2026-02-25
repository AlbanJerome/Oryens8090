/**
 * WO-GL-012: Trial Balance Service – Ultimate Assertion
 * Total Debits === Total Credits; otherwise UnbalancedLedgerError.
 */

import { describe, it, expect } from 'vitest';
import {
  TrialBalanceService,
  UnbalancedLedgerError,
  type TrialBalanceDataLine
} from '../TrialBalanceService';

function line(
  accountCode: string,
  openingDebit: number,
  openingCredit: number,
  periodDebit: number,
  periodCredit: number,
  currency = 'USD'
): TrialBalanceDataLine {
  return {
    accountCode,
    currency,
    openingDebitCents: openingDebit,
    openingCreditCents: openingCredit,
    periodDebitCents: periodDebit,
    periodCreditCents: periodCredit
  };
}

describe('TrialBalanceService', () => {
  const periodStart = new Date('2024-01-01');
  const periodEnd = new Date('2024-01-31');
  const service = new TrialBalanceService();

  it('returns report when Total Debits === Total Credits (balanced)', () => {
    // Two accounts: 1000 debits 100, 4000 credits 100 (double-entry)
    const data: TrialBalanceDataLine[] = [
      line('1000-CASH', 0, 0, 10000, 0),
      line('4000-REV', 0, 0, 0, 10000)
    ];
    const report = service.buildReport(data, periodStart, periodEnd);
    expect(report.totalDebitCents).toBe(10000);
    expect(report.totalCreditCents).toBe(10000);
    expect(report.totalDebitCents).toBe(report.totalCreditCents);
    expect(report.lines).toHaveLength(2);
  });

  it('throws UnbalancedLedgerError when Total Debits !== Total Credits', () => {
    const data: TrialBalanceDataLine[] = [
      line('1000-CASH', 0, 0, 10000, 0),
      line('4000-REV', 0, 0, 0, 5000) // credits 5000 only -> unbalanced
    ];
    expect(() => service.buildReport(data, periodStart, periodEnd)).toThrow(
      UnbalancedLedgerError
    );
    try {
      service.buildReport(data, periodStart, periodEnd);
    } catch (e) {
      expect(e).toBeInstanceOf(UnbalancedLedgerError);
      expect((e as UnbalancedLedgerError).totalDebitCents).toBe(10000);
      expect((e as UnbalancedLedgerError).totalCreditCents).toBe(5000);
    }
  });

  it('calculates Opening Balance and Net Movement per line', () => {
    const data: TrialBalanceDataLine[] = [
      line('1000-CASH', 5000, 0, 10000, 2000), // opening 5k debit, period +10k -2k -> closing 13k debit
      line('2000-LIAB', 0, 0, 0, 13000)        // closing 13k credit (balanced)
    ];
    const report = service.buildReport(data, periodStart, periodEnd);
    expect(report.lines[0].openingBalanceCents).toBe(5000);
    expect(report.lines[0].periodDebitCents).toBe(10000);
    expect(report.lines[0].periodCreditCents).toBe(2000);
    expect(report.lines[0].closingBalanceCents).toBe(5000 + 10000 - 2000); // 13000
    expect(report.totalDebitCents).toBe(13000);
    expect(report.totalCreditCents).toBe(13000);
  });
});
