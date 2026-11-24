// Turns a parsed UPI payment into an upi_credits row, works out which wallet it
// belongs to, and tells the centre's staff live ("₹100 received – SBI").
import pool from "../db.js";
import { io } from "../tenancy/io.js";
import { scheduleUpiMatch } from "./upiMatcher.js";
import { repeatKey, statedMinutes } from "../utils/upiCredit.js";

/**
 * The wallet a payment belongs to: the centre's wallet that reads payments
 * from this source (upi_match_sources), for SMS also with the same account
 * last 4 digits.
 * Returns null when no wallet, or more than one, fits — the payment is then
 * kept but not shown to staff until an admin sets up the wallet.
 */
export async function findWalletFor(centreId, credit) {
  const { rows } = await pool.query(
    `SELECT id, name, upi_account_last4
       FROM wallets
      WHERE centre_id = $1 AND $2 = ANY(upi_match_sources)
        AND COALESCE(status, 'active') <> 'inactive'`,
    [centreId, credit.source]
  );
  if (!rows.length) return null;
  if (credit.source !== "sms") return rows.length === 1 ? rows[0] : null;

  if (credit.account_last4) {
    const same = rows.filter((w) => String(w.upi_account_last4 || "").slice(-4) === credit.account_last4);
    if (same.length === 1) return same[0];
    if (same.length > 1) return null;
    // No wallet names this account: only the one SMS wallet without digits can take it.
    const open = rows.filter((w) => !w.upi_account_last4);
    return open.length === 1 && rows.length === 1 ? open[0] : null;
  }
  return rows.length === 1 ? rows[0] : null;
}

// One centre's payments are saved one at a time, so two notifications for the
// same payment arriving together can't both slip past the repeat check.
const queues = new Map();

/**
 * Save one payment. Returns the saved row (with wallet_name) or null when it
 * was already saved (same UPI reference, or the same app notification posted
 * twice) or could not be saved.
 */
export function recordUpiCredit(args) {
  const key = String(args.centreId);
  const run = (queues.get(key) || Promise.resolve()).catch(() => {}).then(() => saveCredit(args));
  queues.set(key, run);
  const done = () => { if (queues.get(key) === run) queues.delete(key); };
  run.then(done, done);
  return run;
}

// Midnight today in India, as a Date
const todayStartIST = () => {
  const ymd = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  return new Date(`${ymd}T00:00:00+05:30`);
};

async function saveCredit({ centreId, deviceId, credit, creditedAt, rawText, smsLogId = null, notificationLogId = null, quiet = false }) {
  // UPI payments are kept for the day only. A payment from an earlier day is
  // never saved again: when the companion app restarts, Android hands it every
  // notification still in the phone's notification bar, yesterday's included.
  if (creditedAt && new Date(creditedAt) < todayStartIST()) return null;
  // Some phones re-post an old notification with the restart time, but GPay for
  // Business states the real time in its text ("… at 4:42 PM"). A stated time
  // later in the day than its arrival means it was yesterday's.
  const stated = statedMinutes(rawText);
  if (stated !== null && creditedAt) {
    const [h, m] = new Date(creditedAt)
      .toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false })
      .split(":").map(Number);
    if (stated > h * 60 + m + 10) return null;
  }

  // No UPI reference in app notifications: the same payer, minute and amount
  // within a few minutes is the same payment told twice.
  if (!credit.utr) {
    const k = repeatKey(rawText);
    if (k) {
      const { rows: near } = await pool.query(
        `SELECT raw_text FROM upi_credits
          WHERE centre_id = $1 AND source = $2 AND amount = $3 AND utr IS NULL
            AND credited_at BETWEEN $4::timestamptz - INTERVAL '10 minutes' AND $4::timestamptz + INTERVAL '10 minutes'`,
        [centreId, credit.source, credit.amount, creditedAt]
      );
      if (near.some((r) => repeatKey(r.raw_text) === k)) return null;
    }
  }

  const wallet = await findWalletFor(centreId, credit);

  const { rows } = await pool.query(
    `INSERT INTO upi_credits
       (centre_id, device_id, wallet_id, source, amount, payer, utr, account_last4,
        sms_log_id, notification_log_id, raw_text, credited_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (centre_id, utr) WHERE utr IS NOT NULL DO NOTHING
     RETURNING *`,
    [
      centreId, deviceId, wallet?.id ?? null, credit.source, credit.amount,
      credit.payer, credit.utr, credit.account_last4,
      smsLogId, notificationLogId, rawText, creditedAt,
    ]
  );
  if (!rows.length) return null; // same payment reported twice

  const saved = { ...rows[0], wallet_name: wallet?.name ?? null };

  // A save may already be waiting for this payment (staff entered it first).
  if (saved.wallet_id) scheduleUpiMatch();

  // Only payments that landed on a set-up wallet are shown. Otherwise a GPay QR
  // payment would pop up twice: once from the bank SMS, once from the GPay app.
  // quiet: an earlier message read again later (no live alert for old payments).
  if (saved.wallet_id && !quiet) {
    io.to(`centre:${centreId}`).emit("centre_upi_credit", {
      id: saved.id,
      centre_id: centreId,
      wallet_id: saved.wallet_id,
      wallet_name: saved.wallet_name,
      source: saved.source,
      amount: Number(saved.amount),
      payer: saved.payer,
      utr: saved.utr,
      credited_at: saved.credited_at,
    });
  }
  return saved;
}

/** The phone's own time when sane, else now (phones with a wrong clock). */
export function phoneTime(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return new Date();
  const skew = Math.abs(Date.now() - n);
  return skew > 24 * 60 * 60 * 1000 ? new Date() : new Date(n);
}
