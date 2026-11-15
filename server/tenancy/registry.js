// The list of organizations and a connection pool for each one's database.
//
// Two modes:
//  - Single-tenant (CONTROL_DATABASE_URL not set): everything runs on
//    DATABASE_URL, exactly as before multi-tenancy existed.
//  - Multi-tenant (CONTROL_DATABASE_URL set): the control database holds the
//    `organizations` table. Each organization has its own database on the same
//    Postgres server, named by organizations.db_name. The organization whose
//    slug is DEFAULT_ORG_SLUG is the original business (DATABASE_URL's database).

// Load server/.env before reading DEFAULT_ORG_SLUG below (imports run before
// the importing file's own dotenv.config() call).
import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

const ssl = process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false;
const CACHE_MS = 30_000;

export const DEFAULT_ORG_SLUG = process.env.DEFAULT_ORG_SLUG || "default";

export function isMultiTenant() {
  return Boolean(process.env.CONTROL_DATABASE_URL);
}

function baseUrl() {
  const url = process.env.DATABASE_URL || process.env.PG_URI;
  if (!url) throw new Error("DATABASE_URL is not set");
  return url;
}

/** Name of the database DATABASE_URL points at (the default organization's). */
export function defaultDbName() {
  return decodeURIComponent(new URL(baseUrl()).pathname.slice(1));
}

/** Connection string for another database on the same server as DATABASE_URL. */
export function urlForDb(dbName) {
  const u = new URL(baseUrl());
  u.pathname = "/" + encodeURIComponent(dbName);
  return u.toString();
}

/* ---------------- control database ---------------- */

let controlPool = null;

export function getControlPool() {
  if (!isMultiTenant()) throw new Error("CONTROL_DATABASE_URL is not set (single-tenant mode)");
  if (!controlPool) {
    controlPool = new Pool({ connectionString: process.env.CONTROL_DATABASE_URL, ssl, max: 5 });
    controlPool.on("error", (err) => console.error("[tenancy] control pool error:", err.message));
  }
  return controlPool;
}

// Organization plus its plan's limits (NULL limit = unlimited). The default
// organization (yours) never has limits.
const ORG_SELECT = `
  SELECT o.id, o.name, o.slug, o.db_name, o.status, o.created_at, o.plan_id,
         p.name AS plan_name, p.max_centres, p.max_staff, p.storage_mb,
         COALESCE(p.customer_portal, true) AS customer_portal,
         COALESCE(p.whatsapp, true) AS whatsapp
    FROM organizations o
    LEFT JOIN plans p ON p.id = o.plan_id`;

const UNLIMITED = { max_centres: null, max_staff: null, storage_mb: null, customer_portal: true, whatsapp: true };

function withLimits(row) {
  if (!row) return null;
  const { max_centres, max_staff, storage_mb, customer_portal, whatsapp, ...org } = row;
  org.limits = org.slug === DEFAULT_ORG_SLUG ? { ...UNLIMITED } : { max_centres, max_staff, storage_mb, customer_portal, whatsapp };
  return org;
}

const singleTenantOrg = () => ({
  id: null,
  name: null,
  slug: DEFAULT_ORG_SLUG,
  db_name: defaultDbName(),
  status: "active",
  plan_id: null,
  plan_name: null,
  limits: { ...UNLIMITED },
});

const cache = new Map(); // slug -> { org, at }

/** Look up an organization by slug. Returns null when it doesn't exist. */
export async function getOrgBySlug(slug) {
  if (!slug) return null;
  slug = String(slug).toLowerCase();
  if (!isMultiTenant()) return slug === DEFAULT_ORG_SLUG ? singleTenantOrg() : null;

  const hit = cache.get(slug);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.org;

  const { rows } = await getControlPool().query(`${ORG_SELECT} WHERE o.slug = $1`, [slug]);
  const org = withLimits(rows[0]);
  cache.set(slug, { org, at: Date.now() });
  return org;
}

export async function getDefaultOrg() {
  const org = await getOrgBySlug(DEFAULT_ORG_SLUG);
  if (!org) {
    throw new Error(
      `[tenancy] Default organization "${DEFAULT_ORG_SLUG}" is missing from the control database. ` +
        "Run: node scripts/orgs.js init"
    );
  }
  return org;
}

export async function listActiveOrgs() {
  if (!isMultiTenant()) return [singleTenantOrg()];
  const { rows } = await getControlPool().query(`${ORG_SELECT} WHERE o.status = 'active' ORDER BY o.id`);
  return rows.map(withLimits);
}

export function forgetOrg(slug) {
  cache.delete(String(slug).toLowerCase());
}

/* ---------------- per-organization pools ---------------- */

const pools = new Map(); // db_name -> Pool

export function poolFor(org) {
  let pool = pools.get(org.db_name);
  if (!pool) {
    const isDefault = org.slug === DEFAULT_ORG_SLUG;
    pool = new Pool({
      connectionString: urlForDb(org.db_name),
      ssl,
      max: Number(isDefault ? process.env.PG_POOL_MAX || 10 : process.env.TENANT_POOL_MAX || 5),
      idleTimeoutMillis: 30_000,
    });
    pool.on("error", (err) => console.error(`[tenancy] pool error (${org.slug}):`, err.message));
    pools.set(org.db_name, pool);
  }
  return pool;
}

/** Pool used when no organization is in context. Only allowed in single-tenant mode. */
export function fallbackPool() {
  if (isMultiTenant()) return null;
  return poolFor(singleTenantOrg());
}
