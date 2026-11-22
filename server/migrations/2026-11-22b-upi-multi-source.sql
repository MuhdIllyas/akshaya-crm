-- A wallet can read UPI payments from more than one place, e.g. an SBI
-- account that gets both SBI QR payments (bank SMS) and GPay QR payments
-- that GPay settles in one lump in the evening (GPay app notifications).
-- Run after 2026-11-22-upi-credits.sql. Safe to run more than once.
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS upi_match_sources TEXT[];

-- Carry over the single setting from the first version
UPDATE wallets
   SET upi_match_sources = ARRAY[upi_match_source]
 WHERE upi_match_source IS NOT NULL
   AND upi_match_sources IS NULL;

CREATE INDEX IF NOT EXISTS wallets_upi_match_sources_idx
  ON wallets USING GIN (upi_match_sources);
