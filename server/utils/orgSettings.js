// Per-organization options set by the superadmin (stored in that
// organization's own database, table org_settings).

import pool from "../db.js";

export const BOOKING_MODES = {
  SHARED: "shared", // every centre sees every booking; other centres must confirm to take one
  STRICT: "strict", // only the booked centre sees/takes it ("any centre" bookings go to everyone)
};

// How customers relate to centres.
export const CUSTOMER_PORTAL = {
  SHARED: "shared", // one portal: customers see every centre and pick one (or any)
  PER_CENTRE: "per_centre", // each centre has its own portal: a customer sees only the centre they came through
};

const DEFAULTS = {
  booking_mode: BOOKING_MODES.SHARED,
  customer_portal: CUSTOMER_PORTAL.SHARED,
};

export async function getSetting(key, client = pool) {
  try {
    const { rows } = await client.query(`SELECT value FROM org_settings WHERE key = $1`, [key]);
    return rows.length ? rows[0].value : DEFAULTS[key];
  } catch (err) {
    if (err.code === "42P01") return DEFAULTS[key]; // migration not applied yet
    throw err;
  }
}

export async function setSetting(key, value, staffId = null) {
  await pool.query(
    `INSERT INTO org_settings (key, value, updated_by, updated_at)
     VALUES ($1, $2::jsonb, $3, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [key, JSON.stringify(value), staffId]
  );
}

export async function getCustomerPortalMode(client = pool) {
  const mode = await getSetting("customer_portal", client);
  return mode === CUSTOMER_PORTAL.PER_CENTRE ? CUSTOMER_PORTAL.PER_CENTRE : CUSTOMER_PORTAL.SHARED;
}

// A per-centre portal means a booking belongs to its centre only, so the
// booking mode is strict whatever is saved for it.
export async function getBookingMode(client = pool) {
  if ((await getCustomerPortalMode(client)) === CUSTOMER_PORTAL.PER_CENTRE) return BOOKING_MODES.STRICT;
  const mode = await getSetting("booking_mode", client);
  return mode === BOOKING_MODES.STRICT ? BOOKING_MODES.STRICT : BOOKING_MODES.SHARED;
}
