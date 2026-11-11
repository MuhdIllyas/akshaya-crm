// Which Libromi WhatsApp account to use, read from the current organization's
// Communication Settings (communication_accounts) instead of server/.env.
//
// Customer portal OTPs go from the platform number (server/.env) unless the
// organization chose one of its own accounts. LIBROMI_API_KEY in .env is only
// a fallback for the default organization; others never use it.

import pool from "../db.js";
import { currentTenant } from "../tenancy/context.js";
import { DEFAULT_ORG_SLUG } from "../tenancy/registry.js";

export const DEFAULT_LIBROMI_BASE_URL = "https://wa-api.cloud/api/v1";

const isDefaultOrg = () => (currentTenant()?.slug || DEFAULT_ORG_SLUG) === DEFAULT_ORG_SLUG;
const missingColumn = (err) => err?.code === "42703"; // migration not applied yet

/**
 * The platform's own WhatsApp number (the software owner's), which sends
 * customer portal OTPs for every organization unless the organization chose
 * one of its own accounts. Set in server/.env:
 *   PLATFORM_WHATSAPP_ACCESS_TOKEN, PLATFORM_WHATSAPP_BASE_URL
 * (falls back to LIBROMI_ACCESS_TOKEN / LIBROMI_BASE_URL).
 */
export function getPlatformWhatsAppAccount() {
  const token = process.env.PLATFORM_WHATSAPP_ACCESS_TOKEN || process.env.LIBROMI_ACCESS_TOKEN;
  if (!token) return null;
  const baseUrl = process.env.PLATFORM_WHATSAPP_BASE_URL || process.env.LIBROMI_BASE_URL || DEFAULT_LIBROMI_BASE_URL;
  return { id: null, platform: true, token, baseUrl: baseUrl.replace(/\/$/, "") };
}

/**
 * The account that sends customer portal OTPs: the organization's own account
 * if the superadmin ticked "Send customer portal OTPs from this number",
 * otherwise the platform number. Throws if neither is available.
 */
export async function getPortalWhatsAppAccount() {
  let account = null;
  try {
    const { rows } = await pool.query(
      `SELECT id, access_token, base_url FROM communication_accounts
        WHERE is_active = true AND use_for_portal_otp = true
        ORDER BY id ASC LIMIT 1`
    );
    account = rows[0] || null;
  } catch (err) {
    // Table or column missing (migration not applied yet): use the platform number.
    if (!missingColumn(err) && err?.code !== "42P01") throw err;
  }

  if (account?.access_token) {
    return {
      id: account.id,
      platform: false,
      token: account.access_token,
      baseUrl: (account.base_url || process.env.LIBROMI_BASE_URL || DEFAULT_LIBROMI_BASE_URL).replace(/\/$/, ""),
    };
  }

  const platform = getPlatformWhatsAppAccount();
  if (platform) return platform;
  throw new Error("No WhatsApp number is set up to send OTPs (platform number missing in server/.env)");
}

/** Libromi developer API key for an account (used to download customer media). */
export async function getLibromiApiKey(accountId) {
  if (accountId) {
    try {
      const { rows } = await pool.query(`SELECT api_key FROM communication_accounts WHERE id = $1`, [accountId]);
      if (rows[0]?.api_key) return rows[0].api_key;
    } catch (err) {
      if (!missingColumn(err)) throw err;
    }
  }
  return isDefaultOrg() ? process.env.LIBROMI_API_KEY || null : null;
}
