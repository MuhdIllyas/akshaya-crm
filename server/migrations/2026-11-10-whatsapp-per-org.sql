-- WhatsApp settings move from server/.env into each organization's
-- Communication Settings.
--   api_key            Libromi developer API key (different from the channel
--                      access token); used to download media customers send.
--   use_for_portal_otp The account that sends customer portal OTPs
--                      (registration and login). If none is chosen, the first
--                      active account is used.
-- Apply with: node scripts/orgs.js migrate migrations/2026-11-10-whatsapp-per-org.sql

ALTER TABLE communication_accounts ADD COLUMN IF NOT EXISTS api_key TEXT;
ALTER TABLE communication_accounts ADD COLUMN IF NOT EXISTS use_for_portal_otp BOOLEAN NOT NULL DEFAULT false;
