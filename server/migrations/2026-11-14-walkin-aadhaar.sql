-- Walk-in entries: stop storing the full Aadhaar number, and link entries to
-- the customer account with the same Aadhaar so they see them in the portal.
--   service_tracking.aadhaar        now a masked "XXXX-XXXX-1234"
--   service_tracking.aadhaar_last4  last 4 digits
--   service_tracking.aadhaar_hash   same fingerprint as customers.aadhaar_hash
--   service_entries.customer_id     the customer account this entry belongs to
-- Apply with: node scripts/orgs.js migrate migrations/2026-11-14-walkin-aadhaar.sql

-- was VARCHAR(12): too short for the masked form
ALTER TABLE service_tracking ALTER COLUMN aadhaar TYPE TEXT;
ALTER TABLE service_tracking ADD COLUMN IF NOT EXISTS aadhaar_hash TEXT;
ALTER TABLE service_tracking ADD COLUMN IF NOT EXISTS aadhaar_last4 TEXT;
CREATE INDEX IF NOT EXISTS service_tracking_aadhaar_hash_idx ON service_tracking (aadhaar_hash);

ALTER TABLE service_entries ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS service_entries_customer_idx ON service_entries (customer_id);

-- Existing full numbers → fingerprint + last 4 + masked text.
UPDATE service_tracking st
   SET aadhaar_hash  = encode(sha256(convert_to(x.d, 'UTF8')), 'hex'),
       aadhaar_last4 = right(x.d, 4),
       aadhaar       = 'XXXX-XXXX-' || right(x.d, 4)
  FROM (SELECT id, regexp_replace(aadhaar, '\D', '', 'g') AS d FROM service_tracking WHERE aadhaar IS NOT NULL) x
 WHERE st.id = x.id AND length(x.d) = 12;

-- Walk-in entries of customers who already have an account.
UPDATE service_entries se
   SET customer_id = c.id
  FROM service_tracking st
  JOIN customers c ON c.aadhaar_hash = st.aadhaar_hash
 WHERE st.service_entry_id = se.id
   AND se.customer_id IS NULL
   AND se.customer_service_id IS NULL;

-- Audit log lines written with a full number ("... with aadhaar 123412341234 ...").
UPDATE audit_logs
   SET details = regexp_replace(details, 'aadhaar [0-9]{8}([0-9]{4})', 'aadhaar XXXX-XXXX-\1', 'g')
 WHERE details ~ 'aadhaar [0-9]{12}';
