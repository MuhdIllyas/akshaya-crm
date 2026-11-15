// Print-agent pairing codes are typed into the desktop agent as 6 digits, with
// no organization attached. In multi-tenant mode the control database keeps
// code -> organization, so codes are unique across organizations and the
// agent's /pair request can be routed to the right database.

import { currentTenant } from "./context.js";
import { DEFAULT_ORG_SLUG, getControlPool, getDefaultOrg, getOrgBySlug, isMultiTenant } from "./registry.js";

/** Reserve a code for the current organization. False if another org holds it. */
export async function reservePairingCode(code) {
  if (!isMultiTenant()) return true;
  const control = getControlPool();
  await control.query(`DELETE FROM pairing_code_index WHERE expires_at < now() - interval '1 day'`);
  const { rowCount } = await control.query(
    `INSERT INTO pairing_code_index (code, org_slug, expires_at)
     VALUES ($1, $2, now() + interval '15 minutes')
     ON CONFLICT (code) DO NOTHING`,
    [code, currentTenant().slug]
  );
  return rowCount === 1;
}

/** Organization a pairing code was issued by, or null if unknown/expired. */
export async function orgForPairingCode(code) {
  if (!isMultiTenant()) return getDefaultOrg();
  const { rows } = await getControlPool().query(
    `SELECT org_slug FROM pairing_code_index WHERE code = $1 AND expires_at > now()`,
    [code]
  );
  return rows[0] ? getOrgBySlug(rows[0].org_slug) : null;
}

/** Print-station tokens carry their organization as "<slug>~<secret>". */
export function withOrgPrefix(secret) {
  const org = currentTenant();
  return org && org.slug !== DEFAULT_ORG_SLUG ? `${org.slug}~${secret}` : secret;
}
