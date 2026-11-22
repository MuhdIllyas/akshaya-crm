// Links UPI payments the companion phone caught (upi_credits) to the payments
// staff entered on service entries.
//
// A "save" is everything one Save click wrote: a single entry, a quick service
// or a bulk cart. All its payment rows share the same created_at, so rows are
// grouped by (wallet, created_at). For each save, the money that went into a
// UPI wallet must be covered by UPI payments in that wallet that add up to
// exactly that total:
//   one GPay ₹2200          → passport ₹2000 + PAN ₹200 (one save)
//   GPay ₹2000 + cash ₹200  → only the ₹2000 in the UPI wallet is checked
//   ₹1000 + ₹1200           → both linked to the one ₹2200 save
// UPI payments from 3 hours before to 3 hours after the save are considered;
// if several fit, the closest in time wins.
//
// runUpiMatch() is safe to call any time (after a save, when a payment
// arrives, every minute): only one run works at a time per organization.
import pool from "../db.js";
import { io } from "../tenancy/io.js";
import { currentTenant, runWithTenant } from "../tenancy/context.js";

export const WINDOW_MS = 3 * 60 * 60 * 1000;
const LOOKBACK = "2 days";
const MAX_CANDIDATES = 25; // per save, closest in time first
const LOCK_KEY = "upi_matcher";

export const cents = (v) => Math.round(Number(v) * 100);
const rupees = (c) => (c / 100).toFixed(2);

/** A payment row that counts as money received (not pending, not reversed). */
export const EFFECTIVE_PAYMENT = `
  p.status = 'received'
  AND COALESCE(p.is_reversal, FALSE) = FALSE
  AND NOT EXISTS (
    SELECT 1 FROM wallet_transactions wt
    WHERE wt.reference_payment_id = p.id AND COALESCE(wt.is_reversal, FALSE) = TRUE
  )`;

/**
 * The best set of 1–3 credits whose amounts add up to exactly `targetCents`.
 * `candidates`: [{ id, amountCents, t }] with t = ms since epoch.
 * Fewer payments win over more; then the smallest time gap to the save.
 */
export function findCombo(candidates, targetCents, saveTime) {
  const gap = (c) => Math.abs(c.t - saveTime);
  const list = [...candidates].sort((a, b) => gap(a) - gap(b)).slice(0, MAX_CANDIDATES);
  const score = (combo) => Math.max(...combo.map(gap));

  const single = list.find((c) => c.amountCents === targetCents);
  if (single) return [single];

  let best = null;
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      if (list[i].amountCents + list[j].amountCents !== targetCents) continue;
      const combo = [list[i], list[j]];
      if (!best || score(combo) < score(best)) best = combo;
    }
  }
  if (best) return best;

  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const ij = list[i].amountCents + list[j].amountCents;
      if (ij >= targetCents) continue;
      for (let k = j + 1; k < list.length; k++) {
        if (ij + list[k].amountCents !== targetCents) continue;
        const combo = [list[i], list[j], list[k]];
        if (!best || score(combo) < score(best)) best = combo;
      }
    }
  }
  return best;
}

/**
 * Spread credits over the save's open payment rows, oldest credit first.
 * rows: [{ id, openCents }], credits: [{ id, amountCents, t }]
 * Returns [{ creditId, paymentId, amountCents }]. Totals must already be equal.
 */
export function allocate(rows, credits) {
  const links = [];
  const pool_ = [...credits].sort((a, b) => a.t - b.t).map((c) => ({ ...c, left: c.amountCents }));
  for (const row of rows) {
    let need = row.openCents;
    for (const c of pool_) {
      if (need <= 0) break;
      if (c.left <= 0) continue;
      const take = Math.min(need, c.left);
      links.push({ creditId: c.id, paymentId: row.id, amountCents: take });
      c.left -= take;
      need -= take;
    }
  }
  return links;
}

export async function insertLinks(client, links, linkedBy = null) {
  for (const l of links) {
    await client.query(
      `INSERT INTO upi_credit_links (credit_id, payment_id, amount, linked_by) VALUES ($1, $2, $3, $4)`,
      [l.creditId, l.paymentId, rupees(l.amountCents), linkedBy]
    );
  }
}

/**
 * Open (not yet covered) payment rows of saves in one wallet.
 * Returns saves: [{ key, t, rows: [{ id, openCents }], openCents }], oldest first.
 * `key` is the save's created_at as text: the same for every row of one save.
 */
export async function openSaves(client, walletId, { sinceSql = `NOW() - INTERVAL '${LOOKBACK}'`, key = null } = {}) {
  const params = [walletId];
  let keyFilter = "";
  if (key !== null) {
    params.push(key);
    keyFilter = ` AND p.created_at::text = $${params.length}`;
  }
  const { rows } = await client.query(
    `SELECT p.id, p.amount, p.created_at::text AS save_key,
            (extract(epoch FROM p.created_at::timestamptz) * 1000)::float8 AS t,
            p.amount - COALESCE((SELECT SUM(l.amount) FROM upi_credit_links l WHERE l.payment_id = p.id), 0) AS open
       FROM payments p
      WHERE p.wallet_id = $1
        AND p.created_at::timestamptz > ${sinceSql}
        AND ${EFFECTIVE_PAYMENT}${keyFilter}
      ORDER BY p.created_at, p.id`,
    params
  );
  const byKey = new Map();
  for (const r of rows) {
    const openCents = cents(r.open);
    if (openCents <= 0) continue;
    if (!byKey.has(r.save_key)) byKey.set(r.save_key, { key: r.save_key, t: Number(r.t), rows: [], openCents: 0 });
    const s = byKey.get(r.save_key);
    s.rows.push({ id: r.id, openCents });
    s.openCents += openCents;
  }
  return [...byKey.values()];
}

/** Undo links that no longer hold (payment corrected/deleted), and fix statuses. */
async function releaseBrokenLinks(client) {
  // A credit whose links don't add up to its amount (a linked row was deleted),
  // or that covers a row which is no longer received money, goes back to
  // unclaimed as a whole, so the matcher can link it again properly.
  const { rows } = await client.query(
    `WITH broken AS (
       SELECT u.id FROM upi_credits u
        WHERE u.status = 'matched'
          AND (
            COALESCE((SELECT SUM(l.amount) FROM upi_credit_links l WHERE l.credit_id = u.id), 0) <> u.amount
            OR EXISTS (
              SELECT 1 FROM upi_credit_links l JOIN payments p ON p.id = l.payment_id
               WHERE l.credit_id = u.id AND NOT (${EFFECTIVE_PAYMENT})
            )
          )
     ), gone AS (
       DELETE FROM upi_credit_links l USING broken b WHERE l.credit_id = b.id RETURNING l.credit_id
     )
     UPDATE upi_credits u
        SET status = 'unclaimed', matched_at = NULL, matched_by = NULL, matched_payment_id = NULL
      FROM broken b
      WHERE u.id = b.id
      RETURNING u.id, u.centre_id`
  );
  return rows;
}

/** One matching pass for the current organization. Returns centres that changed. */
export async function runUpiMatch() {
  const client = await pool.connect();
  const changedCentres = new Set();
  try {
    await client.query("BEGIN");
    const lock = await client.query(`SELECT pg_try_advisory_xact_lock(hashtext($1)) AS ok`, [LOCK_KEY]);
    if (!lock.rows[0].ok) {
      await client.query("ROLLBACK");
      return { skipped: true, changedCentres: [] };
    }

    for (const r of await releaseBrokenLinks(client)) changedCentres.add(r.centre_id);

    const { rows: wallets } = await client.query(
      `SELECT DISTINCT u.wallet_id AS id, w.centre_id
         FROM upi_credits u JOIN wallets w ON w.id = u.wallet_id
        WHERE u.status = 'unclaimed' AND NOT u.no_auto
          AND u.credited_at > NOW() - INTERVAL '${LOOKBACK}'
          AND NOT EXISTS (SELECT 1 FROM upi_credit_links l WHERE l.credit_id = u.id)`
    );

    for (const wallet of wallets) {
      const { rows: creditRows } = await client.query(
        `SELECT u.id, u.amount, (extract(epoch FROM u.credited_at) * 1000)::float8 AS t
           FROM upi_credits u
          WHERE u.wallet_id = $1 AND u.status = 'unclaimed' AND NOT u.no_auto
            AND u.credited_at > NOW() - INTERVAL '${LOOKBACK}'
            AND NOT EXISTS (SELECT 1 FROM upi_credit_links l WHERE l.credit_id = u.id)
          ORDER BY u.credited_at`,
        [wallet.id]
      );
      let credits = creditRows.map((c) => ({ id: c.id, amountCents: cents(c.amount), t: Number(c.t) }));
      if (!credits.length) continue;

      const saves = await openSaves(client, wallet.id);
      for (const save of saves) {
        if (!credits.length) break;
        const nearby = credits.filter((c) => Math.abs(c.t - save.t) <= WINDOW_MS);
        const combo = findCombo(nearby, save.openCents, save.t);
        if (!combo) continue;

        await insertLinks(client, allocate(save.rows, combo));
        const ids = combo.map((c) => c.id);
        await client.query(
          `UPDATE upi_credits SET status = 'matched', matched_at = NOW(), matched_by = NULL,
                  matched_payment_id = $2
            WHERE id = ANY($1::bigint[])`,
          [ids, save.rows[0].id]
        );
        credits = credits.filter((c) => !ids.includes(c.id));
        changedCentres.add(wallet.centre_id);
      }
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  for (const centreId of changedCentres) {
    io.to(`centre:${centreId}`).emit("upi_links_updated", { centre_id: centreId });
  }
  return { skipped: false, changedCentres: [...changedCentres] };
}

// ---------- Scheduling ----------

// Several saves in a row cause one run, a moment later, per organization.
const pending = new Map(); // org key → timer

/** Ask for a matching pass soon (after a save, a new payment…). Never throws. */
export function scheduleUpiMatch(delayMs = 400) {
  const org = currentTenant();
  const key = org?.slug || org?.id || "default";
  if (pending.has(key)) return;
  pending.set(
    key,
    setTimeout(() => {
      pending.delete(key);
      const run = () =>
        runUpiMatch()
          .then((r) => { if (r.skipped) scheduleUpiMatch(2000); })
          .catch((err) => console.error("❌ UPI matcher failed:", err.message));
      if (org) runWithTenant(org, run);
      else run();
    }, delayMs)
  );
}
