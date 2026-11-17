-- Scheduled reports can also go out on WhatsApp (as a PDF, via the
-- 'scheduled_report' template mapped in Communication Settings).
--   send_email      : keep emailing the report (on for every existing schedule)
--   send_whatsapp   : also send it on WhatsApp
--   specific_phones : numbers typed in by hand (used in "Specific" mode, like specific_emails)
-- Apply with: node scripts/orgs.js migrate migrations/2026-11-17-report-whatsapp.sql

ALTER TABLE report_schedules ADD COLUMN IF NOT EXISTS send_email BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE report_schedules ADD COLUMN IF NOT EXISTS send_whatsapp BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE report_schedules ADD COLUMN IF NOT EXISTS specific_phones TEXT[] NOT NULL DEFAULT '{}';
