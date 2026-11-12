-- Every staff sign-in attempt (successful or wrong password), for the
-- sign-in history and the lock after repeated wrong passwords.
-- staff_id is empty when the username doesn't exist.
-- Apply with: node scripts/orgs.js migrate migrations/2026-11-12-staff-logins.sql

CREATE TABLE IF NOT EXISTS staff_logins (
  id          SERIAL PRIMARY KEY,
  staff_id    INTEGER REFERENCES staff(id) ON DELETE SET NULL,
  username    TEXT NOT NULL,
  success     BOOLEAN NOT NULL,
  ip          TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS staff_logins_username_idx ON staff_logins (username, created_at DESC);
CREATE INDEX IF NOT EXISTS staff_logins_staff_idx ON staff_logins (staff_id, created_at DESC);
