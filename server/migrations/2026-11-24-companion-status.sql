-- Companion phone status, sent by the app (1.2+) every minute, so a centre
-- whose UPI notifications stopped can be seen without visiting it.
ALTER TABLE companion_devices
  ADD COLUMN IF NOT EXISTS notification_access BOOLEAN,
  ADD COLUMN IF NOT EXISTS reader_connected BOOLEAN,
  ADD COLUMN IF NOT EXISTS last_payment_notification_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_any_notification_at TIMESTAMPTZ;
