// Creating organization databases. Used by scripts/orgs.js and the
// platform-admin page, so both create organizations the same way.
//
// Needs pg_dump and psql on the server (on PATH, or PG_BIN = their folder).

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import pg from "pg";
import bcrypt from "bcryptjs";
import { RESERVED_UPLOAD_NAMES } from "./uploads.js";
import { DEFAULT_ORG_SLUG } from "./registry.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const ssl = process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false;

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,40}$/;
export const CONTROL_SCHEMA_PATH = path.join(here, "control_schema.sql");

export class ProvisionError extends Error {}

/* ---------------- small database helpers ---------------- */

export function urlWithDb(baseUrl, dbName) {
  const u = new URL(baseUrl);
  u.pathname = "/" + encodeURIComponent(dbName);
  return u.toString();
}

export const dbNameOf = (url) => decodeURIComponent(new URL(url).pathname.slice(1));
export const quoteIdent = (s) => `"${String(s).replace(/"/g, '""')}"`;

export async function withClient(url, fn) {
  const client = new pg.Client({ connectionString: url, ssl });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

function pgEnv(url) {
  const u = new URL(url);
  return {
    ...process.env,
    PGHOST: u.hostname,
    PGPORT: u.port || "5432",
    PGUSER: decodeURIComponent(u.username),
    PGPASSWORD: decodeURIComponent(u.password),
    PGDATABASE: dbNameOf(url),
  };
}

const bin = (name) => (process.env.PG_BIN ? path.join(process.env.PG_BIN, name) : name);

/** pg_dump <dumpArgs> from one database | psql into another. */
export function pipeDump(fromUrl, toUrl, dumpArgs) {
  return new Promise((resolve, reject) => {
    const dump = spawn(bin("pg_dump"), ["--no-owner", "--no-privileges", ...dumpArgs], {
      env: pgEnv(fromUrl),
      stdio: ["ignore", "pipe", "pipe"],
    });
    const psql = spawn(bin("psql"), ["-v", "ON_ERROR_STOP=1", "-q"], {
      env: pgEnv(toUrl),
      stdio: ["pipe", "ignore", "pipe"],
    });
    let errors = "";
    dump.stderr.on("data", (d) => (errors += d));
    psql.stderr.on("data", (d) => (errors += d));
    dump.on("error", (e) => reject(new Error(`Could not run pg_dump (${e.message}). Set PG_BIN.`)));
    psql.on("error", (e) => reject(new Error(`Could not run psql (${e.message}). Set PG_BIN.`)));
    dump.stdout.pipe(psql.stdin);
    const exited = (proc) => new Promise((res) => proc.on("close", res));
    Promise.all([exited(dump), exited(psql)]).then(([dumpCode, psqlCode]) => {
      if (dumpCode === 0 && psqlCode === 0) resolve();
      else reject(new Error(`pg_dump/psql failed (exit ${dumpCode}/${psqlCode}):\n${errors}`));
    });
  });
}

export async function databaseExists(adminUrl, dbName) {
  return withClient(adminUrl, async (c) => {
    const { rowCount } = await c.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
    return rowCount > 0;
  });
}

/** Apply control_schema.sql (idempotent). */
export async function applyControlSchema(controlClient) {
  await controlClient.query(fs.readFileSync(CONTROL_SCHEMA_PATH, "utf8"));
}

/* ---------------- create an organization ---------------- */

/** Why a slug can't be used, or null if it's fine (format and upload folders only). */
export function slugProblem(slug) {
  if (!SLUG_RE.test(slug)) return "Slug must be 2–41 characters: lowercase letters, digits and dashes";
  const uploadsDir = path.join(process.cwd(), "uploads");
  const taken = new Set([...RESERVED_UPLOAD_NAMES, ...(fs.existsSync(uploadsDir) ? fs.readdirSync(uploadsDir) : [])]);
  if (taken.has(slug)) return `"${slug}" is already a folder name under uploads/. Choose another slug.`;
  return null;
}

/**
 * Create a new organization: an empty database with the same tables as the
 * default organization, its first superadmin, and its row in the control DB.
 * Throws ProvisionError for problems the person can fix (slug taken, etc.).
 */
export async function createOrganization(
  {
    name,
    slug,
    adminUsername,
    adminPassword,
    adminName = null,
    adminEmail = null,
    phone = null,
    copyTables = ["document_master"],
    planId = null,
    billingCycle = "monthly",
    trialEndsAt = null,
    graceDays = 7,
    notes = null,
  },
  log = () => {}
) {
  const base = process.env.DATABASE_URL;
  const controlUrl = process.env.CONTROL_DATABASE_URL;
  if (!base || !controlUrl) throw new ProvisionError("DATABASE_URL and CONTROL_DATABASE_URL must be set");

  slug = String(slug || "").trim().toLowerCase();
  name = String(name || "").trim();
  if (!name) throw new ProvisionError("Organization name is required");
  const problem = slugProblem(slug);
  if (problem) throw new ProvisionError(problem);
  if (!adminUsername) throw new ProvisionError("Superadmin username is required");
  if (!adminPassword || String(adminPassword).length < 8) throw new ProvisionError("Superadmin password must be 8+ characters");
  if (!["monthly", "yearly"].includes(billingCycle)) throw new ProvisionError("Billing cycle must be monthly or yearly");

  const prefix = process.env.TENANT_DB_PREFIX || "akshaya_org";
  const dbName = `${prefix}_${slug.replace(/-/g, "_")}`;
  const newUrl = urlWithDb(base, dbName);
  const adminUrl = urlWithDb(base, "postgres");

  await withClient(controlUrl, async (c) => {
    const { rowCount } = await c.query("SELECT 1 FROM organizations WHERE slug = $1 OR db_name = $2", [slug, dbName]);
    if (rowCount) throw new ProvisionError(`An organization with slug "${slug}" already exists`);
    if (planId) {
      const plan = await c.query("SELECT 1 FROM plans WHERE id = $1", [planId]);
      if (!plan.rowCount) throw new ProvisionError("Plan not found");
    }
  });
  if (await databaseExists(adminUrl, dbName)) throw new ProvisionError(`Database "${dbName}" already exists`);

  log(`Creating database "${dbName}"`);
  await withClient(adminUrl, (c) => c.query(`CREATE DATABASE ${quoteIdent(dbName)}`));

  try {
    log("Copying table structure from the default organization (no data)");
    await pipeDump(base, newUrl, ["--schema-only"]);

    for (const table of copyTables) {
      log(`Copying reference data: ${table}`);
      await pipeDump(base, newUrl, ["--data-only", "--table", `public.${table}`]);
    }

    log("Creating the superadmin login");
    const hash = await bcrypt.hash(String(adminPassword), 10);
    await withClient(newUrl, (c) =>
      c.query(
        `INSERT INTO staff (username, name, email, password, role, status)
         VALUES ($1, $2, $3, $4, 'superadmin', 'Active')`,
        [adminUsername, adminName || name, adminEmail || `${adminUsername}@${slug}.local`, hash]
      )
    );

    const org = await withClient(controlUrl, async (c) => {
      const { rows } = await c.query(
        `INSERT INTO organizations
           (name, slug, db_name, plan_id, billing_cycle, trial_ends_at, grace_days, notes,
            contact_name, contact_phone, contact_email)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [name, slug, dbName, planId || null, billingCycle, trialEndsAt || null, graceDays ?? 7, notes,
          adminName || null, phone || null, adminEmail || null]
      );
      // The new database already has every change the default one has.
      await c.query(
        `INSERT INTO tenant_migrations (org_slug, name)
         SELECT $1, name FROM tenant_migrations WHERE org_slug = $2
         ON CONFLICT DO NOTHING`,
        [slug, DEFAULT_ORG_SLUG]
      );
      return rows[0];
    });
    return org;
  } catch (err) {
    log("Setup failed, removing the half-created database");
    await withClient(adminUrl, (c) => c.query(`DROP DATABASE IF EXISTS ${quoteIdent(dbName)}`)).catch(() => {});
    throw err;
  }
}
