// Plan limits for the current organization (from its plan in the control DB).
//   max_centres, max_staff   checked when adding a centre / staff member
//   storage_mb               checked before any file upload
//   customer_portal          off = customer registration, login and bookings blocked
//   whatsapp                 off = WhatsApp accounts can't be added or switched on
// NULL limit = unlimited. Your own (default) organization has no limits.

import fs from "node:fs/promises";
import path from "node:path";
import jwt from "jsonwebtoken";
import pool from "../db.js";
import { currentTenant } from "./context.js";
import { DEFAULT_ORG_SLUG } from "./registry.js";

const UNLIMITED = { max_centres: null, max_staff: null, storage_mb: null, customer_portal: true, whatsapp: true };

export function orgLimits() {
  return currentTenant()?.limits || UNLIMITED;
}

export const featureEnabled = (feature) => orgLimits()[feature] !== false;

const COUNTERS = {
  centres: { limit: "max_centres", sql: "SELECT COUNT(*)::int AS n FROM centres", label: "centres" },
  staff: {
    limit: "max_staff",
    sql: "SELECT COUNT(*)::int AS n FROM staff WHERE role <> 'superadmin' AND LOWER(COALESCE(status, 'active')) = 'active'",
    label: "active staff members",
  },
};

/** How many centres / staff are used now. */
export async function countUsage(kind, client = pool) {
  const { rows } = await client.query(COUNTERS[kind].sql);
  return rows[0].n;
}

/**
 * Check a count limit before adding one more. Returns null when allowed,
 * otherwise { status, body } to send back.
 */
export async function checkCountLimit(kind) {
  const { limit, label } = COUNTERS[kind];
  const max = orgLimits()[limit];
  if (max === null || max === undefined) return null;
  const used = await countUsage(kind);
  if (used < max) return null;
  return {
    status: 403,
    body: {
      code: "PLAN_LIMIT",
      error: `Your plan allows ${max} ${label}. Please contact us to upgrade your plan.`,
      limit: max,
      used,
    },
  };
}

/* ---------------- storage ---------------- */

async function folderBytes(dir) {
  let total = 0;
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) total += await folderBytes(full);
    else if (e.isFile()) total += (await fs.stat(full).catch(() => ({ size: 0 }))).size;
  }
  return total;
}

const storageCache = new Map(); // slug -> { bytes, at }
const STORAGE_CACHE_MS = 5 * 60_000;

/** Bytes used by an organization's own upload folders (not counted for the default organization). */
export async function orgStorageBytes(slug, { fresh = false } = {}) {
  if (!slug || slug === DEFAULT_ORG_SLUG) return null;
  const hit = storageCache.get(slug);
  if (!fresh && hit && Date.now() - hit.at < STORAGE_CACHE_MS) return hit.bytes;
  const bytes =
    (await folderBytes(path.join(process.cwd(), "uploads", slug))) +
    (await folderBytes(path.join(process.cwd(), "private_uploads", slug)));
  storageCache.set(slug, { bytes, at: Date.now() });
  return bytes;
}

/* ---------------- request middleware ---------------- */

const CUSTOMER_PATHS = /^\/api\/(customer|portal)(\/|$)/;

function isStaffRequest(req) {
  const token = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || "")?.[1];
  if (!token || !process.env.JWT_SECRET) return false;
  try {
    jwt.verify(token, process.env.JWT_SECRET);
    return true;
  } catch {
    return false;
  }
}

/** Runs after the tenant middleware: customer portal on/off and storage limit. */
export function planMiddleware() {
  return async (req, res, next) => {
    const org = req.tenant;
    const limits = org?.limits;
    if (!limits) return next();

    // Customer portal switched off: block customer-facing calls (staff still manage customers).
    if (limits.customer_portal === false && CUSTOMER_PATHS.test(req.path) && !isStaffRequest(req)) {
      return res.status(403).json({
        code: "PLAN_NO_PORTAL",
        error: "Online customer registration and booking are not included in this centre's plan.",
      });
    }

    // Storage full: refuse new uploads.
    if (limits.storage_mb != null && /^multipart\/form-data/i.test(req.headers["content-type"] || "")) {
      // Re-measure after this upload so the next one sees the new total.
      res.on("finish", () => storageCache.delete(org.slug));
      try {
        const used = await orgStorageBytes(org.slug);
        if (used !== null && used >= limits.storage_mb * 1024 * 1024) {
          return res.status(413).json({
            code: "PLAN_STORAGE_FULL",
            error: `Storage is full (${limits.storage_mb} MB on your plan). Please contact us to upgrade your plan.`,
          });
        }
      } catch (err) {
        console.error("[limits] storage check failed:", err.message);
      }
    }
    next();
  };
}
