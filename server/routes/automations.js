// routes/automations.js
// Mount in server.js:  app.use("/api/automations", automationRoutes);

import express from "express";
import jwt from "jsonwebtoken";
import pool from "../db.js";
import { buildContext, cleanParam, parseIST } from "../utils/automationParams.js";
import { logActivity } from "../utils/activityLogger.js";
import runScheduledActions from "../controllers/scheduledActionWorker.js";

const router = express.Router();

/* ================================
   AUTH
================================ */
router.use((req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = user;
    next();
  });
});

/* ================================
   HELPERS
================================ */
const TZ = "Asia/Kolkata";
const QUIET_START_HOUR = 21; // 9 PM
const QUIET_END_HOUR = 8;    // 8 AM
const MAX_ACTIONS = 10;
const MAX_TRIGGERS = 5;
const MAX_OFFSET_MINUTES = 60 * 24 * 60; // 60 days
const DATE_ONLY_SEND_TIME = "10:00";     // a date-only anchor counts as 10 AM that day

class ValidationError extends Error {}

const isBlank = (v) =>
  v === null ||
  v === undefined ||
  (Array.isArray(v) ? v.filter((x) => String(x ?? "").trim()).length === 0 : String(v).trim() === "");

const validDate = (d) => d instanceof Date && !Number.isNaN(d.getTime());
const isDateOnly = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v).trim());

const istHour = (d) =>
  Number(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hourCycle: "h23" }).format(d)) % 24;

const isQuietHour = (d) => {
  const h = istHour(d);
  return h >= QUIET_START_HOUR || h < QUIET_END_HOUR;
};

const fmtIST = (d) =>
  d.toLocaleString("en-IN", {
    timeZone: TZ, weekday: "short", day: "numeric", month: "short",
    hour: "numeric", minute: "2-digit", hour12: true,
  });

const istDateString = (d) => d.toLocaleDateString("en-CA", { timeZone: TZ });

function anchorTime(value) {
  if (isBlank(value)) return null;
  const s = String(value).trim();
  const d = isDateOnly(s) ? parseIST(`${s}T${DATE_ONLY_SEND_TIME}`) : parseIST(s);
  return validDate(d) ? d : null;
}

function anchorExpiry(value) {
  if (isBlank(value)) return null;
  const s = String(value).trim();
  const d = isDateOnly(s) ? parseIST(`${s}T23:59`) : parseIST(s);
  return validDate(d) ? d : null;
}

const canAccessCentre = (user, centreId) =>
  user.role === "superadmin" || Number(user.centre_id) === Number(centreId);

async function loadEntry(id) {
  const { rows } = await pool.query(
    `SELECT se.*, s.name AS service_name, st.centre_id
       FROM service_entries se
       LEFT JOIN services s ON s.id = se.category_id
       LEFT JOIN staff st ON st.id = se.staff_id
      WHERE se.id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function loadActionForUser(id, user) {
  const { rows } = await pool.query(`SELECT * FROM scheduled_actions WHERE id = $1`, [id]);
  const action = rows[0];
  if (!action) return { error: [404, "Scheduled action not found"] };
  if (!canAccessCentre(user, action.centre_id)) return { error: [403, "Not allowed"] };
  return { action };
}

const presetApplies = (p, entry) =>
  (p.centre_id == null || Number(p.centre_id) === Number(entry.centre_id)) &&
  (p.category_id == null || Number(p.category_id) === Number(entry.category_id)) &&
  (p.subcategory_id == null || Number(p.subcategory_id) === Number(entry.subcategory_id));

// Keep only the keys the preset defines (+ service_name), trimmed
function sanitizeFields(preset, raw = {}) {
  const allowed = new Set([...(preset.fields || []).map((f) => f.key), "service_name"]);
  const out = {};
  for (const [k, v] of Object.entries(raw || {})) {
    if (!allowed.has(k)) continue;
    if (Array.isArray(v)) out[k] = v.map((x) => String(x ?? "").trim()).filter(Boolean);
    else if (typeof v === "string") out[k] = v.trim();
    else out[k] = v;
  }
  return out;
}

const fieldLabel = (preset, key) => (preset.fields || []).find((f) => f.key === key)?.label || key;

function labelForParam(preset, key) {
  if (key === "customer_name") return "Customer name";
  if (key === "service_name") return "Service name";
  const fields = preset.fields || [];
  const direct = fields.find((f) => f.key === key);
  if (direct) return direct.label || key;
  const base = key.replace(/_(date|time)$/, "");
  const f = fields.find((x) => x.key === base || x.key === `${base}_at`);
  return f ? f.label : key;
}

function computeRunTimes(preset, fields, triggers) {
  if (!Array.isArray(triggers) || triggers.length === 0) throw new ValidationError("Choose at least one time");
  if (triggers.length > MAX_TRIGGERS) throw new ValidationError(`Maximum ${MAX_TRIGGERS} times per reminder`);

  const anchorKey = preset.default_trigger?.anchor;
  const anchor = anchorKey ? anchorTime(fields[anchorKey]) : null;
  const seen = new Set();
  const out = [];

  for (const t of triggers) {
    let at;
    let label;

    if (t?.kind === "offset") {
      if (!anchorKey) throw new ValidationError("Choose an exact time for this reminder");
      if (!anchor) throw new ValidationError(`Set "${fieldLabel(preset, anchorKey)}" first`);
      const m = Number(t.minutes_before);
      if (!Number.isFinite(m) || m < 0 || m > MAX_OFFSET_MINUTES) throw new ValidationError("Invalid reminder time");
      at = new Date(anchor.getTime() - m * 60000);
      label = t.label || `${m} minutes before`;
    } else if (t?.kind === "at") {
      if (isBlank(t.at)) throw new ValidationError("Pick a date and time");
      at = parseIST(t.at);
      if (!validDate(at)) throw new ValidationError("Pick a valid date and time");
      label = "Custom time";
    } else {
      throw new ValidationError("Invalid trigger");
    }

    const minuteKey = Math.floor(at.getTime() / 60000);
    if (seen.has(minuteKey)) continue;
    seen.add(minuteKey);
    out.push({ at, label });
  }

  return out.sort((a, b) => a.at - b.at);
}

function checkTime(preset, { at, label }) {
  if (at.getTime() < Date.now() - 60 * 1000) {
    throw new ValidationError(`${label} (${fmtIST(at)}) is already in the past`);
  }
  if (preset.action_type === "whatsapp_template" && isQuietHour(at)) {
    throw new ValidationError(
      `${label} (${fmtIST(at)}) is between 9 PM and 8 AM, when customers are not messaged`
    );
  }
}

const renderPreview = (body, params) =>
  body ? body.replace(/\{\{(\d+)\}\}/g, (m, n) => params[Number(n) - 1] ?? m) : null;

/* ================================
   GET /presets
================================ */
router.get("/presets", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, centre_id, category_id, subcategory_id, name, action_type,
              template_key, fields, param_map, default_trigger
         FROM service_automation_presets
        WHERE is_active = true
          AND ($1::int IS NULL OR centre_id IS NULL OR centre_id = $1)
        ORDER BY name`,
      [req.user.role === "superadmin" ? null : req.user.centre_id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================================
   POST /preview
   { preset_id, fields, customer_name, service_name }
================================ */
router.post("/preview", async (req, res) => {
  try {
    const { preset_id, fields = {}, customer_name, service_name } = req.body;
    const { rows } = await pool.query(`SELECT * FROM service_automation_presets WHERE id = $1`, [preset_id]);
    const preset = rows[0];
    if (!preset) return res.status(404).json({ error: "Preset not found" });
    if (preset.action_type !== "whatsapp_template") return res.json({ params: [], missing: [], text: null });

    const clean = sanitizeFields(preset, { ...fields, service_name });
    const ctx = buildContext({ payload: { fields: { ...clean, customer_name } } }, null);
    const map = Array.isArray(preset.param_map) ? preset.param_map : [];

    const missing = [];
    const params = map.map((key) => {
      if (isBlank(ctx[key])) {
        const label = labelForParam(preset, key);
        missing.push(label);
        return `[${label}]`;
      }
      return cleanParam(ctx[key]);
    });

    res.json({ params, missing: [...new Set(missing)], text: renderPreview(preset.preview_body, params) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================================
   POST /
   { service_entry_id, actions: [{ preset_id, fields, triggers: [...] }] }
   triggers: { kind: 'offset', minutes_before, label } | { kind: 'at', at: 'YYYY-MM-DDTHH:mm' (IST) }
================================ */
router.post("/", async (req, res) => {
  const client = await pool.connect();
  try {
    const { service_entry_id, actions } = req.body;

    if (!service_entry_id) return res.status(400).json({ error: "service_entry_id required" });
    if (!Array.isArray(actions) || actions.length === 0) return res.status(400).json({ error: "No actions given" });
    if (actions.length > MAX_ACTIONS) return res.status(400).json({ error: `Maximum ${MAX_ACTIONS} automations at once` });

    const entry = await loadEntry(service_entry_id);
    if (!entry) return res.status(404).json({ error: "Service entry not found" });
    if (!entry.centre_id) return res.status(400).json({ error: "Could not determine the centre for this entry" });
    if (!canAccessCentre(req.user, entry.centre_id)) return res.status(403).json({ error: "Not allowed" });
    if (entry.status === "cancelled") return res.status(400).json({ error: "Service entry is cancelled" });

    const presetIds = [...new Set(actions.map((a) => Number(a.preset_id)).filter(Boolean))];
    const presetRes = await pool.query(
      `SELECT * FROM service_automation_presets WHERE id = ANY($1::int[]) AND is_active = true`,
      [presetIds]
    );
    const presets = new Map(presetRes.rows.map((p) => [p.id, p]));

    const errors = [];
    const rowsToInsert = [];

    for (const [i, a] of actions.entries()) {
      const preset = presets.get(Number(a.preset_id));
      const prefix = actions.length > 1 ? `${preset?.name || `Automation ${i + 1}`}: ` : "";

      try {
        if (!preset) throw new ValidationError("Automation not found or disabled");
        if (!presetApplies(preset, entry)) throw new ValidationError("Not available for this service");

        const fields = sanitizeFields(preset, a.fields);
        const missing = (preset.fields || []).filter((f) => f.required && isBlank(fields[f.key]));
        if (missing.length) throw new ValidationError(`Required: ${missing.map((f) => f.label || f.key).join(", ")}`);

        const isWhatsApp = preset.action_type === "whatsapp_template";
        if (isWhatsApp && !entry.phone) throw new ValidationError("Customer has no phone number");

        let assignee = null;
        if (!isWhatsApp) {
          assignee = Number(fields.assigned_to) || Number(entry.staff_id) || null;
          if (!assignee) throw new ValidationError("Choose a staff member");
          const s = await pool.query(`SELECT centre_id FROM staff WHERE id = $1`, [assignee]);
          if (!s.rows.length || Number(s.rows[0].centre_id) !== Number(entry.centre_id)) {
            throw new ValidationError("Staff must belong to this centre");
          }
        }

        const times = computeRunTimes(preset, fields, a.triggers);
        times.forEach((t) => checkTime(preset, t));

        const anchorKey = preset.default_trigger?.anchor;
        const expiresAt = isWhatsApp && anchorKey ? anchorExpiry(fields[anchorKey]) : null;

        for (const t of times) {
          const baseLabel = isWhatsApp ? preset.name : fields.task_title || preset.name;
          const label = times.length > 1 ? `${baseLabel} (${t.label})` : baseLabel;

          const payload = isWhatsApp
            ? { label, fields, expires_at: expiresAt ? expiresAt.toISOString() : null }
            : {
                label,
                fields,
                task_title: fields.task_title,
                description: fields.description || null,
                assigned_to: assignee,
                due_date: istDateString(t.at),
                priority: fields.priority || "medium",
              };

          rowsToInsert.push({
            preset,
            run_at: t.at,
            payload,
            customer_phone: isWhatsApp ? entry.phone : null,
          });
        }
      } catch (e) {
        if (e instanceof ValidationError) errors.push(`${prefix}${e.message}`);
        else throw e;
      }
    }

    if (errors.length) return res.status(400).json({ error: errors.join("\n"), errors });

    await client.query("BEGIN");
    const created = [];
    for (const r of rowsToInsert) {
      const ins = await client.query(
        `INSERT INTO scheduled_actions
           (centre_id, service_entry_id, customer_phone, action_type, preset_id,
            template_key, payload, run_at, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING *`,
        [
          entry.centre_id,
          entry.id,
          r.customer_phone,
          r.preset.action_type,
          r.preset.id,
          r.preset.template_key,
          JSON.stringify(r.payload),
          r.run_at,
          req.user.id,
        ]
      );
      created.push(ins.rows[0]);
    }
    await client.query("COMMIT");

    try {
      await logActivity({
        centre_id: entry.centre_id,
        related_type: "service_entry",
        related_id: entry.id,
        action: "Reminders Scheduled",
        description: `Scheduled ${created.length} automation(s) for ${entry.customer_name}: ${created
          .map((c) => `${c.payload.label} at ${fmtIST(new Date(c.run_at))}`)
          .join("; ")}`,
        performed_by: req.user.id,
        performed_by_role: req.user.role,
      });
    } catch (e) {
      console.error("Non-fatal: automation activity log failed:", e.message);
    }

    res.status(201).json({ created });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("AUTOMATION CREATE ERROR:", err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

/* ================================
   GET /   — all schedules for the Messenger "Schedules" view
   Query:
     status   upcoming (default) | failed | done | cancelled | all
     type     whatsapp_template | staff_task
     search   customer name / phone / label
     mine     true -> created by me OR task assigned to me
     centre_id (superadmin only)
     from, to  YYYY-MM-DD (IST, on run_at)
     limit, offset
================================ */
const STATUS_GROUPS = {
  upcoming: ["pending", "processing"],
  failed: ["failed"],
  done: ["done"],
  cancelled: ["cancelled"],
};

const ASSIGNEE_SQL = `CASE WHEN sa.payload->>'assigned_to' ~ '^[0-9]+$'
                           THEN (sa.payload->>'assigned_to')::int END`;

function buildScope(req, values) {
  const where = [];
  const add = (sql, v) => {
    values.push(v);
    where.push(sql.replace("?", `$${values.length}`));
  };

  if (req.user.role === "superadmin") {
    if (req.query.centre_id) add("sa.centre_id = ?", Number(req.query.centre_id));
  } else {
    add("sa.centre_id = ?", Number(req.user.centre_id));
  }

  if (req.query.type) add("sa.action_type = ?", String(req.query.type));

  if (req.query.mine === "true") {
    values.push(Number(req.user.id));
    const n = values.length;
    where.push(`(sa.created_by = $${n} OR ${ASSIGNEE_SQL} = $${n})`);
  }

  if (req.query.search && String(req.query.search).trim()) {
    values.push(`%${String(req.query.search).trim()}%`);
    const n = values.length;
    where.push(`(se.customer_name ILIKE $${n} OR sa.customer_phone ILIKE $${n}
                 OR se.phone ILIKE $${n} OR sa.payload->>'label' ILIKE $${n})`);
  }

  if (req.query.from) add(`(sa.run_at AT TIME ZONE '${TZ}')::date >= ?::date`, String(req.query.from));
  if (req.query.to) add(`(sa.run_at AT TIME ZONE '${TZ}')::date <= ?::date`, String(req.query.to));

  return where;
}

router.get("/", async (req, res) => {
  try {
    const statusKey = STATUS_GROUPS[req.query.status] || req.query.status === "all" ? req.query.status : "upcoming";
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    const FROM = `
      FROM scheduled_actions sa
      LEFT JOIN service_entries se ON se.id = sa.service_entry_id
      LEFT JOIN services s ON s.id = se.category_id
      LEFT JOIN staff cb ON cb.id = sa.created_by
      LEFT JOIN staff asg ON asg.id = ${ASSIGNEE_SQL}
      LEFT JOIN centres c ON c.id = sa.centre_id
      LEFT JOIN tasks t ON t.scheduled_action_id = sa.id
      LEFT JOIN subcategories sub ON sub.id = se.subcategory_id
      LEFT JOIN LATERAL (
        SELECT st.id, st.application_number
        FROM service_tracking st
        WHERE st.service_entry_id = se.id
        ORDER BY st.id DESC
        LIMIT 1
      ) trk ON true`;

    // ---- list ----
    const listValues = [];
    const listWhere = buildScope(req, listValues);
    if (statusKey !== "all") {
      listValues.push(STATUS_GROUPS[statusKey]);
      listWhere.push(`sa.status = ANY($${listValues.length}::text[])`);
    }
    const orderBy =
      statusKey === "upcoming"
        ? "sa.run_at ASC"
        : "COALESCE(sa.executed_at, sa.cancelled_at, sa.updated_at) DESC";

    listValues.push(limit + 1, offset);
    const listRes = await pool.query(
      `SELECT sa.*,
              se.customer_name, se.phone AS entry_phone, se.category_id, se.subcategory_id,
              s.name AS service_name,
              cb.name AS created_by_name,
              asg.name AS assignee_name,
              c.name AS centre_name,
              t.id AS task_id, t.status AS task_status,
              sub.name AS subcategory_name,
              trk.id AS tracking_id, trk.application_number
       ${FROM}
       ${listWhere.length ? "WHERE " + listWhere.join(" AND ") : ""}
       ORDER BY ${orderBy}
       LIMIT $${listValues.length - 1} OFFSET $${listValues.length}`,
      listValues
    );

    const hasMore = listRes.rows.length > limit;
    const items = hasMore ? listRes.rows.slice(0, limit) : listRes.rows;

    // ---- counts (same scope, ignoring the status tab) ----
    const countValues = [];
    const countWhere = buildScope(req, countValues);
    const countRes = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE sa.status IN ('pending','processing'))::int AS upcoming,
         COUNT(*) FILTER (WHERE sa.status = 'pending'
           AND (sa.run_at AT TIME ZONE '${TZ}')::date = (NOW() AT TIME ZONE '${TZ}')::date)::int AS today,
         COUNT(*) FILTER (WHERE sa.status = 'failed')::int AS failed,
         COUNT(*) FILTER (WHERE sa.status = 'done' AND sa.executed_at > NOW() - INTERVAL '7 days')::int AS done_7d
       ${FROM}
       ${countWhere.length ? "WHERE " + countWhere.join(" AND ") : ""}`,
      countValues
    );

    res.json({ items, hasMore, counts: countRes.rows[0] });
  } catch (err) {
    console.error("SCHEDULES LIST ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ================================
   GET /entry/:id
================================ */
router.get("/entry/:id", async (req, res) => {
  try {
    const entry = await loadEntry(req.params.id);
    if (!entry) return res.status(404).json({ error: "Service entry not found" });
    if (!canAccessCentre(req.user, entry.centre_id)) return res.status(403).json({ error: "Not allowed" });

    const { rows } = await pool.query(
      `SELECT sa.*, st.name AS created_by_name, t.id AS task_id, t.status AS task_status
         FROM scheduled_actions sa
         LEFT JOIN staff st ON st.id = sa.created_by
         LEFT JOIN tasks t ON t.scheduled_action_id = sa.id
        WHERE sa.service_entry_id = $1
        ORDER BY sa.run_at ASC`,
      [entry.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================================
   PATCH /:id/cancel
================================ */
router.patch("/:id/cancel", async (req, res) => {
  try {
    const { action, error } = await loadActionForUser(req.params.id, req.user);
    if (error) return res.status(error[0]).json({ error: error[1] });
    if (!["pending", "failed"].includes(action.status)) {
      return res.status(400).json({ error: `Cannot cancel an action that is ${action.status}` });
    }

    await pool.query(
      `UPDATE scheduled_actions
          SET status = 'cancelled', cancelled_at = NOW(), cancelled_by = $2, updated_at = NOW()
        WHERE id = $1 AND status IN ('pending', 'failed')`,
      [action.id, req.user.id]
    );
    res.json({ message: "Cancelled" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================================
   POST /:id/run-now   (pending -> fire now, failed -> retry now)
================================ */
router.post("/:id/run-now", async (req, res) => {
  try {
    const { action, error } = await loadActionForUser(req.params.id, req.user);
    if (error) return res.status(error[0]).json({ error: error[1] });
    if (!["pending", "failed"].includes(action.status)) {
      return res.status(400).json({ error: `Cannot run an action that is ${action.status}` });
    }
    if (action.action_type === "whatsapp_template" && isQuietHour(new Date())) {
      return res.status(400).json({ error: "Customers are not messaged between 9 PM and 8 AM" });
    }

    await pool.query(
      `UPDATE scheduled_actions
          SET status = 'pending', run_at = NOW(),
              attempts = CASE WHEN status = 'failed' THEN 0 ELSE attempts END,
              last_error = NULL, updated_at = NOW()
        WHERE id = $1 AND status IN ('pending', 'failed')`,
      [action.id]
    );
    // Run it now instead of waiting for the next minute tick
    runScheduledActions().catch((e) => console.error("[SCHEDULED] run-now failed:", e.message));

    res.json({ message: action.action_type === "staff_task" ? "Creating the task now" : "Sending now" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================================
   PATCH /:id/reschedule   { run_at: 'YYYY-MM-DDTHH:mm' (IST) }
================================ */
router.patch("/:id/reschedule", async (req, res) => {
  try {
    const { action, error } = await loadActionForUser(req.params.id, req.user);
    if (error) return res.status(error[0]).json({ error: error[1] });
    if (action.status !== "pending") return res.status(400).json({ error: "Only scheduled actions can be moved" });

    const at = isBlank(req.body.run_at) ? null : parseIST(req.body.run_at);
    if (!validDate(at)) return res.status(400).json({ error: "Pick a valid date and time" });

    try {
      checkTime({ action_type: action.action_type }, { at, label: "New time" });
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }

    if (action.payload?.expires_at && at > new Date(action.payload.expires_at)) {
      return res.status(400).json({ error: "New time is after the appointment/deadline" });
    }

    await pool.query(
      `UPDATE scheduled_actions SET run_at = $2, updated_at = NOW() WHERE id = $1 AND status = 'pending'`,
      [action.id, at]
    );
    res.json({ message: "Rescheduled" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;