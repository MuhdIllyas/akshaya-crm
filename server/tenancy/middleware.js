// Express middleware: work out which organization a request belongs to and
// run the rest of the request inside that organization's context.
//
// Where the organization comes from, in order:
//  1. A signed login token (staff, customer or device JWT). Its `org` claim
//     wins over anything else, so a user can never point their own token at
//     another organization's database. Tokens issued before multi-tenancy
//     have no claim and belong to the default organization.
//  2. A print-station token of the form "<slug>~<secret>".
//  3. The X-Org-Slug header, or ?org= on the URL, for requests made before
//     login (login, registration, OTP, public tracking/review pages, webhooks).
//  4. Otherwise the default organization.

import { AsyncResource } from "node:async_hooks";
import jwt from "jsonwebtoken";
import { runWithTenant } from "./context.js";
import { DEFAULT_ORG_SLUG, getOrgBySlug } from "./registry.js";

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,40}$/;

function verifyAny(token) {
  for (const secret of [process.env.JWT_SECRET, process.env.CUSTOMER_JWT_SECRET]) {
    if (!secret) continue;
    try {
      return jwt.verify(token, secret);
    } catch {
      /* try the next secret */
    }
  }
  return null;
}

/** Organization slug carried by a token, or undefined if the token says nothing. */
export function slugFromToken(token) {
  if (!token) return undefined;
  const decoded = verifyAny(token);
  if (decoded) return decoded.org || DEFAULT_ORG_SLUG;
  const station = /^([a-z0-9-]+)~/.exec(token);
  if (station) return station[1];
  return undefined;
}

function requestedSlug(req) {
  const bearer = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || "")?.[1];
  // Companion phones send their signed pairing token in the body, not a header.
  const fromToken = slugFromToken(bearer) || slugFromToken(req.body?.pairingToken);
  if (fromToken) return fromToken;

  const asked = String(req.headers["x-org-slug"] || req.query?.org || "").trim().toLowerCase();
  if (asked) return asked;

  return DEFAULT_ORG_SLUG;
}

// Some code (multer, busboy, raw body readers) handles request data in event
// listeners. Those fire from the socket, outside our async context, so bind
// each listener to the context it was registered in.
function bindEmitter(emitter) {
  for (const method of ["on", "once", "addListener", "prependListener", "prependOnceListener"]) {
    const original = emitter[method];
    emitter[method] = function (event, listener) {
      return original.call(this, event, typeof listener === "function" ? AsyncResource.bind(listener) : listener);
    };
  }
}

export function tenantMiddleware() {
  return async (req, res, next) => {
    try {
      const slug = requestedSlug(req);
      if (!SLUG_RE.test(slug)) return res.status(400).json({ error: "Invalid organization" });

      const org = await getOrgBySlug(slug);
      if (!org) return res.status(404).json({ error: "Organization not found" });
      if (org.status !== "active") {
        return res.status(403).json({ error: "This organization's account is not active. Please contact support." });
      }

      runWithTenant(org, () => {
        req.tenant = org;
        bindEmitter(req);
        bindEmitter(res);
        next();
      });
    } catch (err) {
      console.error("[tenancy] could not resolve organization:", err.message);
      res.status(503).json({ error: "Service temporarily unavailable" });
    }
  };
}
