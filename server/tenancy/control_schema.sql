-- Control database: the list of organizations (one per subscription).
-- Each organization's business data lives in its own database (db_name).

CREATE TABLE IF NOT EXISTS organizations (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,40}$'),
  db_name     TEXT NOT NULL UNIQUE,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  plan        TEXT,
  contact_name  TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Print-agent pairing codes are 6 digits with no organization attached;
-- this maps a live code to the organization that issued it.
CREATE TABLE IF NOT EXISTS pairing_code_index (
  code        TEXT PRIMARY KEY,
  org_slug    TEXT NOT NULL REFERENCES organizations(slug) ON UPDATE CASCADE ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL
);

-- Schema changes applied to organization databases (node scripts/orgs.js migrate).
CREATE TABLE IF NOT EXISTS tenant_migrations (
  org_slug    TEXT NOT NULL REFERENCES organizations(slug) ON UPDATE CASCADE ON DELETE CASCADE,
  name        TEXT NOT NULL,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (org_slug, name)
);

-- ---------------------------------------------------------------------------
-- Plans, billing and the platform-admin page (added 2026-11-11).
-- Safe to run again: the server applies this file at start-up.
-- ---------------------------------------------------------------------------

-- Subscription plans. NULL limit = unlimited.
CREATE TABLE IF NOT EXISTS plans (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL UNIQUE,
  description     TEXT,
  price_monthly   NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_yearly    NUMERIC(10,2) NOT NULL DEFAULT 0,
  max_centres     INTEGER CHECK (max_centres IS NULL OR max_centres >= 0),
  max_staff       INTEGER CHECK (max_staff IS NULL OR max_staff >= 0),
  storage_mb      INTEGER CHECK (storage_mb IS NULL OR storage_mb >= 0),
  customer_portal BOOLEAN NOT NULL DEFAULT true,
  whatsapp        BOOLEAN NOT NULL DEFAULT true,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Billing for each organization. The default organization (yours) is never billed.
--   trial_ends_at  last day of the free trial
--   paid_until     last day covered by payments
--   grace_days     days after that before automatic suspension
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS plan_id INTEGER REFERENCES plans(id) ON DELETE SET NULL;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS billing_cycle TEXT NOT NULL DEFAULT 'monthly';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS trial_ends_at DATE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS paid_until DATE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS grace_days INTEGER NOT NULL DEFAULT 7;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS status_reason TEXT;

-- Payments you record by hand (online payments can be added later).
CREATE TABLE IF NOT EXISTS payments (
  id            SERIAL PRIMARY KEY,
  org_slug      TEXT NOT NULL REFERENCES organizations(slug) ON UPDATE CASCADE ON DELETE CASCADE,
  amount        NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  paid_on       DATE NOT NULL,
  covers_until  DATE NOT NULL,
  method        TEXT,
  reference     TEXT,
  note          TEXT,
  recorded_by   INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payments_org_idx ON payments (org_slug, paid_on DESC);

-- Logins for the platform-admin page (you, the software owner).
CREATE TABLE IF NOT EXISTS platform_admins (
  id             SERIAL PRIMARY KEY,
  username       TEXT NOT NULL UNIQUE,
  name           TEXT,
  password_hash  TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at  TIMESTAMPTZ
);
