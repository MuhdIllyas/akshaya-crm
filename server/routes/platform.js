// Platform-admin API (/api/platform) for you, the software owner:
// plans, organizations, billing and payments. Uses only the control database
// plus read-only usage counts from each organization's database.
//
// Login is separate from organization staff: platform_admins table and its
// own secret (PLATFORM_JWT_SECRET), so a platform token never works on an
// organization's routes and vice versa.

import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { DEFAULT_ORG_SLUG, forgetOrg, getControlPool, getOrgBySlug, isMultiTenant, poolFor } from "../tenancy/registry.js";
import { createOrganization, ProvisionError } from "../tenancy/provision.js";
import { AUTO_SUSPEND_REASON, addCycle, billingState, suspendOverdueOrgs } from "../tenancy/billing.js";
import { countUsage, orgStorageBytes } from "../tenancy/limits.js";
import { addDays, todayIST, isYMD } from "../utils/dates.js";

const router = express.Router();
const control = () => getControlPool();
const TOKEN_HOURS = 12;

/* ---------------- guards ---------------- */

router.use((req, res, next) => {
  if (!isMultiTenant()) return res.status(503).json({ error: "Multi-organization mode is off (CONTROL_DATABASE_URL not set)." });
  if (!process.env.PLATFORM_JWT_SECRET) return res.status(503).json({ error: "PLATFORM_JWT_SECRET is not set on the server." });
  next();
});

// Simple brute-force protection for the login: 8 tries per 15 minutes per IP.
const attempts = new Map();
function loginLimiter(req, res, next) {
  const now = Date.now();
  const a = attempts.get(req.ip) || { n: 0, at: now };
  if (now - a.at > 15 * 60_000) Object.assign(a, { n: 0, at: now });
  a.n += 1;
  attempts.set(req.ip, a);
  if (a.n > 8) return res.status(429).json({ error: "Too many attempts. Try again in 15 minutes." });
  next();
}

async function requirePlatformAdmin(req, res, next) {
  const token = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || "")?.[1];
  if (!token) return res.status(401).json({ error: "Sign in required" });
  try {
    const decoded = jwt.verify(token, process.env.PLATFORM_JWT_SECRET);
    if (decoded.type !== "platform") throw new Error("wrong token type");
    const { rows } = await control().query("SELECT id, username, name FROM platform_admins WHERE id = $1", [decoded.pa_id]);
    if (!rows[0]) return res.status(401).json({ error: "Sign in required" });
    req.platformAdmin = rows[0];
    next();
  } catch {
    res.status(401).json({ error: "Session expired. Please sign in again." });
  }
}

const wrap = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    if (err instanceof ProvisionError || err.status === 400) return res.status(400).json({ error: err.message });
    console.error("[platform]", err);
    res.status(500).json({ error: "Something went wrong" });
  }
};

const bad = (message) => Object.assign(new Error(message), { status: 400 });

/* ---------------- auth ---------------- */

router.post("/auth/login", loginLimiter, wrap(async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) throw bad("Username and password are required");
  const { rows } = await control().query("SELECT id, username, name, password_hash FROM platform_admins WHERE username = $1", [String(username)]);
  const admin = rows[0];
  if (!admin || !(await bcrypt.compare(String(password), admin.password_hash))) {
    return res.status(401).json({ error: "Invalid username or password" });
  }
  attempts.delete(req.ip);
  await control().query("UPDATE platform_admins SET last_login_at = now() WHERE id = $1", [admin.id]);
  const token = jwt.sign({ type: "platform", pa_id: admin.id }, process.env.PLATFORM_JWT_SECRET, { expiresIn: `${TOKEN_HOURS}h` });
  res.json({ token, admin: { id: admin.id, username: admin.username, name: admin.name } });
}));

router.use(requirePlatformAdmin);

router.get("/auth/me", (req, res) => res.json({ admin: req.platformAdmin }));

/* ---------------- plans ---------------- */

const PLAN_FIELDS = ["name", "description", "price_monthly", "price_yearly", "max_centres", "max_staff", "storage_mb", "customer_portal", "whatsapp", "is_active"];

function readPlan(body, { partial = false } = {}) {
  const plan = {};
  for (const f of PLAN_FIELDS) if (body[f] !== undefined) plan[f] = body[f];
  if (!partial || plan.name !== undefined) {
    plan.name = String(plan.name || "").trim();
    if (!plan.name) throw bad("Plan name is required");
  }
  for (const f of ["price_monthly", "price_yearly"]) {
    if (plan[f] === undefined) continue;
    const n = Number(plan[f] === "" ? 0 : plan[f]);
    if (!Number.isFinite(n) || n < 0) throw bad("Prices must be 0 or more");
    plan[f] = n;
  }
  for (const f of ["max_centres", "max_staff", "storage_mb"]) {
    if (plan[f] === undefined) continue;
    if (plan[f] === null || plan[f] === "") { plan[f] = null; continue; } // unlimited
    const n = Number(plan[f]);
    if (!Number.isInteger(n) || n < 0) throw bad("Limits must be whole numbers (leave empty for unlimited)");
    plan[f] = n;
  }
  for (const f of ["customer_portal", "whatsapp", "is_active"]) if (plan[f] !== undefined) plan[f] = Boolean(plan[f]);
  return plan;
}

const PLAN_SELECT = `
  SELECT p.*, (SELECT COUNT(*)::int FROM organizations o WHERE o.plan_id = p.id) AS organizations
    FROM plans p`;

router.get("/plans", wrap(async (req, res) => {
  const { rows } = await control().query(`${PLAN_SELECT} ORDER BY p.is_active DESC, p.price_monthly, p.id`);
  res.json(rows);
}));

router.post("/plans", wrap(async (req, res) => {
  const plan = readPlan(req.body || {});
  const cols = Object.keys(plan);
  try {
    const { rows } = await control().query(
      `INSERT INTO plans (${cols.join(", ")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(", ")}) RETURNING id`,
      cols.map((c) => plan[c])
    );
    res.status(201).json((await control().query(`${PLAN_SELECT} WHERE p.id = $1`, [rows[0].id])).rows[0]);
  } catch (err) {
    if (err.code === "23505") throw bad("A plan with this name already exists");
    throw err;
  }
}));

router.put("/plans/:id", wrap(async (req, res) => {
  const plan = readPlan(req.body || {}, { partial: true });
  const cols = Object.keys(plan);
  if (!cols.length) throw bad("Nothing to update");
  try {
    const { rowCount } = await control().query(
      `UPDATE plans SET ${cols.map((c, i) => `${c} = $${i + 1}`).join(", ")}, updated_at = now() WHERE id = $${cols.length + 1}`,
      [...cols.map((c) => plan[c]), req.params.id]
    );
    if (!rowCount) return res.status(404).json({ error: "Plan not found" });
  } catch (err) {
    if (err.code === "23505") throw bad("A plan with this name already exists");
    throw err;
  }
  // Organizations on this plan pick up the new limits within 30 seconds.
  const { rows: orgs } = await control().query("SELECT slug FROM organizations WHERE plan_id = $1", [req.params.id]);
  orgs.forEach((o) => forgetOrg(o.slug));
  if (plan.whatsapp === false) for (const o of orgs) await switchOffWhatsapp(o.slug);
  res.json((await control().query(`${PLAN_SELECT} WHERE p.id = $1`, [req.params.id])).rows[0]);
}));

/* ---------------- organizations ---------------- */

const ORG_SELECT = `
  SELECT o.id, o.name, o.slug, o.db_name, o.status, o.status_reason, o.plan_id, p.name AS plan_name,
         p.price_monthly, p.price_yearly, p.max_centres, p.max_staff, p.storage_mb, p.customer_portal, p.whatsapp,
         o.billing_cycle, to_char(o.trial_ends_at, 'YYYY-MM-DD') AS trial_ends_at,
         to_char(o.paid_until, 'YYYY-MM-DD') AS paid_until, o.grace_days, o.notes,
         o.contact_name, o.contact_phone, o.contact_email, o.created_at
    FROM organizations o
    LEFT JOIN plans p ON p.id = o.plan_id`;

function present(row, today = todayIST()) {
  const billing = billingState(row, today);
  const price = row.billing_cycle === "yearly" ? row.price_yearly : row.price_monthly;
  return {
    ...row,
    is_default: row.slug === DEFAULT_ORG_SLUG,
    billing,
    price: price != null ? Number(price) : null,
  };
}

/** Usage counts from the organization's own database (best effort). */
async function usageFor(slug) {
  const org = await getOrgBySlug(slug);
  if (!org) return null;
  const pool = poolFor(org);
  const safe = (p) => p.catch(() => null);
  const [centres, staff, customers, storage] = await Promise.all([
    safe(countUsage("centres", pool)),
    safe(countUsage("staff", pool)),
    safe(pool.query("SELECT COUNT(*)::int AS n FROM customers").then((r) => r.rows[0].n)),
    safe(orgStorageBytes(slug, { fresh: true })),
  ]);
  return { centres, staff, customers, storage_bytes: storage };
}

async function switchOffWhatsapp(slug) {
  const org = await getOrgBySlug(slug);
  if (!org) return;
  await poolFor(org).query("UPDATE communication_accounts SET is_active = false WHERE is_active = true").catch(() => {});
}

router.get("/summary", wrap(async (req, res) => {
  const { rows } = await control().query(ORG_SELECT);
  const orgs = rows.map((r) => present(r)).filter((o) => !o.is_default);
  const count = (fn) => orgs.filter(fn).length;
  const monthly = orgs
    .filter((o) => o.status === "active" && o.billing.state === "active" && o.price != null)
    .reduce((sum, o) => sum + (o.billing_cycle === "yearly" ? o.price / 12 : o.price), 0);
  const month = todayIST().slice(0, 7);
  const paid = await control().query(
    `SELECT COALESCE(SUM(amount), 0)::numeric AS total FROM payments WHERE to_char(paid_on, 'YYYY-MM') = $1`,
    [month]
  );
  res.json({
    organizations: orgs.length,
    active: count((o) => o.status === "active"),
    suspended: count((o) => o.status === "suspended"),
    in_trial: count((o) => o.billing.state === "trial"),
    due_soon: count((o) => ["active", "trial"].includes(o.billing.state) && o.billing.days_left <= 7),
    in_grace: count((o) => o.billing.state === "grace"),
    overdue: count((o) => o.billing.state === "overdue"),
    monthly_revenue: Math.round(monthly),
    collected_this_month: Number(paid.rows[0].total),
  });
}));

router.get("/orgs", wrap(async (req, res) => {
  const { rows } = await control().query(`${ORG_SELECT} ORDER BY o.id`);
  const list = await Promise.all(rows.map(async (r) => ({ ...present(r), usage: await usageFor(r.slug).catch(() => null) })));
  res.json(list);
}));

router.get("/orgs/:slug", wrap(async (req, res) => {
  const { rows } = await control().query(`${ORG_SELECT} WHERE o.slug = $1`, [req.params.slug]);
  if (!rows[0]) return res.status(404).json({ error: "Organization not found" });
  const payments = await control().query(
    `SELECT id, amount, to_char(paid_on, 'YYYY-MM-DD') AS paid_on, to_char(covers_until, 'YYYY-MM-DD') AS covers_until,
            method, reference, note, created_at
       FROM payments WHERE org_slug = $1 ORDER BY paid_on DESC, id DESC`,
    [req.params.slug]
  );
  res.json({ ...present(rows[0]), usage: await usageFor(req.params.slug), payments: payments.rows });
}));

router.post("/orgs", wrap(async (req, res) => {
  const b = req.body || {};
  const trialDays = b.trial_days === undefined || b.trial_days === "" ? 14 : Number(b.trial_days);
  if (!Number.isInteger(trialDays) || trialDays < 0 || trialDays > 365) throw bad("Trial days must be 0–365");
  const org = await createOrganization({
    name: b.name,
    slug: b.slug,
    adminUsername: b.admin_username,
    adminPassword: b.admin_password,
    adminName: b.admin_name || null,
    adminEmail: b.admin_email || null,
    phone: b.phone || null,
    planId: b.plan_id || null,
    billingCycle: b.billing_cycle || "monthly",
    trialEndsAt: trialDays > 0 ? addDays(todayIST(), trialDays) : null,
    graceDays: b.grace_days === undefined || b.grace_days === "" ? 7 : Number(b.grace_days),
    notes: b.notes || null,
  });
  res.status(201).json({ slug: org.slug });
}));

router.put("/orgs/:slug", wrap(async (req, res) => {
  const slug = req.params.slug;
  const b = req.body || {};
  const sets = [];
  const vals = [];
  const set = (col, v) => { vals.push(v); sets.push(`${col} = $${vals.length}`); };

  if (b.name !== undefined) { if (!String(b.name).trim()) throw bad("Name is required"); set("name", String(b.name).trim()); }
  for (const c of ["contact_name", "contact_phone", "contact_email", "notes"]) if (b[c] !== undefined) set(c, b[c] || null);

  const isDefault = slug === DEFAULT_ORG_SLUG;
  if (!isDefault) {
    if (b.plan_id !== undefined) set("plan_id", b.plan_id || null);
    if (b.billing_cycle !== undefined) {
      if (!["monthly", "yearly"].includes(b.billing_cycle)) throw bad("Billing cycle must be monthly or yearly");
      set("billing_cycle", b.billing_cycle);
    }
    for (const c of ["trial_ends_at", "paid_until"]) {
      if (b[c] === undefined) continue;
      if (b[c] && !isYMD(b[c])) throw bad("Dates must be YYYY-MM-DD");
      set(c, b[c] || null);
    }
    if (b.grace_days !== undefined) {
      const g = Number(b.grace_days);
      if (!Number.isInteger(g) || g < 0 || g > 90) throw bad("Grace days must be 0–90");
      set("grace_days", g);
    }
  }
  if (!sets.length) throw bad("Nothing to update");

  vals.push(slug);
  const { rowCount } = await control().query(`UPDATE organizations SET ${sets.join(", ")}, updated_at = now() WHERE slug = $${vals.length}`, vals);
  if (!rowCount) return res.status(404).json({ error: "Organization not found" });
  forgetOrg(slug);

  if (b.plan_id) {
    const plan = await control().query("SELECT whatsapp FROM plans WHERE id = $1", [b.plan_id]);
    if (plan.rows[0]?.whatsapp === false) await switchOffWhatsapp(slug);
  }
  res.json({ ok: true });
}));

router.post("/orgs/:slug/status", wrap(async (req, res) => {
  const slug = req.params.slug;
  const status = req.body?.status;
  if (!["active", "suspended"].includes(status)) throw bad("Status must be active or suspended");
  if (slug === DEFAULT_ORG_SLUG && status !== "active") throw bad("Your own organization can't be suspended");
  const reason = status === "suspended" ? String(req.body?.reason || "Suspended by platform admin").slice(0, 200) : null;
  const { rowCount } = await control().query(
    "UPDATE organizations SET status = $1, status_reason = $2, updated_at = now() WHERE slug = $3",
    [status, reason, slug]
  );
  if (!rowCount) return res.status(404).json({ error: "Organization not found" });
  forgetOrg(slug);
  res.json({ ok: true });
}));

/* ---------------- payments ---------------- */

router.post("/orgs/:slug/payments", wrap(async (req, res) => {
  const slug = req.params.slug;
  if (slug === DEFAULT_ORG_SLUG) throw bad("Your own organization isn't billed");
  const b = req.body || {};
  const amount = Number(b.amount);
  if (!Number.isFinite(amount) || amount < 0) throw bad("Amount must be 0 or more");
  const today = todayIST();
  const paidOn = b.paid_on || today;
  if (!isYMD(paidOn)) throw bad("Paid on must be YYYY-MM-DD");

  const client = await control().connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `SELECT billing_cycle, status, status_reason, to_char(paid_until, 'YYYY-MM-DD') AS paid_until,
              to_char(trial_ends_at, 'YYYY-MM-DD') AS trial_ends_at
         FROM organizations WHERE slug = $1 FOR UPDATE`,
      [slug]
    );
    const org = rows[0];
    if (!org) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Organization not found" });
    }

    // Default period: one billing cycle after what's already covered (or from today).
    let coversUntil = b.covers_until;
    if (coversUntil) {
      if (!isYMD(coversUntil)) throw bad("Covers until must be YYYY-MM-DD");
    } else {
      const covered = [org.paid_until, org.trial_ends_at].filter(Boolean).sort().pop();
      const start = covered && covered >= today ? covered : addDays(today, -1);
      coversUntil = addCycle(start, org.billing_cycle);
    }

    await client.query(
      `INSERT INTO payments (org_slug, amount, paid_on, covers_until, method, reference, note, recorded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [slug, amount, paidOn, coversUntil, b.method || null, b.reference || null, b.note || null, req.platformAdmin.id]
    );
    await client.query(
      `UPDATE organizations SET paid_until = GREATEST(COALESCE(paid_until, $2::date), $2::date), updated_at = now() WHERE slug = $1`,
      [slug, coversUntil]
    );
    // Suspended only for non-payment and now covered again: switch back on.
    const reactivate = org.status === "suspended" && org.status_reason === AUTO_SUSPEND_REASON && coversUntil >= today;
    if (reactivate) {
      await client.query("UPDATE organizations SET status = 'active', status_reason = NULL WHERE slug = $1", [slug]);
    }
    await client.query("COMMIT");
    forgetOrg(slug);
    res.status(201).json({ covers_until: coversUntil, reactivated: reactivate });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}));

/** Run the overdue check now (it also runs daily at 00:30 IST). */
router.post("/billing/run", wrap(async (req, res) => {
  res.json({ suspended: await suspendOverdueOrgs() });
}));

export default router;
