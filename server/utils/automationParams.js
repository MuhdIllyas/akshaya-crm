// utils/automationParams.js
// Turns a scheduled action + its service entry into the ordered {{1}},{{2}}... values
// for a WhatsApp template. Shared by the worker (send) and, later, the API (preview).

import pool from "../db.js";

const TZ = "Asia/Kolkata";

export class PermanentError extends Error {
  constructor(message) {
    super(message);
    this.name = "PermanentError";
    this.permanent = true; // worker will NOT retry these
  }
}

/* ---------------- Formatting ---------------- */

// Datetimes coming from the UI without an offset are IST, not server time.
export function parseIST(value) {
  if (value instanceof Date) return value;
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T00:00:00+05:30`);
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?$/.test(s)) return new Date(`${s.replace(" ", "T")}+05:30`);
  return new Date(s);
}

export function formatDateIST(value) {
  const d = parseIST(value);
  if (Number.isNaN(d.getTime())) return null;
  // e.g. "Wednesday, 14 Oct 2026"
  return d.toLocaleDateString("en-IN", {
    timeZone: TZ, weekday: "long", day: "numeric", month: "short", year: "numeric",
  });
}

export function formatTimeIST(value) {
  const d = parseIST(value);
  if (Number.isNaN(d.getTime())) return null;
  // e.g. "10:30 AM"
  return d.toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit", hour12: true });
}

/**
 * Meta rejects params with newlines/tabs or 4+ consecutive spaces, and empty strings.
 * Arrays (documents) become "A, B, C".
 */
export function cleanParam(value) {
  if (value === null || value === undefined) return "-";
  let s = Array.isArray(value)
    ? value.map((v) => String(v ?? "").trim()).filter(Boolean).join(", ")
    : String(value);

  s = s
    .replace(/[\r\n\t]+/g, ", ")
    .replace(/ {4,}/g, "   ")
    .replace(/(,\s*){2,}/g, ", ")
    .replace(/^[,\s]+|[,\s]+$/g, "")
    .trim();

  return s || "-";
}

const isBlank = (v) =>
  v === null ||
  v === undefined ||
  (Array.isArray(v) ? v.filter((x) => String(x ?? "").trim()).length === 0 : String(v).trim() === "");

/* ---------------- Context ---------------- */

const ISO_LIKE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2})?/;

/**
 * Everything a template can reference by key:
 *   customer_name, service_name   (from the service entry)
 *   any preset field key          (venue, documents, ...)
 *   <field>_date / <field>_time   (auto-derived from date/datetime fields;
 *                                  "appointment_at" -> appointment_date, appointment_time
 *                                  "submit_by"      -> submit_by_date)
 */
export function buildContext(action, entry) {
  const fields = action?.payload?.fields || {};

  const ctx = {
    customer_name: fields.customer_name || entry?.customer_name || null,
    service_name: fields.service_name || entry?.service_name || null,
    ...fields,
  };

  for (const [key, value] of Object.entries(fields)) {
    if (typeof value !== "string" || !ISO_LIKE.test(value)) continue;
    const base = key.replace(/_at$/, "");
    ctx[`${base}_date`] = formatDateIST(value);
    if (/[T ]\d{2}:\d{2}/.test(value)) ctx[`${base}_time`] = formatTimeIST(value);
  }

  return ctx;
}

/* ---------------- Params ---------------- */

async function getParamMap(action, db) {
  if (action.preset_id) {
    const r = await db.query(
      `SELECT param_map FROM service_automation_presets WHERE id = $1`,
      [action.preset_id]
    );
    const map = r.rows[0]?.param_map;
    if (Array.isArray(map) && map.length) return map;
  }
  const own = action?.payload?.param_map;
  return Array.isArray(own) && own.length ? own : null;
}

/**
 * @returns {Promise<string[]>} ordered, cleaned template params
 * @throws  {PermanentError} if a required value is missing
 */
export async function buildActionParams(action, entry, db = pool) {
  const paramMap = await getParamMap(action, db);

  // Fallback: literal params stored on the action
  if (!paramMap) {
    const literal = action?.payload?.params;
    if (Array.isArray(literal) && literal.length) return literal.map(cleanParam);
    throw new PermanentError("No template parameters configured for this action");
  }

  const ctx = buildContext(action, entry);
  const missing = paramMap.filter((key) => isBlank(ctx[key]));
  if (missing.length) {
    throw new PermanentError(`Missing template values: ${missing.join(", ")}`);
  }

  return paramMap.map((key) => cleanParam(ctx[key]));
}