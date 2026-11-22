-- UPI payments caught by the companion phone (bank credit SMS or UPI app
-- notifications), so staff can see "₹100 received" and later link it to the
-- service entry.

-- 1. Which wallet a payment belongs to.
--    upi_match_source: where this wallet's payments are read from
--      'sms'     – the bank's credit SMS (SBI QR, GPay QR paying straight into the account)
--      'gpay' | 'paytm' | 'phonepe' | 'sbi' – that UPI app's "payment received" notification
--      NULL      – off
--    upi_account_last4: last 4 digits of the bank account, to tell SBI SMS for
--    two accounts apart (only needed when source = 'sms').
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS upi_match_source TEXT;
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS upi_account_last4 TEXT;

-- 2. Resent messages from the phone's offline queue carry the same client_ref,
--    so they are saved once.
ALTER TABLE companion_sms_logs ADD COLUMN IF NOT EXISTS client_ref TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS companion_sms_logs_client_ref_uidx
  ON companion_sms_logs (device_id, client_ref) WHERE client_ref IS NOT NULL;

-- 3. Raw notifications from UPI apps (kept 30 days, to check the parser).
CREATE TABLE IF NOT EXISTS companion_notification_logs (
  id           BIGSERIAL PRIMARY KEY,
  centre_id    INTEGER,
  device_id    TEXT,           -- companion device id (UUID)
  package      TEXT,
  title        TEXT,
  body         TEXT,
  posted_at    TIMESTAMPTZ,
  received_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  client_ref   TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS companion_notification_logs_client_ref_uidx
  ON companion_notification_logs (device_id, client_ref) WHERE client_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS companion_notification_logs_centre_idx
  ON companion_notification_logs (centre_id, received_at DESC);

-- 4. One row per UPI payment received.
CREATE TABLE IF NOT EXISTS upi_credits (
  id                  BIGSERIAL PRIMARY KEY,
  centre_id           INTEGER NOT NULL,
  device_id           TEXT,                       -- companion device id (UUID)
  wallet_id           INTEGER REFERENCES wallets(id) ON DELETE SET NULL,
  source              TEXT NOT NULL,              -- sms | gpay | paytm | phonepe | sbi
  amount              NUMERIC(12,2) NOT NULL,
  payer               TEXT,                       -- name or UPI id, when the message has one
  utr                 TEXT,                       -- UPI reference number, when the message has one
  account_last4       TEXT,
  sms_log_id          BIGINT,
  notification_log_id BIGINT,
  raw_text            TEXT,
  credited_at         TIMESTAMPTZ NOT NULL,       -- when the phone got the message
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- unclaimed → matched (linked to a payment) | ignored (not a customer payment)
  status              TEXT NOT NULL DEFAULT 'unclaimed',
  matched_payment_id  INTEGER,
  matched_by          INTEGER,
  matched_at          TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS upi_credits_centre_idx ON upi_credits (centre_id, credited_at DESC);
CREATE INDEX IF NOT EXISTS upi_credits_wallet_status_idx ON upi_credits (wallet_id, status, credited_at DESC);
-- The same UPI reference is one payment, even if two messages report it.
CREATE UNIQUE INDEX IF NOT EXISTS upi_credits_utr_uidx
  ON upi_credits (centre_id, utr) WHERE utr IS NOT NULL;
