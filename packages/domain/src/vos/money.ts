/**
 * Monetary amount skeleton (currency + amount as integers/cents later).
 * No validation rules in S0 — structure only.
 */
export class Money {
  readonly amount: string;
  readonly currency: string;

  private constructor(amount: string, currency: string) {
    this.amount = amount;
    this.currency = currency;
  }

  static create(amount: string, currency: string): Money {
    return new Money(amount, currency);
  }
}
