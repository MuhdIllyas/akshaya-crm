// Turns a parsed UPI payment into an upi_credits row, works out which wallet it
// belongs to, and tells the centre's staff live ("₹100 received – SBI").
import pool from "../db.js";
import { io } from "../tenancy/io.js";
import { scheduleUpiMatch } from "./upiMatcher.js";

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

/**
 * Save one payment. Returns the saved row (with wallet_name) or null when it
 * was already saved (same UPI reference) or could not be saved.
 */
export async function recordUpiCredit({ centreId, deviceId, credit, creditedAt, rawText, smsLogId = null, notificationLogId = null }) {
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
  if (saved.wallet_id) {
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
