export class JournalEntryError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, any>
  ) {
    super(message);
    this.name = 'JournalEntryError';
  }
}

export class UnbalancedEntryError extends JournalEntryError {
  constructor(message: string) {
    super(message, 'UNBALANCED_ENTRY');
  }
}

export class AccountNotFoundError extends JournalEntryError {
  constructor(accountCode: string, tenantId: string) {
    super(
      `Account '${accountCode}' not found for tenant '${tenantId}'`,
      'ACCOUNT_NOT_FOUND',
      { accountCode, tenantId }
    );
  }
}

export class PeriodClosedError extends JournalEntryError {
  constructor(periodName: string, status: string) {
    super(
      `Cannot post to ${status.toLowerCase()} period '${periodName}'`,
      'PERIOD_CLOSED',
      { periodName, status }
    );
  }
}

export class DuplicateEntryError extends JournalEntryError {
  constructor(idempotencyKey: string, existingEntryId: string) {
    super(
      `Duplicate journal entry with idempotency key '${idempotencyKey}'`,
      'DUPLICATE_ENTRY',
      { idempotencyKey, existingEntryId }
    );
  }
}
