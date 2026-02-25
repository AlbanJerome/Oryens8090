/**
 * WO-GL-002: Money Value Object
 * High-precision currency handling using BigInt to eliminate floating-point errors
 * Part of General Ledger Domain Layer - Hexagonal Architecture
 */

export type Currency = 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD' | 'JPY' | 'CHF' | 'CNY';

export class Money {
  private constructor(
    private readonly amountInSmallestUnit: bigint,
    public readonly currency: Currency
  ) {
    Object.freeze(this);
  }

  /**
   * Create Money from cents (or smallest currency unit)
   */
  static fromCents(cents: number | bigint, currency: Currency): Money {
    const bigintCents = typeof cents === 'number' ? BigInt(Math.round(cents)) : cents;
    
    if (bigintCents < BigInt(0)) {
      throw new Error(`Money amount cannot be negative: ${bigintCents}`);
    }
    
    return new Money(bigintCents, currency);
  }

  /**
   * Create Money from decimal amount (e.g., 123.45)
   */
  static fromDecimal(amount: number, currency: Currency): Money {
    if (amount < 0) {
      throw new Error(`Money amount cannot be negative: ${amount}`);
    }
    
    if (!Number.isFinite(amount)) {
      throw new Error(`Money amount must be finite: ${amount}`);
    }
    
    const cents = Math.round(amount * 100);
    return new Money(BigInt(cents), currency);
  }

  /**
   * Create zero money
   */
  static zero(currency: Currency): Money {
    return new Money(BigInt(0), currency);
  }

  /**
   * Add another Money amount
   */
  add(other: Money): Money {
    this.validateSameCurrency(other);
    return new Money(
      this.amountInSmallestUnit + other.amountInSmallestUnit,
      this.currency
    );
  }

  /**
   * Subtract another Money amount
   */
  subtract(other: Money): Money {
    this.validateSameCurrency(other);
    const result = this.amountInSmallestUnit - other.amountInSmallestUnit;
    
    if (result < BigInt(0)) {
      throw new Error(
        `Subtraction would result in negative amount: ${this.toString()} - ${other.toString()}`
      );
    }
    
    return new Money(result, this.currency);
  }

  /**
   * Create negative amount (for reversing entries)
   */
  negate(): Money {
    return new Money(-this.amountInSmallestUnit, this.currency);
  }

  /**
   * Check if amount is zero
   */
  isZero(): boolean {
    return this.amountInSmallestUnit === BigInt(0);
  }

  /**
   * Check if amount is positive
   */
  isPositive(): boolean {
    return this.amountInSmallestUnit > BigInt(0);
  }

  /**
   * Check if amount is negative
   */
  isNegative(): boolean {
    return this.amountInSmallestUnit < BigInt(0);
  }

  /**
   * Compare with another Money amount
   */
  equals(other: Money): boolean {
    return this.currency === other.currency &&
           this.amountInSmallestUnit === other.amountInSmallestUnit;
  }

  /**
   * Get amount in cents
   */
  toCents(): number {
    return Number(this.amountInSmallestUnit);
  }

  /**
   * Get amount as decimal
   */
  toDecimal(): number {
    return Number(this.amountInSmallestUnit) / 100;
  }

  /**
   * Format as string for display
   */
  toString(): string {
    const decimal = this.toDecimal();
    return `${this.currency} ${decimal.toFixed(2)}`;
  }

  /**
   * Convert to JSON (for serialization)
   */
  toJSON(): { amountInCents: number; currency: Currency } {
    return {
      amountInCents: this.toCents(),
      currency: this.currency
    };
  }

  /**
   * Create from JSON
   */
  static fromJSON(json: { amountInCents: number; currency: Currency }): Money {
    return Money.fromCents(json.amountInCents, json.currency);
  }

  private validateSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new Error(
        `Cannot perform operation on different currencies: ${this.currency} and ${other.currency}`
      );
    }
  }
}
