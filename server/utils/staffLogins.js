// Staff sign-in history and lock-out (table staff_logins in each
// organization's database). If the migration hasn't been applied yet, every
// function here quietly does nothing, so logins keep working.

import pool from "../db.js";

export const LOCK_AFTER = 5; // wrong passwords for one username …
export const LOCK_MINUTES = 15; // … within this many minutes locks it for that long

const missingTable = (err) => err?.code === "42P01";

// req.ip is the visitor's address (server.js trusts only the local nginx).
export const clientIp = (req) => String(req.ip || "").replace(/^::ffff:/, "").slice(0, 64);

/** True when this username has too many recent wrong passwords. */
export async function isLocked(username) {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM staff_logins
        WHERE username = $1 AND success = false
          AND created_at > now() - ($2 || ' minutes')::interval
          AND created_at > COALESCE((SELECT MAX(created_at) FROM staff_logins WHERE username = $1 AND success), 'epoch')`,
      [username, String(LOCK_MINUTES)]
    );
    return rows[0].n >= LOCK_AFTER;
  } catch (err) {
    if (missingTable(err)) return false;
    throw err;
  }
}

/** Record one attempt. Never fails the login. */
export async function recordSignIn(req, { staffId = null, username, success }) {
  try {
    await pool.query(
      `INSERT INTO staff_logins (staff_id, username, success, ip, user_agent) VALUES ($1, $2, $3, $4, $5)`,
      [staffId, String(username).slice(0, 80), success, clientIp(req), String(req.headers["user-agent"] || "").slice(0, 300)]
    );
  } catch (err) {
    if (!missingTable(err)) console.error("[sign-in history] could not record:", err.message);
  }
}

/** The staff member's sign-in before the current one: { created_at, ip } or null. */
export async function previousSignIn(staffId) {
  try {
    const { rows } = await pool.query(
      `SELECT created_at, ip FROM staff_logins WHERE staff_id = $1 AND success
        ORDER BY created_at DESC OFFSET 1 LIMIT 1`,
      [staffId]
    );
    return rows[0] || null;
  } catch (err) {
    if (missingTable(err)) return null;
    throw err;
  }
}
