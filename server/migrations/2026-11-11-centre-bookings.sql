-- Online bookings remember which centre the customer booked with.
--   requested_centre_id      centre the customer chose (or came through its link/QR);
--                            NULL = "any centre". Never changed when staff take the job.
--   handling_centre_id       centre of the staff member who took the job.
--   taken_from_other_centre  true when a different centre took it after confirming.
-- org_settings holds per-organization options such as the booking mode.
-- Apply with: node scripts/orgs.js migrate migrations/2026-11-11-centre-bookings.sql

ALTER TABLE customer_services ADD COLUMN IF NOT EXISTS requested_centre_id INTEGER REFERENCES centres(id) ON DELETE SET NULL;
ALTER TABLE customer_services ADD COLUMN IF NOT EXISTS handling_centre_id INTEGER REFERENCES centres(id) ON DELETE SET NULL;
ALTER TABLE customer_services ADD COLUMN IF NOT EXISTS taken_from_other_centre BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS customer_services_requested_centre_idx ON customer_services (requested_centre_id);

CREATE TABLE IF NOT EXISTS org_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_by INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
