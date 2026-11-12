#!/usr/bin/env node
// Manage organizations (one per subscription). Run on the server, from /server.
// Most of this is also on the platform-admin page (/platform); the script is
// for setup, schema migrations and emergencies.
//
//   node scripts/orgs.js init --name "My Business"
//       One-time setup (safe to run again). Creates the control database
//       (CONTROL_DATABASE_URL), its tables, and registers the current
//       DATABASE_URL database as the default organization.
//
//   node scripts/orgs.js add-admin --username me --password '...' [--name "..."]
//       Create (or reset the password of) a platform-admin login.
//
//   node scripts/orgs.js seed-plans
//       Add the standard plans (Single centre, Multi-centre, Group, Large group).
//       Plans that already exist are left as they are; edit them on /platform.
//
//   node scripts/orgs.js create --name "Buyer X" --slug buyer-x \
//        --admin-username buyerx --admin-password '...' [--admin-name "..."] \
//        [--admin-email ...] [--phone ...] [--copy document_master]
//       Creates a new, empty database for the organization with the same
//       tables as the default organization, plus its first superadmin login.
//
//   node scripts/orgs.js list
//   node scripts/orgs.js suspend <slug>     (blocks all logins and API calls)
//   node scripts/orgs.js activate <slug>
//
//   node scripts/orgs.js migrate migrations/2026-11-10-add-x.sql [--org slug]
//       Apply a schema change to every organization database (skips ones
//       that already have it). Use this for every future schema change.
//
// Needs pg_dump and psql on PATH (or set PG_BIN to their folder).

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import {
  applyControlSchema,
  createOrganization,
  databaseExists,
  dbNameOf,
  quoteIdent,
  urlWithDb,
  withClient,
} from "../tenancy/provision.js";
import { DEFAULT_ORG_SLUG as DEFAULT_SLUG } from "../tenancy/registry.js";

/* ---------------- helpers ---------------- */

function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
      out[key] = val;
    } else out._.push(a);
  }
  return out;
}

function requireEnv(name) {
  if (!process.env[name]) fail(`${name} is not set in server/.env`);
  return process.env[name];
}

const str = (v) => (v === undefined || v === true ? undefined : String(v));

/* ---------------- commands ---------------- */

async function init(args) {
  const base = requireEnv("DATABASE_URL");
  const controlUrl = requireEnv("CONTROL_DATABASE_URL");
  const controlDb = dbNameOf(controlUrl);
  const adminUrl = urlWithDb(controlUrl, "postgres");

  if (!(await databaseExists(adminUrl, controlDb))) {
    await withClient(adminUrl, (c) => c.query(`CREATE DATABASE ${quoteIdent(controlDb)}`));
    console.log(`✔ Created control database "${controlDb}"`);
  }

  await withClient(controlUrl, async (c) => {
    await applyControlSchema(c);
    const name = str(args.name) || process.env.DEFAULT_ORG_NAME || "Main organization";
    const { rows } = await c.query(
      `INSERT INTO organizations (name, slug, db_name)
       VALUES ($1, $2, $3)
       ON CONFLICT (slug) DO UPDATE SET db_name = EXCLUDED.db_name
       RETURNING id, slug, db_name`,
      [name, DEFAULT_SLUG, dbNameOf(base)]
    );
    console.log(`✔ Default organization "${rows[0].slug}" → database "${rows[0].db_name}"`);

    // Migrations applied before multi-organization mode was switched on.
    const local = await withClient(base, async (d) => {
      const exists = await d.query("SELECT to_regclass('public.schema_migrations') AS t");
      return exists.rows[0].t ? (await d.query("SELECT name FROM schema_migrations")).rows : [];
    });
    for (const { name: m } of local) {
      await c.query("INSERT INTO tenant_migrations (org_slug, name) VALUES ($1, $2) ON CONFLICT DO NOTHING", [DEFAULT_SLUG, m]);
    }
    if (local.length) console.log(`✔ Carried over ${local.length} applied migration(s)`);
  });
  console.log("\nDone. Restart the server to switch on multi-organization mode.\n");
}

async function addAdmin(args) {
  const username = str(args.username);
  const password = str(args.password);
  if (!username) fail("--username is required");
  if (!password || password.length < 10) fail("--password is required (10+ characters)");
  const hash = await bcrypt.hash(password, 12);
  await withClient(requireEnv("CONTROL_DATABASE_URL"), async (c) => {
    await applyControlSchema(c);
    // Always an owner. Running it for an existing username resets the password
    // and switches the account back on: the emergency way back in.
    await c.query(
      `INSERT INTO platform_admins (username, name, password_hash, role) VALUES ($1, $2, $3, 'owner')
       ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash,
         name = COALESCE(EXCLUDED.name, platform_admins.name), role = 'owner', is_active = true`,
      [username, str(args.name) || null, hash]
    );
  });
  console.log(`✔ Platform admin "${username}" saved as an owner. Sign in at /platform/login`);
  if (!process.env.PLATFORM_JWT_SECRET) console.log("  Also set PLATFORM_JWT_SECRET in server/.env (a long random string).");
}

// The plans agreed on 2026-11-11. Prices in rupees; null limit = unlimited.
// The single-centre launch offer (₹2,999 for the first year) is not a separate
// plan: record the payment at ₹2,999 on the platform-admin page.
const STANDARD_PLANS = [
  {
    name: "Single centre",
    description: "1 centre · launch offer ₹2,999 for the first year",
    price_monthly: 499, price_yearly: 4999,
    max_centres: 1, max_staff: 8, storage_mb: 2 * 1024,
    customer_portal: true, whatsapp: false,
  },
  {
    name: "Multi-centre",
    description: "Up to 3 centres",
    price_monthly: 1299, price_yearly: 12999,
    max_centres: 3, max_staff: 25, storage_mb: 10 * 1024,
    customer_portal: true, whatsapp: true,
  },
  {
    name: "Group",
    description: "Up to 10 centres",
    price_monthly: 2999, price_yearly: 29999,
    max_centres: 10, max_staff: 80, storage_mb: 50 * 1024,
    customer_portal: true, whatsapp: true,
  },
  {
    name: "Large group",
    description: "No limits · price quoted per organization (record the agreed amount as payments)",
    price_monthly: 0, price_yearly: 0,
    max_centres: null, max_staff: null, storage_mb: null,
    customer_portal: true, whatsapp: true,
  },
];

async function seedPlans() {
  await withClient(requireEnv("CONTROL_DATABASE_URL"), async (c) => {
    await applyControlSchema(c);
    for (const p of STANDARD_PLANS) {
      const { rowCount } = await c.query(
        `INSERT INTO plans (name, description, price_monthly, price_yearly, max_centres, max_staff, storage_mb, customer_portal, whatsapp)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (name) DO NOTHING`,
        [p.name, p.description, p.price_monthly, p.price_yearly, p.max_centres, p.max_staff, p.storage_mb, p.customer_portal, p.whatsapp]
      );
      console.log(rowCount ? `✔ Added plan "${p.name}"` : `• Plan "${p.name}" already exists (left unchanged)`);
    }
  });
}

async function create(args) {
  requireEnv("DATABASE_URL");
  requireEnv("CONTROL_DATABASE_URL");
  const copy = args.copy === undefined ? ["document_master"] : args.copy === true ? [] : String(args.copy).split(",").map((t) => t.trim()).filter(Boolean);
  const org = await createOrganization(
    {
      name: str(args.name),
      slug: str(args.slug),
      adminUsername: str(args["admin-username"]),
      adminPassword: str(args["admin-password"]),
      adminName: str(args["admin-name"]),
      adminEmail: str(args["admin-email"]),
      phone: str(args.phone),
      copyTables: copy,
    },
    (msg) => console.log(`→ ${msg}`)
  );
  const front = (process.env.FRONTEND_URL || "https://<your-site>").replace(/\/$/, "");
  console.log(`
✔ Organization "${org.name}" created.

  Staff login:        ${front}/portal/${org.slug}/login   (username: ${str(args["admin-username"])})
  Customer portal:    ${front}/portal/${org.slug}/customer/register
`);
}

async function list() {
  await withClient(requireEnv("CONTROL_DATABASE_URL"), async (c) => {
    const { rows } = await c.query(
      `SELECT o.id, o.slug, o.name, o.db_name, o.status, p.name AS plan, o.paid_until, o.created_at::date AS created
         FROM organizations o LEFT JOIN plans p ON p.id = o.plan_id ORDER BY o.id`
    );
    console.table(rows);
  });
}

async function setStatus(slug, status) {
  if (!slug) fail("Give the organization slug");
  if (slug === DEFAULT_SLUG && status !== "active") fail("The default organization can't be suspended");
  await withClient(requireEnv("CONTROL_DATABASE_URL"), async (c) => {
    const { rowCount } = await c.query(
      "UPDATE organizations SET status = $1, status_reason = $3, updated_at = now() WHERE slug = $2",
      [status, slug, status === "suspended" ? "Suspended from the command line" : null]
    );
    if (!rowCount) fail(`No organization "${slug}"`);
  });
  console.log(`✔ ${slug} is now ${status} (takes effect within 30 seconds)`);
}

async function migrate(args) {
  const file = args._[1];
  if (!file || !fs.existsSync(file)) fail("Give the path of a .sql file");
  const name = path.basename(file);
  const sql = fs.readFileSync(file, "utf8");
  const base = requireEnv("DATABASE_URL");

  if (!process.env.CONTROL_DATABASE_URL) return migrateSingle(base, name, sql);

  await withClient(requireEnv("CONTROL_DATABASE_URL"), async (control) => {
    const { rows: orgs } = await control.query(
      `SELECT o.slug, o.db_name FROM organizations o
        WHERE ($1::text IS NULL OR o.slug = $1)
          AND NOT EXISTS (SELECT 1 FROM tenant_migrations m WHERE m.org_slug = o.slug AND m.name = $2)
        ORDER BY o.id`,
      [str(args.org) || null, name]
    );
    if (!orgs.length) return console.log(`Nothing to do: ${name} is already applied everywhere.`);

    for (const org of orgs) {
      process.stdout.write(`→ ${org.slug} (${org.db_name}) … `);
      try {
        await withClient(urlWithDb(base, org.db_name), async (c) => {
          await c.query("BEGIN");
          await c.query(sql);
          await c.query("COMMIT");
        });
        await control.query("INSERT INTO tenant_migrations (org_slug, name) VALUES ($1, $2)", [org.slug, name]);
        console.log("done");
      } catch (err) {
        console.log("FAILED");
        fail(`${org.slug}: ${err.message}\nFix the problem and run the same command again; finished orgs are skipped.`);
      }
    }
  });
}

// Before `init` (single organization): apply to DATABASE_URL and record it there.
async function migrateSingle(base, name, sql) {
  await withClient(base, async (c) => {
    await c.query("CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())");
    const { rowCount } = await c.query("SELECT 1 FROM schema_migrations WHERE name = $1", [name]);
    if (rowCount) return console.log(`Nothing to do: ${name} is already applied.`);
    process.stdout.write(`→ ${dbNameOf(base)} … `);
    await c.query("BEGIN");
    await c.query(sql);
    await c.query("INSERT INTO schema_migrations (name) VALUES ($1)", [name]);
    await c.query("COMMIT");
    console.log("done");
  });
}

/* ---------------- main ---------------- */

const args = parseArgs(process.argv.slice(2));
const commands = {
  init: () => init(args),
  "add-admin": () => addAdmin(args),
  "seed-plans": () => seedPlans(),
  create: () => create(args),
  list: () => list(),
  suspend: () => setStatus(args._[1], "suspended"),
  activate: () => setStatus(args._[1], "active"),
  migrate: () => migrate(args),
};

const run = commands[args._[0]];
if (!run) {
  console.log("Usage: node scripts/orgs.js <init|add-admin|seed-plans|create|list|suspend|activate|migrate> …  (see the top of this file)");
  process.exit(args._[0] ? 1 : 0);
}
run().catch((err) => fail(err.message));
