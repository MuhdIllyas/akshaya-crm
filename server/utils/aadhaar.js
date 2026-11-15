// Aadhaar numbers on walk-in service entries (service_tracking).
//
// The full number is never stored: service_tracking.aadhaar keeps a masked
// "XXXX-XXXX-1234" (what screens show), aadhaar_last4 the last 4 digits, and
// aadhaar_hash the same fingerprint the customer portal stores on a
// customer's account (customers.aadhaar_hash). The fingerprint is how a walk-in
// entry is matched to the customer's account, so they see it in My Services.

import crypto from "crypto";

export const digitsOnly = (v) => String(v ?? "").replace(/\D/g, "");

/** Same fingerprint as customers.aadhaar_hash (routes/customer.js hashValue). */
export const hashAadhaar = (aadhaar) => crypto.createHash("sha256").update(digitsOnly(aadhaar).trim()).digest("hex");

export const maskAadhaar = (last4) => (last4 ? `XXXX-XXXX-${last4}` : null);

/** A masked value sent back unchanged from a form ("XXXX-XXXX-1234", "XXXXXXXX1234"). */
export const isMaskedAadhaar = (v) => /^x[x\s-]*\d{0,4}$/i.test(String(v ?? "").trim());

/**
 * What to store for an Aadhaar typed by staff:
 *   undefined  → not sent / unchanged (masked value sent back): leave as is
 *   null       → cleared
 *   { aadhaar, aadhaar_hash, aadhaar_last4 } → a full 12-digit number
 *   { invalid: true } → anything else
 */
export function aadhaarColumns(raw) {
  if (raw === undefined) return undefined;
  if (raw === null || String(raw).trim() === "") return null;
  if (isMaskedAadhaar(raw)) return undefined;
  const digits = digitsOnly(raw);
  if (!/^\d{12}$/.test(digits)) return { invalid: true };
  const last4 = digits.slice(-4);
  return { aadhaar: maskAadhaar(last4), aadhaar_hash: hashAadhaar(digits), aadhaar_last4: last4 };
}

/**
 * Point a service entry at the customer whose account has this Aadhaar
 * fingerprint (or at nobody if none / cleared). Skips entries made from an
 * online booking: those already belong to that booking's customer.
 */
export async function linkEntryToCustomerByAadhaar(client, serviceEntryId, aadhaarHash) {
  if (!serviceEntryId) return;
  try {
    await client.query(
      `UPDATE service_entries se
          SET customer_id = (SELECT c.id FROM customers c WHERE c.aadhaar_hash = $2 LIMIT 1)
        WHERE se.id = $1 AND se.customer_service_id IS NULL`,
      [serviceEntryId, aadhaarHash || null]
    );
  } catch (err) {
    if (err.code !== "42703") throw err; // migration not applied yet
  }
}

/** A newly registered customer: claim their earlier walk-in entries. */
export async function linkWalkInsToCustomer(client, customerId, aadhaarHash) {
  if (!customerId || !aadhaarHash) return 0;
  try {
    const { rowCount } = await client.query(
      `UPDATE service_entries se
          SET customer_id = $1
         FROM service_tracking st
        WHERE st.service_entry_id = se.id
          AND st.aadhaar_hash = $2
          AND se.customer_id IS NULL
          AND se.customer_service_id IS NULL`,
      [customerId, aadhaarHash]
    );
    return rowCount;
  } catch (err) {
    if (err.code === "42703") return 0; // migration not applied yet
    throw err;
  }
}
