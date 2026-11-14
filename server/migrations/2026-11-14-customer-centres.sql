-- Which centres a customer belongs to. Used when the superadmin sets the
-- customer portal to "each centre has its own portal" (org_settings key
-- customer_portal = "per_centre"): a customer then sees and books with only
-- the centre they signed in through, and staff see only their centre's
-- customers. In the default "one portal for all centres" mode it is kept up
-- to date but not used to limit anything.
--   source: 'link'    joined through the centre's link/QR
--           'picker'  chose the centre on the portal
--           'booking' had a booking with the centre (backfill / new bookings)
--           'staff'   added at the centre by staff
--           'superadmin' assigned by the superadmin
-- Apply with: node scripts/orgs.js migrate migrations/2026-11-14-customer-centres.sql

CREATE TABLE IF NOT EXISTS customer_centres (
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  centre_id   INTEGER NOT NULL REFERENCES centres(id) ON DELETE CASCADE,
  source      TEXT NOT NULL DEFAULT 'booking',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (customer_id, centre_id)
);
CREATE INDEX IF NOT EXISTS customer_centres_centre_idx ON customer_centres (centre_id);

-- Existing customers belong to the centres they have booked with.
INSERT INTO customer_centres (customer_id, centre_id, source)
SELECT DISTINCT cs.customer_id, c.id, 'booking'
  FROM customer_services cs
  JOIN centres c ON c.id IN (cs.requested_centre_id, cs.handling_centre_id)
 WHERE cs.customer_id IS NOT NULL
ON CONFLICT DO NOTHING;
