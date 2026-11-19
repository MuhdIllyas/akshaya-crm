-- OTPs from the companion phone move out of the messenger.
-- They are now listed from companion_sms_logs (top bar + Notifications → OTPs)
-- and no longer create chat messages or unread badges.

-- 1. The SMS log (some databases were set up before this table had a migration).
CREATE TABLE IF NOT EXISTS companion_sms_logs (
  id          BIGSERIAL PRIMARY KEY,
  centre_id   INTEGER,
  device_id   INTEGER,
  sender      TEXT,
  message     TEXT,
  is_otp      BOOLEAN DEFAULT FALSE
);
ALTER TABLE companion_sms_logs ADD COLUMN IF NOT EXISTS id BIGSERIAL;
ALTER TABLE companion_sms_logs ADD COLUMN IF NOT EXISTS otp_code TEXT;
-- No default while adding, so old rows aren't stamped "just now" and shown as live.
ALTER TABLE companion_sms_logs ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ;

-- Old rows: take the time from whichever timestamp column the table already had.
DO $$
DECLARE col TEXT;
BEGIN
  SELECT column_name INTO col
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'companion_sms_logs'
     AND column_name IN ('created_at', 'received_at_device', 'logged_at', 'timestamp')
   ORDER BY array_position(ARRAY['created_at', 'received_at_device', 'logged_at', 'timestamp'], column_name::text)
   LIMIT 1;
  IF col IS NOT NULL THEN
    EXECUTE format('UPDATE companion_sms_logs SET received_at = %I WHERE received_at IS NULL', col);
  END IF;
END $$;

ALTER TABLE companion_sms_logs ALTER COLUMN received_at SET DEFAULT NOW();
CREATE INDEX IF NOT EXISTS companion_sms_logs_centre_received_idx
  ON companion_sms_logs (centre_id, received_at DESC);

-- 2. Retire the "SMS Gateway (OTPs)" group chats: archive them and take everyone
--    out, which clears the OTP unread badges in the messenger.
UPDATE chat_conversations SET status = 'archived', archived_at = COALESCE(archived_at, NOW()) WHERE context_type = 'sms_gateway';
DELETE FROM chat_participants
 WHERE conversation_id IN (SELECT id FROM chat_conversations WHERE context_type = 'sms_gateway');
