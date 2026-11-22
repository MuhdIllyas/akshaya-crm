-- Companion device ids are text (UUIDs like 'cdf8dca4-7b2b-…'), not numbers.
-- 2026-11-22-upi-credits.sql created these columns as INTEGER, so every
-- notification from a phone failed to save. Safe to run more than once.
ALTER TABLE companion_notification_logs ALTER COLUMN device_id TYPE TEXT USING device_id::text;
ALTER TABLE upi_credits ALTER COLUMN device_id TYPE TEXT USING device_id::text;
