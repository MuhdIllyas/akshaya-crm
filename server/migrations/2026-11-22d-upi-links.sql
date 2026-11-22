-- Linking UPI payments (upi_credits) to the service payments staff entered.
--
-- One save (single entry, quick service or a bulk cart) writes one payment row
-- per service per wallet, all with the same created_at. A link says "this much
-- of this UPI payment covers this much of this payment row", so:
--   one GPay ₹2200  → passport ₹2000 row + PAN ₹200 row   (one credit, two rows)
--   ₹1000 + ₹1200   → one ₹2200 row                       (two credits, one row)
-- Run after 2026-11-22c. Safe to run more than once.

CREATE TABLE IF NOT EXISTS upi_credit_links (
  id          BIGSERIAL PRIMARY KEY,
  credit_id   BIGINT NOT NULL REFERENCES upi_credits(id) ON DELETE CASCADE,
  payment_id  INTEGER NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  amount      NUMERIC(12,2) NOT NULL,
  linked_by   INTEGER,                        -- staff id for a manual link, NULL = automatic
  linked_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS upi_credit_links_credit_idx ON upi_credit_links (credit_id);
CREATE INDEX IF NOT EXISTS upi_credit_links_payment_idx ON upi_credit_links (payment_id);

-- Set when someone unlinks a payment by hand, so the automatic matcher does
-- not put the same link straight back. Linking it by hand clears it.
ALTER TABLE upi_credits ADD COLUMN IF NOT EXISTS no_auto BOOLEAN NOT NULL DEFAULT FALSE;
