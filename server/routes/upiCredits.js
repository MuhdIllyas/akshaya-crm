// UPI payments caught by the companion phone (see services/upiCredits.js).
// Staff see their own centre's payments; a superadmin without a centre sees all
// (or one centre with ?centre_id=).
import express from "express";
import jwt from "jsonwebtoken";
import pool from "../db.js";
import { io } from "../tenancy/io.js";
import { scheduleForEachOrg, forEachOrg } from "../tenancy/jobs.js";
import { recordUpiCredit } from "../services/upiCredits.js";
import { parseAppNotification, parseBankCreditSms } from "../utils/upiCredit.js";
import {
  runUpiMatch, scheduleUpiMatch, openSaves, allocate, insertLinks, cents, EFFECTIVE_PAYMENT,
} from "../services/upiMatcher.js";

const router = express.Router();

router.use((req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err || user?.type === "device" || user?.role === "customer") {
      return res.status(403).json({ error: "Invalid token" });
    }
    req.user = { ...user, role: String(user.role || "").toLowerCase() };
    next();
  });
});

// supervisor checks the centre's payments too (centreScope keeps them to their own centre)
const isManager = (user) => ["admin", "superadmin", "supervisor"].includes(user.role);

const centreScope = (req, params) => {
  const { user } = req;
  if (user.role === "superadmin" && !user.centre_id) {
    const c = parseInt(req.query.centre_id, 10);
    if (Number.isNaN(c)) return "";
    params.push(c);
    return ` AND u.centre_id = $${params.length}`;
  }
  params.push(user.centre_id ?? -1);
  return ` AND u.centre_id = $${params.length}`;
};

const TODAY = `u.credited_at >= (date_trunc('day', NOW() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata')`;

/**
 * GET /api/upi-credits
 *   ?status=unclaimed|matched|ignored|all   (default: all)
 *   ?wallet_id=12
 *   ?window=today|7d|30d                    (default: today)
 *   ?unassigned=1   admins: payments that matched no wallet (to set wallets up)
 */
router.get("/", async (req, res) => {
  try {
    const params = [];
    let where = centreScope(req, params);

    const window = req.query.window;
    if (window === "7d") where += ` AND u.credited_at > NOW() - INTERVAL '7 days'`;
    else if (window === "30d") where += ` AND u.credited_at > NOW() - INTERVAL '30 days'`;
    else where += ` AND ${TODAY}`;

    if (req.query.unassigned === "1") {
      if (!isManager(req.user)) return res.status(403).json({ error: "Only admins can see this" });
      where += ` AND u.wallet_id IS NULL`;
    } else {
      where += ` AND u.wallet_id IS NOT NULL`;
    }

    const status = req.query.status;
    if (["unclaimed", "matched", "ignored"].includes(status)) {
      params.push(status);
      where += ` AND u.status = $${params.length}`;
    }

    const walletId = parseInt(req.query.wallet_id, 10);
    if (!Number.isNaN(walletId)) {
      params.push(walletId);
      where += ` AND u.wallet_id = $${params.length}`;
    }

    const { rows } = await pool.query(
      `SELECT u.id, u.centre_id, c.name AS centre_name, u.wallet_id, w.name AS wallet_name,
              u.source, u.amount::float AS amount, u.payer, u.utr, u.account_last4,
              u.credited_at, u.status, u.matched_payment_id, u.matched_at,
              ${isManager(req.user) ? "u.raw_text," : ""} u.created_at
         FROM upi_credits u
         LEFT JOIN wallets w ON w.id = u.wallet_id
         LEFT JOIN centres c ON c.id = u.centre_id
        WHERE TRUE${where}
        ORDER BY u.credited_at DESC
        LIMIT 500`,
      params
    );

    const summary = rows.reduce(
      (s, r) => {
        s.count += 1;
        s.total += r.amount;
        if (r.status === "unclaimed") { s.unclaimed += 1; s.unclaimed_total += r.amount; }
        return s;
      },
      { count: 0, total: 0, unclaimed: 0, unclaimed_total: 0 }
    );

    res.json({ credits: rows, summary });
  } catch (err) {
    console.error("UPI credits list error:", err.message);
    res.status(500).json({ error: "Failed to load UPI payments" });
  }
});

/**
 * POST /api/upi-credits/:id/ignore   { ignore: true|false }
 * Admins mark a credit as not a customer payment (own transfer, refund…), or undo.
 */
router.post("/:id/ignore", async (req, res) => {
  if (!isManager(req.user)) return res.status(403).json({ error: "Only admins can do this" });
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const ignore = req.body?.ignore !== false;
  try {
    const params = [id];
    const scope = centreScope({ ...req, query: {} }, params);
    const { rows } = await pool.query(
      `UPDATE upi_credits u
          SET status = $${params.length + 1}, matched_by = $${params.length + 2}, matched_at = NOW()
        WHERE u.id = $1 AND u.status <> 'matched'${scope}
        RETURNING u.id, u.centre_id, u.status`,
      [...params, ignore ? "ignored" : "unclaimed", req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Payment not found, or already linked to an entry" });
    io.to(`centre:${rows[0].centre_id}`).emit("centre_upi_credit_updated", rows[0]);
    res.json(rows[0]);
  } catch (err) {
    console.error("UPI credit ignore error:", err.message);
    res.status(500).json({ error: "Failed to update payment" });
  }
});

// ---------- UPI Payments page: links between payments and saves ----------

/** Centre filter on any alias (u for upi_credits, w for wallets). */
const centreFilter = (req, params, alias) => {
  const { user } = req;
  if (user.role === "superadmin" && !user.centre_id) {
    const c = parseInt(req.query.centre_id ?? req.body?.centre_id, 10);
    if (Number.isNaN(c)) return "";
    params.push(c);
    return ` AND ${alias}.centre_id = $${params.length}`;
  }
  params.push(user.centre_id ?? -1);
  return ` AND ${alias}.centre_id = $${params.length}`;
};

/** IST day [start, end) for ?date=YYYY-MM-DD (default today). */
const dayBounds = (date) => {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(String(date || "")) ? date : null;
  const day = d ? `'${d}'::date` : `(NOW() AT TIME ZONE 'Asia/Kolkata')::date`;
  return {
    start: `((${day})::timestamp AT TIME ZONE 'Asia/Kolkata')`,
    end: `(((${day}) + 1)::timestamp AT TIME ZONE 'Asia/Kolkata')`,
  };
};

const ENTRY_COLUMNS = `
  se.id AS entry_id, se.customer_name, se.phone,
  COALESCE(s.name, 'Service') AS service_name, st.name AS staff_name`;
const ENTRY_JOINS = `
  JOIN service_entries se ON se.id = p.service_entry_id
  LEFT JOIN services s ON s.id = se.category_id
  LEFT JOIN staff st ON st.id = se.staff_id`;

/** Rows of one save → { customers, services, staff } for display. */
const describeSave = (rows) => ({
  customers: [...new Set(rows.map((r) => r.customer_name).filter(Boolean))],
  phones: [...new Set(rows.map((r) => r.phone).filter(Boolean))],
  services: rows.map((r) => ({ entry_id: r.entry_id, name: r.service_name })),
  staff_name: rows.find((r) => r.staff_name)?.staff_name || null,
});

/**
 * GET /api/upi-credits/board?date=YYYY-MM-DD[&centre_id=]
 *   credits: the day's UPI payments, each with the save(s) it is linked to
 *   not_verified: the day's saves with money in a UPI wallet not yet covered
 */
router.get("/board", async (req, res) => {
  try {
    // UPI payments are deleted at the end of each day (see the cleanup job
    // below), so an earlier day has nothing to show — and its entries must
    // not be listed as "not verified" just because their payments are gone.
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const asked = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.date || "")) ? req.query.date : today;
    if (asked < today) {
      return res.json({
        cleared: true,
        credits: [],
        not_verified: [],
        summary: { received: 0, count: 0, linked: 0, unclaimed: 0, unclaimed_total: 0, not_verified: 0, not_verified_total: 0 },
      });
    }
    const { start, end } = dayBounds(req.query.date);

    const cParams = [];
    const cScope = centreFilter(req, cParams, "u");
    const { rows: credits } = await pool.query(
      `SELECT u.id, u.centre_id, u.wallet_id, w.name AS wallet_name, u.source,
              u.amount::float AS amount, u.payer, u.utr, u.credited_at, u.status, u.no_auto,
              u.matched_by, mb.name AS matched_by_name
         FROM upi_credits u
         JOIN wallets w ON w.id = u.wallet_id
         LEFT JOIN staff mb ON mb.id = u.matched_by
        WHERE u.credited_at >= ${start} AND u.credited_at < ${end}${cScope}
        ORDER BY u.credited_at DESC`,
      cParams
    );

    const ids = credits.map((c) => c.id);
    const { rows: links } = ids.length
      ? await pool.query(
          `SELECT l.credit_id, l.amount::float AS amount, l.linked_by,
                  p.id AS payment_id, p.amount::float AS payment_amount, p.wallet_id,
                  p.created_at::text AS save_key, p.created_at AS saved_at, ${ENTRY_COLUMNS}
             FROM upi_credit_links l
             JOIN payments p ON p.id = l.payment_id
             ${ENTRY_JOINS}
            WHERE l.credit_id = ANY($1::bigint[])
            ORDER BY p.id`,
          [ids]
        )
      : { rows: [] };

    const linksByCredit = new Map();
    for (const l of links) {
      if (!linksByCredit.has(l.credit_id)) linksByCredit.set(l.credit_id, []);
      linksByCredit.get(l.credit_id).push(l);
    }
    const creditsOut = credits.map((c) => {
      const ls = linksByCredit.get(c.id) || [];
      const saves = new Map();
      for (const l of ls) {
        if (!saves.has(l.save_key)) saves.set(l.save_key, { save_key: l.save_key, saved_at: l.saved_at, wallet_id: l.wallet_id, rows: [] });
        saves.get(l.save_key).rows.push(l);
      }
      return {
        ...c,
        linked: [...saves.values()].map((s) => ({
          save_key: s.save_key,
          saved_at: s.saved_at,
          wallet_id: s.wallet_id,
          amount: s.rows.reduce((t, r) => t + r.amount, 0),
          manual: s.rows.some((r) => r.linked_by),
          ...describeSave(s.rows),
        })),
      };
    });

    const pParams = [];
    const pScope = centreFilter(req, pParams, "w");
    const { rows: payRows } = await pool.query(
      `SELECT p.id, p.wallet_id, w.name AS wallet_name, p.amount::float AS amount,
              (p.amount - COALESCE((SELECT SUM(l.amount) FROM upi_credit_links l WHERE l.payment_id = p.id), 0))::float AS open,
              p.created_at::text AS save_key, p.created_at AS saved_at, ${ENTRY_COLUMNS}
         FROM payments p
         JOIN wallets w ON w.id = p.wallet_id
         ${ENTRY_JOINS}
        WHERE cardinality(COALESCE(w.upi_match_sources, '{}')) > 0
          AND p.created_at::timestamptz >= ${start} AND p.created_at::timestamptz < ${end}
          AND ${EFFECTIVE_PAYMENT}${pScope}
        ORDER BY p.created_at DESC, p.id`,
      pParams
    );
    const open = new Map();
    for (const r of payRows) {
      const key = `${r.wallet_id}|${r.save_key}`;
      if (!open.has(key)) open.set(key, { wallet_id: r.wallet_id, wallet_name: r.wallet_name, save_key: r.save_key, saved_at: r.saved_at, rows: [] });
      open.get(key).rows.push(r);
    }
    const notVerified = [...open.values()]
      .map((s) => ({
        wallet_id: s.wallet_id,
        wallet_name: s.wallet_name,
        save_key: s.save_key,
        saved_at: s.saved_at,
        amount: s.rows.reduce((t, r) => t + r.amount, 0),
        open: Math.round(s.rows.reduce((t, r) => t + r.open, 0) * 100) / 100,
        ...describeSave(s.rows),
      }))
      .filter((s) => s.open > 0.004);

    const summary = {
      received: creditsOut.reduce((t, c) => t + c.amount, 0),
      count: creditsOut.length,
      linked: creditsOut.filter((c) => c.status === "matched").length,
      unclaimed: creditsOut.filter((c) => c.status === "unclaimed").length,
      unclaimed_total: creditsOut.filter((c) => c.status === "unclaimed").reduce((t, c) => t + c.amount, 0),
      not_verified: notVerified.length,
      not_verified_total: notVerified.reduce((t, s) => t + s.open, 0),
    };

    res.json({ credits: creditsOut, not_verified: notVerified, summary });
  } catch (err) {
    console.error("UPI board error:", err.message);
    res.status(500).json({ error: "Failed to load UPI payments" });
  }
});

const lockMatcher = (client) => client.query(`SELECT pg_advisory_xact_lock(hashtext('upi_matcher'))`);

/**
 * POST /api/upi-credits/link  { credit_ids: [..], wallet_id, save_key | save_keys: [..] }
 * Link UPI payment(s) to one save, or one payment to several saves, by hand.
 * They must add up to exactly what the save(s) still have open in that wallet.
 */
router.post("/link", async (req, res) => {
  const creditIds = [...new Set((req.body?.credit_ids || []).map((v) => parseInt(v, 10)).filter(Number.isInteger))];
  const walletId = parseInt(req.body?.wallet_id, 10);
  // One entry (save_key), or several (save_keys) when one payment covers
  // entries two staff saved separately for the same customer.
  const saveKeys = [...new Set(
    (Array.isArray(req.body?.save_keys) ? req.body.save_keys : [req.body?.save_key]).map((k) => String(k || "")).filter(Boolean)
  )];
  if (!creditIds.length || Number.isNaN(walletId) || !saveKeys.length || saveKeys.length > 5) {
    return res.status(400).json({ error: "Choose the UPI payment(s) and the entry to link" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await lockMatcher(client);

    const params = [creditIds];
    const scope = centreFilter(req, params, "u");
    const { rows: credits } = await client.query(
      `SELECT u.id, u.centre_id, u.wallet_id, u.amount, u.status,
              (extract(epoch FROM u.credited_at) * 1000)::float8 AS t
         FROM upi_credits u
        WHERE u.id = ANY($1::int[])${scope}
          AND NOT EXISTS (SELECT 1 FROM upi_credit_links l WHERE l.credit_id = u.id)
        FOR UPDATE`,
      params
    );
    if (credits.length !== creditIds.length || credits.some((c) => c.status !== "unclaimed")) {
      throw Object.assign(new Error("One of these UPI payments is already linked or not in your centre"), { status: 409 });
    }
    if (credits.some((c) => Number(c.wallet_id) !== walletId)) {
      throw Object.assign(new Error("The UPI payment and the entry are in different wallets"), { status: 400 });
    }

    const saves = [];
    for (const key of saveKeys) {
      const [save] = await openSaves(client, walletId, { sinceSql: `NOW() - INTERVAL '60 days'`, key });
      if (!save) {
        throw Object.assign(
          new Error(saveKeys.length > 1 ? "One of these entries has nothing left to link in that wallet" : "This entry has nothing left to link in that wallet"),
          { status: 409 }
        );
      }
      saves.push(save);
    }
    saves.sort((a, b) => a.t - b.t);
    const open = saves.reduce((t, s) => t + s.openCents, 0);
    const rows = saves.flatMap((s) => s.rows);

    const total = credits.reduce((t, c) => t + cents(c.amount), 0);
    if (total !== open) {
      const what = saves.length > 1 ? "these entries have" : "the entry has";
      throw Object.assign(
        new Error(`The UPI payments add up to ₹${(total / 100).toFixed(2)}, but ${what} ₹${(open / 100).toFixed(2)} in this wallet. Fix the entry's amount first.`),
        { status: 400 }
      );
    }

    await insertLinks(
      client,
      allocate(rows, credits.map((c) => ({ id: c.id, amountCents: cents(c.amount), t: Number(c.t) }))),
      req.user.id
    );
    await client.query(
      `UPDATE upi_credits SET status = 'matched', matched_at = NOW(), matched_by = $2,
              matched_payment_id = $3, no_auto = FALSE
        WHERE id = ANY($1::int[])`,
      [creditIds, req.user.id, rows[0].id]
    );
    await client.query("COMMIT");

    io.to(`centre:${credits[0].centre_id}`).emit("upi_links_updated", { centre_id: credits[0].centre_id });
    res.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    if (!err.status) console.error("UPI link error:", err.message);
    res.status(err.status || 500).json({ error: err.status ? err.message : "Failed to link payment" });
  } finally {
    client.release();
  }
});

/**
 * POST /api/upi-credits/:id/unlink
 * Undo a link. Every UPI payment linked to the same save is unlinked too, and
 * all of them are kept out of automatic linking until someone links them by hand.
 */
router.post("/:id/unlink", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await lockMatcher(client);

    const params = [id];
    const scope = centreFilter(req, params, "u");
    const { rows: own } = await client.query(`SELECT u.id, u.centre_id FROM upi_credits u WHERE u.id = $1${scope}`, params);
    if (!own.length) throw Object.assign(new Error("Payment not found"), { status: 404 });

    // All credits that share a save with this one
    const { rows: group } = await client.query(
      `WITH saves AS (
         SELECT DISTINCT p.wallet_id, p.created_at
           FROM upi_credit_links l JOIN payments p ON p.id = l.payment_id
          WHERE l.credit_id = $1
       )
       SELECT DISTINCT l.credit_id
         FROM upi_credit_links l
         JOIN payments p ON p.id = l.payment_id
         JOIN saves s ON s.wallet_id = p.wallet_id AND s.created_at = p.created_at
       UNION SELECT $1::bigint`,
      [id]
    );
    const ids = group.map((g) => g.credit_id);
    await client.query(`DELETE FROM upi_credit_links WHERE credit_id = ANY($1::bigint[])`, [ids]);
    await client.query(
      `UPDATE upi_credits SET status = 'unclaimed', matched_at = NULL, matched_by = NULL,
              matched_payment_id = NULL, no_auto = TRUE
        WHERE id = ANY($1::bigint[]) AND status = 'matched'`,
      [ids]
    );
    await client.query("COMMIT");

    io.to(`centre:${own[0].centre_id}`).emit("upi_links_updated", { centre_id: own[0].centre_id });
    res.json({ ok: true, unlinked: ids.length });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    if (!err.status) console.error("UPI unlink error:", err.message);
    res.status(err.status || 500).json({ error: err.status ? err.message : "Failed to unlink payment" });
  } finally {
    client.release();
  }
});

/**
 * GET /api/upi-credits/unclaimed?wallet_id=62[&hours=3]
 * For the Service Entry picker: this wallet's UPI payments not linked to any
 * entry yet, newest first.
 */
router.get("/unclaimed", async (req, res) => {
  const walletId = parseInt(req.query.wallet_id, 10);
  if (Number.isNaN(walletId)) return res.status(400).json({ error: "wallet_id is required" });
  const hours = Math.min(Math.max(parseInt(req.query.hours, 10) || 3, 1), 48);
  try {
    const params = [walletId, hours];
    const scope = centreFilter(req, params, "u");
    const { rows } = await pool.query(
      `SELECT u.id, u.amount::float AS amount, u.payer, u.source, u.utr, u.credited_at
         FROM upi_credits u
        WHERE u.wallet_id = $1 AND u.status = 'unclaimed'
          AND u.credited_at > NOW() - ($2 || ' hours')::interval
          AND NOT EXISTS (SELECT 1 FROM upi_credit_links l WHERE l.credit_id = u.id)${scope}
        ORDER BY u.credited_at DESC
        LIMIT 20`,
      params
    );
    res.json({ credits: rows });
  } catch (err) {
    console.error("UPI unclaimed error:", err.message);
    res.status(500).json({ error: "Failed to load UPI payments" });
  }
});

/**
 * POST /api/upi-credits/link-entry  { credit_ids: [..], entry_ids: [..], wallet_id }
 * Used right after Service Entry saves, with the payments the staff ticked.
 * Finds that save's payment rows in the wallet and links the ticked payments.
 * If the automatic matcher already linked other payments to the same save a
 * moment earlier, those are put back (staff's choice wins over the automatic one).
 */
router.post("/link-entry", async (req, res) => {
  const creditIds = [...new Set((req.body?.credit_ids || []).map((v) => parseInt(v, 10)).filter(Number.isInteger))];
  const entryIds = [...new Set((req.body?.entry_ids || []).map((v) => parseInt(v, 10)).filter(Number.isInteger))];
  const walletId = parseInt(req.body?.wallet_id, 10);
  if (!creditIds.length || !entryIds.length || Number.isNaN(walletId)) {
    return res.status(400).json({ error: "Choose the UPI payment(s) and the entry to link" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await lockMatcher(client);

    // The save = the newest group of this entry's payment rows in that wallet
    const { rows: saveRows } = await client.query(
      `SELECT p.created_at::text AS save_key
         FROM payments p
         JOIN wallets w ON w.id = p.wallet_id
        WHERE p.service_entry_id = ANY($1::int[]) AND p.wallet_id = $2 AND ${EFFECTIVE_PAYMENT}
        ORDER BY p.created_at DESC
        LIMIT 1`,
      [entryIds, walletId]
    );
    if (!saveRows.length) throw Object.assign(new Error("This entry has no payment in that wallet"), { status: 404 });
    const saveKey = saveRows[0].save_key;

    // Payments the matcher linked to this save on its own: put them back
    const { rows: existing } = await client.query(
      `SELECT DISTINCT l.credit_id, bool_or(l.linked_by IS NOT NULL) AS manual
         FROM upi_credit_links l JOIN payments p ON p.id = l.payment_id
        WHERE p.wallet_id = $1 AND p.created_at::text = $2
        GROUP BY l.credit_id`,
      [walletId, saveKey]
    );
    const already = existing.map((e) => Number(e.credit_id));
    if (already.length && already.every((id) => creditIds.includes(id)) && creditIds.every((id) => already.includes(id))) {
      await client.query("COMMIT");
      return res.json({ ok: true, already: true });
    }
    if (existing.some((e) => e.manual)) {
      throw Object.assign(new Error("Someone already linked a payment to this entry by hand"), { status: 409 });
    }
    if (already.length) {
      await client.query(`DELETE FROM upi_credit_links WHERE credit_id = ANY($1::bigint[])`, [already]);
      await client.query(
        `UPDATE upi_credits SET status = 'unclaimed', matched_at = NULL, matched_by = NULL, matched_payment_id = NULL
          WHERE id = ANY($1::bigint[])`,
        [already]
      );
    }

    const params = [creditIds];
    const scope = centreFilter(req, params, "u");
    const { rows: credits } = await client.query(
      `SELECT u.id, u.centre_id, u.wallet_id, u.amount, u.status,
              (extract(epoch FROM u.credited_at) * 1000)::float8 AS t
         FROM upi_credits u
        WHERE u.id = ANY($1::int[])${scope}
          AND NOT EXISTS (SELECT 1 FROM upi_credit_links l WHERE l.credit_id = u.id)
        FOR UPDATE`,
      params
    );
    if (credits.length !== creditIds.length || credits.some((c) => c.status !== "unclaimed")) {
      throw Object.assign(new Error("One of these UPI payments was just linked to another entry"), { status: 409 });
    }
    if (credits.some((c) => Number(c.wallet_id) !== walletId)) {
      throw Object.assign(new Error("The UPI payment and the entry are in different wallets"), { status: 400 });
    }

    const [save] = await openSaves(client, walletId, { sinceSql: `NOW() - INTERVAL '60 days'`, key: saveKey });
    if (!save) throw Object.assign(new Error("This entry has nothing left to link in that wallet"), { status: 409 });
    const total = credits.reduce((t, c) => t + cents(c.amount), 0);
    if (total !== save.openCents) {
      throw Object.assign(
        new Error(`The UPI payments add up to ₹${(total / 100).toFixed(2)}, but the entry has ₹${(save.openCents / 100).toFixed(2)} in this wallet`),
        { status: 400 }
      );
    }

    await insertLinks(
      client,
      allocate(save.rows, credits.map((c) => ({ id: c.id, amountCents: cents(c.amount), t: Number(c.t) }))),
      req.user.id
    );
    await client.query(
      `UPDATE upi_credits SET status = 'matched', matched_at = NOW(), matched_by = $2,
              matched_payment_id = $3, no_auto = FALSE
        WHERE id = ANY($1::int[])`,
      [creditIds, req.user.id, save.rows[0].id]
    );
    await client.query("COMMIT");

    io.to(`centre:${credits[0].centre_id}`).emit("upi_links_updated", { centre_id: credits[0].centre_id });
    if (already.length) scheduleUpiMatch(); // the put-back payments may fit another entry
    res.json({ ok: true, replaced: already.length });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    if (!err.status) console.error("UPI link-entry error:", err.message);
    res.status(err.status || 500).json({ error: err.status ? err.message : "Failed to link payment" });
  } finally {
    client.release();
  }
});

// Backup pass: link UPI payments to saves every minute, in case a save or a
// payment was missed by the run that follows it.
scheduleForEachOrg("* * * * *", async () => {
  await runUpiMatch();
}, { timezone: "Asia/Kolkata" });

// UPI payments are kept for the day only, like OTPs. Everything from before
// today (IST) is deleted: the payments, their links to entries, the bank SMS
// they came from and the raw app notifications. The service entries and
// their payment rows are not touched. Runs every hour (from 00:05), so a
// server that was down at midnight still clears yesterday on its next run.
const TODAY_START = `(date_trunc('day', NOW() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata')`;

export async function clearOldUpiData() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Wait for a matcher run in progress, so it doesn't link a payment being deleted.
    await client.query(`SELECT pg_advisory_xact_lock(hashtext('upi_matcher'))`);
    const { rows: old } = await client.query(
      `SELECT id, sms_log_id FROM upi_credits WHERE created_at < ${TODAY_START}`
    );
    const ids = old.map((r) => r.id);
    const smsIds = old.map((r) => r.sms_log_id).filter(Boolean);
    if (ids.length) {
      await client.query(`DELETE FROM upi_credit_links WHERE credit_id = ANY($1::bigint[])`, [ids]);
      await client.query(`DELETE FROM upi_credits WHERE id = ANY($1::bigint[])`, [ids]);
    }
    if (smsIds.length) {
      await client.query(`DELETE FROM companion_sms_logs WHERE id = ANY($1::bigint[]) AND is_otp = FALSE`, [smsIds]);
    }
    const notes = await client.query(`DELETE FROM companion_notification_logs WHERE received_at < ${TODAY_START}`);
    await client.query("COMMIT");
    if (ids.length || notes.rowCount) {
      console.log(`[upi] cleared ${ids.length} UPI payment(s), ${smsIds.length} bank SMS, ${notes.rowCount} notification(s) from earlier days`);
    }
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

scheduleForEachOrg("5 * * * *", clearOldUpiData, { timezone: "Asia/Kolkata" });

// Today's phone messages that did not become a payment are read again when the
// server starts. After a fix to how a message is read (e.g. a new wording from
// a UPI app), the day's missed payments then still turn up and link to their
// entries. Old payments are saved without a live alert.
export async function catchUpTodaysMessages() {
  let found = 0;
  const { rows: notes } = await pool.query(
    `SELECT n.id, n.centre_id, n.device_id, n.package, n.title, n.body,
            COALESCE(n.posted_at, n.received_at) AS at
       FROM companion_notification_logs n
      WHERE n.received_at >= ${TODAY_START}
        AND NOT EXISTS (SELECT 1 FROM upi_credits u WHERE u.notification_log_id = n.id)
      ORDER BY n.id`
  );
  for (const n of notes) {
    const credit = parseAppNotification(n.package, n.title, n.body);
    if (!credit) continue;
    const saved = await recordUpiCredit({
      centreId: n.centre_id, deviceId: n.device_id, credit, creditedAt: n.at,
      rawText: [n.title, n.body].filter(Boolean).join(" — "), notificationLogId: n.id, quiet: true,
    });
    if (saved) found++;
  }
  const { rows: sms } = await pool.query(
    `SELECT s.id, s.centre_id, s.device_id, s.sender, s.message, s.received_at AS at
       FROM companion_sms_logs s
      WHERE s.received_at >= ${TODAY_START} AND s.is_otp = FALSE
        AND NOT EXISTS (SELECT 1 FROM upi_credits u WHERE u.sms_log_id = s.id)
      ORDER BY s.id`
  );
  for (const s of sms) {
    const credit = parseBankCreditSms(s.sender, s.message);
    if (!credit) continue;
    const saved = await recordUpiCredit({
      centreId: s.centre_id, deviceId: s.device_id, credit, creditedAt: s.at,
      rawText: s.message, smsLogId: s.id, quiet: true,
    });
    if (saved) found++;
  }
  if (found) {
    console.log(`[upi] read ${found} earlier message(s) from today as UPI payments`);
    await runUpiMatch(); // links them and tells the centres
  }
}

setTimeout(() => forEachOrg("upi catch-up", catchUpTodaysMessages), 15000);

export default router;
