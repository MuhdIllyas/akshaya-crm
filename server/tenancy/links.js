// Links to the frontend that are sent to people (WhatsApp, email). For any
// organization other than the default one, the link goes through
// /portal/<slug>/... so the browser knows which organization to talk to.

import { currentTenant } from "./context.js";
import { DEFAULT_ORG_SLUG } from "./registry.js";

/** Public base URL of this API server (used in webhook URLs given to Libromi). */
export function apiBaseUrl() {
  return (process.env.PUBLIC_API_URL || "https://api.akshayasahayi.com").replace(/\/$/, "");
}

/**
 * Webhook URL to register in Libromi for the current organization. Other
 * organizations get ?org=<slug> so incoming messages reach their own database.
 */
export function whatsappWebhookUrl() {
  const org = currentTenant();
  const url = `${apiBaseUrl()}/api/webhook/whatsapp`;
  return !org || org.slug === DEFAULT_ORG_SLUG ? url : `${url}?org=${encodeURIComponent(org.slug)}`;
}

export function frontendUrl(path = "/") {
  const base = (process.env.FRONTEND_URL || "").replace(/\/$/, "");
  const org = currentTenant();
  const p = path.startsWith("/") ? path : `/${path}`;
  if (!org || org.slug === DEFAULT_ORG_SLUG) return `${base}${p}`;
  return `${base}/portal/${org.slug}${p}`;
}
