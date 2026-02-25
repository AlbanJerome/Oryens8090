-- Multi-Currency Triple-Entry: original transaction amount and rate per line
-- Reporting amount remains debit_amount_cents / credit_amount_cents (reporting currency).

ALTER TABLE journal_entry_lines
  ADD COLUMN IF NOT EXISTS transaction_amount_cents BIGINT,
  ADD COLUMN IF NOT EXISTS transaction_currency_code VARCHAR(8),
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(20, 10);

COMMENT ON COLUMN journal_entry_lines.transaction_amount_cents IS 'Amount in original currency (smallest unit, e.g. yen for JPY, cents for USD)';
COMMENT ON COLUMN journal_entry_lines.transaction_currency_code IS 'Original currency code (e.g. JPY). When NULL, line is in reporting currency only.';
COMMENT ON COLUMN journal_entry_lines.exchange_rate IS 'Rate at posting: 1 unit of transaction_currency = exchange_rate units of reporting currency (decimal, e.g. 0.0067 for 1 JPY = 0.0067 USD)';
