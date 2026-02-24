/**
 * WO-GL-008: General Ledger API Endpoints
 * Account API controller. Injects BalanceService and account repository.
 */

import type { Currency } from '../../domain/value-objects/money.js';
import type { BalanceService } from '../../domain/services/BalanceService.js';
import type { IAccountRepository } from '../../application/repositories/interfaces.js';
import {
  toAccountDto,
  type AccountDto,
  type AccountBalanceDto
} from '../dto/AccountDto.js';

/**
 * Account controller for GL API. Use constructor injection for
 * IAccountRepository and BalanceService (e.g. from Nest/Express DI).
 */
export class AccountController {
  constructor(
    private readonly accountRepository: IAccountRepository,
    private readonly balanceService: BalanceService
  ) {}

  /**
   * Get account by tenant and account id. Returns null if not found.
   */
  async getAccount(tenantId: string, accountId: string): Promise<AccountDto | null> {
    const account = await this.accountRepository.findById(tenantId, accountId);
    return account ? toAccountDto(account) : null;
  }

  /**
   * Get account balance at a point in valid time.
   * Uses BalanceService.getBalanceAt (BigInt/Money); returns DTO with amount in cents.
   */
  async getBalanceAt(
    accountId: string,
    validTime: Date,
    currency?: Currency
  ): Promise<AccountBalanceDto> {
    const balance = await this.balanceService.getBalanceAt(
      accountId,
      validTime,
      currency
    );
    return {
      accountId,
      amountCents: balance.toCents(),
      currency: balance.currency,
      validTime: validTime.toISOString()
    };
  }

  /**
   * Get audit balance: balance at validTime as known at transactionTime.
   * Uses BalanceService.getAuditBalanceAt; returns DTO with amount in cents.
   */
  async getAuditBalanceAt(
    accountId: string,
    validTime: Date,
    transactionTime: Date,
    currency?: Currency
  ): Promise<AccountBalanceDto> {
    const balance = await this.balanceService.getAuditBalanceAt(
      accountId,
      validTime,
      transactionTime,
      currency
    );
    return {
      accountId,
      amountCents: balance.toCents(),
      currency: balance.currency,
      validTime: validTime.toISOString(),
      transactionTime: transactionTime.toISOString()
    };
  }
}
