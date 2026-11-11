-- Each centre needs its own WhatsApp number: two centres can't share one
-- communication account (incoming messages couldn't tell which centre is meant).
-- A centre with no account simply has WhatsApp switched off.
-- If centres already share an account, this stops and lists them; give each
-- centre its own account (or none) in Centre Management, then run it again.
-- Apply with: node scripts/orgs.js migrate migrations/2026-11-11-one-whatsapp-per-centre.sql

DO $$
DECLARE dupes TEXT;
BEGIN
  SELECT string_agg(format('account %s used by: %s', communication_account_id, names), '; ')
    INTO dupes
    FROM (
      SELECT communication_account_id, string_agg(name, ', ' ORDER BY id) AS names
        FROM centres
       WHERE communication_account_id IS NOT NULL
       GROUP BY communication_account_id
      HAVING COUNT(*) > 1
    ) d;
  IF dupes IS NOT NULL THEN
    RAISE EXCEPTION 'Centres share a WhatsApp account (%). Give each centre its own account first.', dupes;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS centres_one_whatsapp_account
  ON centres (communication_account_id)
  WHERE communication_account_id IS NOT NULL;
