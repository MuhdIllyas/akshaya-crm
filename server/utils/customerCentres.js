// Customers and centres.
//
// A customer is one record per organization (one Aadhaar, one account), and
// customer_centres records which centres they belong to. The superadmin
// chooses how that is used (org_settings customer_portal):
//   shared      one portal: customers see every centre and pick one per booking.
//   per_centre  each centre has its own portal: a customer signs in "at" one of
//               their centres (the centre_id in their token) and sees and books
//               with only that centre; staff see only their centre's customers.
// Memberships are recorded in both modes, so switching modes loses nothing.

import jwt from "jsonwebtoken";
import pool from "../db.js";
import { currentTenant } from "../tenancy/context.js";
import { CUSTOMER_PORTAL, getCustomerPortalMode } from "./orgSettings.js";

const orgSlug = () => currentTenant()?.slug || "default";

const missingTable = (err) => err?.code === "42P01"; // migration not applied yet

/** Add a customer to a centre (no-op if already there). */
export async function linkCustomerToCentre(customerId, centreId, source = "booking", client = pool) {
  if (!customerId || !centreId) return;
  try {
    await client.query(
      `INSERT INTO customer_centres (customer_id, centre_id, source)
       SELECT $1, c.id, $3 FROM centres c WHERE c.id = $2
       ON CONFLICT DO NOTHING`,
      [customerId, centreId, source]
    );
  } catch (err) {
    if (!missingTable(err)) throw err;
  }
}

/** The centres a customer belongs to: [{ id, name, district }]. */
export async function customerCentreList(customerId, client = pool) {
  const sql = (district) =>
    `SELECT c.id, c.name, ${district ? "c.district" : "NULL AS district"}
       FROM customer_centres cc JOIN centres c ON c.id = cc.centre_id
      WHERE cc.customer_id = $1
      ORDER BY cc.created_at, c.name`;
  try {
    return (await client.query(sql(true), [customerId])).rows;
  } catch (err) {
    if (missingTable(err)) return [];
    // older database without centres.district
    if (err?.code === "42703") return (await client.query(sql(false), [customerId])).rows;
    throw err;
  }
}

export async function isCustomerAtCentre(customerId, centreId, client = pool) {
  if (!customerId || !centreId) return false;
  try {
    const { rows } = await client.query(
      `SELECT 1 FROM customer_centres WHERE customer_id = $1 AND centre_id = $2`,
      [customerId, centreId]
    );
    return rows.length > 0;
  } catch (err) {
    if (missingTable(err)) return false;
    throw err;
  }
}

export function signCustomerToken(customerId, centreId = null) {
  return jwt.sign(
    { customer_id: customerId, org: orgSlug(), ...(centreId ? { centre_id: Number(centreId) } : {}) },
    process.env.CUSTOMER_JWT_SECRET,
    { expiresIn: "7d" }
  );
}

/**
 * Sign a customer in. `requestedCentreId` is the centre whose link/QR they
 * came through (or picked), if any.
 *  - shared portal: an ordinary token; the requested centre is remembered as
 *    a membership but nothing is limited.
 *  - per-centre portal: the requested centre joins them to it; otherwise their
 *    only centre is used; otherwise (none, or several) they must choose
 *    (needs_centre) and get a token without a centre until they do.
 */
export async function startCustomerSession(customerId, requestedCentreId = null, source = "link") {
  const mode = await getCustomerPortalMode();
  const requested = Number(requestedCentreId) || null;
  if (requested) await linkCustomerToCentre(customerId, requested, source);

  if (mode !== CUSTOMER_PORTAL.PER_CENTRE) {
    return { token: signCustomerToken(customerId), portal_mode: mode, centre: null, needs_centre: false };
  }

  const centres = await customerCentreList(customerId);
  const centre =
    (requested && centres.find((c) => c.id === requested)) || (centres.length === 1 ? centres[0] : null);
  return {
    token: signCustomerToken(customerId, centre?.id),
    portal_mode: mode,
    centre: centre || null,
    needs_centre: !centre,
  };
}

/**
 * The centre this request is limited to, for a customer already signed in:
 * null in the shared portal; in the per-centre portal the token's centre if
 * they still belong to it, else null with needsCentre set.
 */
export async function customerCentreScope(customerId, tokenCentreId) {
  const mode = await getCustomerPortalMode();
  if (mode !== CUSTOMER_PORTAL.PER_CENTRE) return { mode, centreId: null, needsCentre: false };
  const centreId = Number(tokenCentreId) || null;
  if (centreId && (await isCustomerAtCentre(customerId, centreId))) return { mode, centreId, needsCentre: false };
  return { mode, centreId: null, needsCentre: true };
}

/** SQL condition: booking `alias` belongs to centre $n (or was "any centre" and not yet taken). */
export const bookingInCentreSql = (alias, n) =>
  `(${alias}.requested_centre_id = $${n} OR ${alias}.handling_centre_id = $${n}
    OR (${alias}.requested_centre_id IS NULL AND ${alias}.handling_centre_id IS NULL))`;

/** Staff limited to their centre's customers: their centre id, or null when not limited. */
export async function staffCustomerCentre(user) {
  if (!user || user.role === "superadmin" || !user.centre_id) return null;
  return (await getCustomerPortalMode()) === CUSTOMER_PORTAL.PER_CENTRE ? Number(user.centre_id) : null;
}
