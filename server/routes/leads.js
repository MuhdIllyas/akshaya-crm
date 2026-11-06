import express from "express";
import jwt from "jsonwebtoken";
import pool from "../db.js";
import { addStaffToConversation } from "../utils/conversationService.js";

const router = express.Router();

/* ================================
   AUTH (same pattern as servicetracking.js)
================================ */
const authenticateToken = (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Access token required" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(403).json({ error: "Invalid or expired token" });
  }
};
router.use(authenticateToken);

const STATUSES = ["new", "contacted", "follow_up", "converted", "lost"];
const OPEN = ["new", "contacted", "follow_up"];
const STATUS_LABEL = { new: "New", contacted: "Contacted", follow_up: "Follow-up", converted: "Converted", lost: "Lost" };

const isSuper = (u) => u.role === "superadmin";
// Only admin and superadmin assign / reassign leads. Staff and supervisors can only take a free lead for themselves.
const isManager = (u) => ["admin", "superadmin"].includes(u.role);
const myId = (u) => parseInt(u.id);
const myCentre = (u) => (u.centre_id ? parseInt(u.centre_id) : null);
const last10 = (v) => String(v || "").replace(/\D/g, "").slice(-10);

// Only these roles do service work, so only they can own a lead.
// Admins and superadmins assign leads to staff; they don't take leads themselves.
const LEAD_OWNER_ROLES = ["staff", "supervisor"];
const OWNER_ROLE_SQL = `COALESCE(LOWER(role), 'staff') IN ('staff', 'supervisor')`;

async function logActivity(db, leadId, staffId, action, details = null) {
  await db.query(
    `INSERT INTO lead_activities (lead_id, staff_id, action, details) VALUES ($1, $2, $3, $4)`,
    [leadId, staffId || null, action, details]
  );
}

// Live refresh for everyone looking at the Leads page of that centre
function emitLeadChange(req, lead, type = "updated") {
  const io = req.io || req.app.get("io");
  if (!io || !lead) return;
  const payload = { type, lead_id: lead.id, centre_id: lead.centre_id };
  if (lead.centre_id) io.to(`centre:${lead.centre_id}`).emit("lead_changed", payload);
  io.emit("lead_changed_global", payload);
}

async function loadLeadForUser(id, user) {
  const { rows } = await pool.query(`SELECT * FROM leads WHERE id = $1`, [id]);
  if (!rows.length) return { error: [404, "Lead not found"] };
  const lead = rows[0];
  if (!isSuper(user) && lead.centre_id !== null && lead.centre_id !== myCentre(user)) {
    return { error: [403, "This lead belongs to another centre"] };
  }
  return { lead };
}

/* =====================================================================
   GET /api/leads
   ?status=open|new|contacted|follow_up|converted|lost|all   (default open)
   ?assigned=me|unassigned|all                                 (default all)
   ?centre_id=      superadmin only
   ?search=         phone, name, details, service
   Each lead also carries:
     conversation_id  → its WhatsApp chat in Messenger (same centre + phone)
     matched_entry_id → a service entry made for this phone at this centre
                        after the lead came in (= probably converted)
   ===================================================================== */
router.get("/", async (req, res) => {
  try {
    const { status = "open", assigned = "all", centre_id, search } = req.query;
    const where = [];
    const vals = [];
    const push = (v) => { vals.push(v); return `$${vals.length}`; };

    if (isSuper(req.user)) {
      if (centre_id && centre_id !== "all") where.push(`l.centre_id = ${push(parseInt(centre_id))}`);
    } else {
      // unknown-centre leads are visible until someone claims them
      where.push(`(l.centre_id = ${push(myCentre(req.user))} OR l.centre_id IS NULL)`);
    }

    if (status === "open") where.push(`l.status IN ('new', 'contacted', 'follow_up')`);
    else if (STATUSES.includes(status)) where.push(`l.status = ${push(status)}`);

    if (assigned === "me") where.push(`l.assigned_to = ${push(myId(req.user))}`);
    else if (assigned === "unassigned") where.push(`l.assigned_to IS NULL`);

    if (search && search.trim()) {
      const p = push(`%${search.trim()}%`);
      where.push(`(l.phone ILIKE ${p} OR l.whatsapp_name ILIKE ${p} OR l.customer_details ILIKE ${p} OR l.service_needed ILIKE ${p})`);
    }

    const { rows } = await pool.query(
      `WITH conv AS (
         SELECT DISTINCT ON (RIGHT(regexp_replace(phone_number, '\\D', '', 'g'), 10), centre_id)
                id, centre_id, RIGHT(regexp_replace(phone_number, '\\D', '', 'g'), 10) AS p10
         FROM chat_conversations
         WHERE channel = 'whatsapp' AND status <> 'deleted' AND phone_number IS NOT NULL
         ORDER BY RIGHT(regexp_replace(phone_number, '\\D', '', 'g'), 10), centre_id, last_message_at DESC NULLS LAST
       ),
       recent_entries AS (
         SELECT se.id, se.created_at, stf.centre_id,
                RIGHT(regexp_replace(se.phone, '\\D', '', 'g'), 10) AS p10
         FROM service_entries se
         JOIN staff stf ON stf.id = se.staff_id
         WHERE se.created_at >= NOW() - INTERVAL '60 days'
       )
       SELECT l.*,
              a.name  AS assigned_to_name,
              cr.name AS created_by_name,
              c.name  AS centre_name,
              conv.id AS conversation_id,
              (SELECT re.id FROM recent_entries re
                WHERE l.status IN ('new', 'contacted', 'follow_up')
                  AND re.p10 = l.phone
                  AND re.centre_id = l.centre_id
                  AND re.created_at >= l.created_at - INTERVAL '1 day'
                ORDER BY re.created_at ASC LIMIT 1) AS matched_entry_id,
              to_char(l.follow_up_date, 'YYYY-MM-DD') AS follow_up_day,
              (l.status = 'follow_up' AND l.follow_up_date IS NOT NULL AND l.follow_up_date <= CURRENT_DATE) AS follow_up_due
       FROM leads l
       LEFT JOIN staff a   ON a.id = l.assigned_to
       LEFT JOIN staff cr  ON cr.id = l.created_by
       LEFT JOIN centres c ON c.id = l.centre_id
       LEFT JOIN conv      ON conv.p10 = l.phone AND conv.centre_id = l.centre_id
       ${where.length ? "WHERE " + where.join(" AND ") : ""}
       ORDER BY
         CASE WHEN l.status = 'new' THEN 0
              WHEN l.status = 'follow_up' AND l.follow_up_date <= CURRENT_DATE THEN 1
              WHEN l.status IN ('contacted', 'follow_up') THEN 2
              ELSE 3 END,
         CASE WHEN l.status = 'follow_up' THEN l.follow_up_date END ASC NULLS LAST,
         l.created_at DESC
       LIMIT 500`,
      vals
    );
    res.json(rows);
  } catch (err) {
    console.error("[leads] list error:", err);
    res.status(500).json({ error: "Failed to load leads" });
  }
});

/* =====================================================================
   GET /api/leads/summary  → numbers for the cards and tab badges
   ===================================================================== */
router.get("/summary", async (req, res) => {
  try {
    const vals = [];
    let where = "";
    if (!isSuper(req.user)) {
      vals.push(myCentre(req.user));
      where = `WHERE (centre_id = $1 OR centre_id IS NULL)`;
    } else if (req.query.centre_id && req.query.centre_id !== "all") {
      vals.push(parseInt(req.query.centre_id));
      where = `WHERE centre_id = $1`;
    }
    vals.push(myId(req.user));
    const me = `$${vals.length}`;

    const { rows } = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'new')::int                                  AS new,
         COUNT(*) FILTER (WHERE status = 'contacted')::int                            AS contacted,
         COUNT(*) FILTER (WHERE status = 'follow_up')::int                            AS follow_up,
         COUNT(*) FILTER (WHERE status IN ('new','contacted','follow_up'))::int       AS open,
         COUNT(*) FILTER (WHERE status = 'converted')::int                            AS converted,
         COUNT(*) FILTER (WHERE status = 'lost')::int                                 AS lost,
         COUNT(*) FILTER (WHERE status = 'follow_up' AND follow_up_date <= CURRENT_DATE)::int AS due_today,
         COUNT(*) FILTER (WHERE status IN ('new','contacted','follow_up') AND assigned_to = ${me})::int AS mine,
         COUNT(*) FILTER (WHERE status IN ('new','contacted','follow_up') AND assigned_to IS NULL)::int AS unassigned,
         COUNT(*) FILTER (WHERE status = 'converted' AND converted_at >= date_trunc('month', CURRENT_DATE))::int AS converted_month,
         COUNT(*) FILTER (WHERE created_at >= date_trunc('month', CURRENT_DATE))::int AS created_month
       FROM leads ${where}`,
      vals
    );
    res.json(rows[0]);
  } catch (err) {
    console.error("[leads] summary error:", err);
    res.status(500).json({ error: "Failed to load summary" });
  }
});

/* =====================================================================
   GET /api/leads/staff  → active staff of the centre (for "Assign to")
   superadmin: ?centre_id=
   ===================================================================== */
router.get("/staff", async (req, res) => {
  try {
    const centreId = isSuper(req.user) ? parseInt(req.query.centre_id) || null : myCentre(req.user);
    if (!centreId) return res.json([]);
    const { rows } = await pool.query(
      `SELECT id, name FROM staff
       WHERE centre_id = $1 AND status = 'Active' AND ${OWNER_ROLE_SQL}
       ORDER BY name`,
      [centreId]
    );
    res.json(rows);
  } catch (err) {
    console.error("[leads] staff error:", err);
    res.status(500).json({ error: "Failed to load staff" });
  }
});

/* =====================================================================
   POST /api/leads  → walk-in / phone-call lead added by staff
   Body: { phone, customer_details, service_needed, docs_ready, source, notes, assign_to_me }
   ===================================================================== */
router.post("/", async (req, res) => {
  const client = await pool.connect();
  try {
    const phone = last10(req.body?.phone);
    if (phone.length !== 10) return res.status(400).json({ error: "Enter a valid 10-digit phone number" });
    if (!req.body?.service_needed?.trim()) return res.status(400).json({ error: "Enter the service the customer needs" });

    const centreId = isSuper(req.user) ? parseInt(req.body.centre_id) || null : myCentre(req.user);
    const source = ["walk_in", "phone_call", "whatsapp_manual", "referral"].includes(req.body.source) ? req.body.source : "walk_in";
    let assignTo = null;
    if (isManager(req.user)) {
      if (req.body.assigned_to) {
        const s = await client.query(
          `SELECT id FROM staff WHERE id = $1 AND status = 'Active' AND centre_id = $2 AND ${OWNER_ROLE_SQL}`,
          [parseInt(req.body.assigned_to), centreId]
        );
        if (!s.rows.length) return res.status(400).json({ error: "Pick an active staff member of this centre" });
        assignTo = s.rows[0].id;
      }
    } else if (req.body.assign_to_me !== false) {
      assignTo = myId(req.user);
    }

    const cust = await client.query(
      `SELECT id FROM customers WHERE RIGHT(regexp_replace(primary_phone, '\\D', '', 'g'), 10) = $1 LIMIT 1`,
      [phone]
    );

    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO leads (centre_id, phone, customer_details, service_needed, docs_ready, source, status,
                          assigned_to, customer_id, notes, created_by, first_contact_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
       RETURNING *`,
      [centreId, phone, req.body.customer_details?.trim() || null, req.body.service_needed.trim(),
       req.body.docs_ready || null, source, assignTo ? "contacted" : "new", assignTo, cust.rows[0]?.id || null,
       req.body.notes?.trim() || null, myId(req.user)]
    );
    const lead = rows[0];
    await logActivity(client, lead.id, myId(req.user), "created", `Added manually (${source.replace("_", " ")})`);
    if (lead.notes) await logActivity(client, lead.id, myId(req.user), "note", lead.notes);
    await client.query("COMMIT");

    emitLeadChange(req, lead, "created");
    res.status(201).json(lead);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[leads] create error:", err);
    res.status(500).json({ error: "Failed to add lead" });
  } finally {
    client.release();
  }
});

/* =====================================================================
   GET /api/leads/:id/activity
   ===================================================================== */
router.get("/:id/activity", async (req, res) => {
  try {
    const { error } = await loadLeadForUser(parseInt(req.params.id), req.user);
    if (error) return res.status(error[0]).json({ error: error[1] });
    const { rows } = await pool.query(
      `SELECT la.id, la.action, la.details, la.created_at, s.name AS staff_name
       FROM lead_activities la
       LEFT JOIN staff s ON s.id = la.staff_id
       WHERE la.lead_id = $1
       ORDER BY la.created_at DESC, la.id DESC
       LIMIT 100`,
      [parseInt(req.params.id)]
    );
    res.json(rows);
  } catch (err) {
    console.error("[leads] activity error:", err);
    res.status(500).json({ error: "Failed to load activity" });
  }
});

/* =====================================================================
   POST /api/leads/:id/notes   Body: { note }
   ===================================================================== */
router.post("/:id/notes", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { lead, error } = await loadLeadForUser(id, req.user);
    if (error) return res.status(error[0]).json({ error: error[1] });
    const note = String(req.body?.note || "").trim().slice(0, 2000);
    if (!note) return res.status(400).json({ error: "Note is empty" });

    await logActivity(pool, id, myId(req.user), "note", note);
    await pool.query(
      `UPDATE leads SET notes = $2, updated_at = NOW(),
              first_contact_at = COALESCE(first_contact_at, NOW())
       WHERE id = $1`,
      [id, note]
    );
    emitLeadChange(req, lead);
    res.json({ ok: true });
  } catch (err) {
    console.error("[leads] note error:", err);
    res.status(500).json({ error: "Failed to save note" });
  }
});

/* =====================================================================
   POST /api/leads/:id/open-chat
   Makes sure the staff member is in the lead's WhatsApp chat (so it shows
   in their Messenger), claims the lead if nobody has it, and returns the
   conversation id to open.
   ===================================================================== */
router.post("/:id/open-chat", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { lead, error } = await loadLeadForUser(id, req.user);
    if (error) return res.status(error[0]).json({ error: error[1] });

    const { rows } = await pool.query(
      `SELECT id FROM chat_conversations
       WHERE channel = 'whatsapp' AND status <> 'deleted'
         AND RIGHT(regexp_replace(phone_number, '\\D', '', 'g'), 10) = $1
         AND ($2::int IS NULL OR centre_id = $2::int)
       ORDER BY last_message_at DESC NULLS LAST
       LIMIT 1`,
      [lead.phone, lead.centre_id]
    );
    if (!rows.length) {
      return res.status(404).json({ error: "No WhatsApp chat yet for this number. Call the customer or send a template from Messenger." });
    }
    const conversationId = rows[0].id;

    await addStaffToConversation(conversationId, myId(req.user), "member");
    if (!lead.assigned_to && !isManager(req.user)) {
      await pool.query(
        `UPDATE leads SET assigned_to = $2, centre_id = COALESCE(centre_id, $3), updated_at = NOW() WHERE id = $1`,
        [id, myId(req.user), myCentre(req.user)]
      );
      await logActivity(pool, id, myId(req.user), "claimed", "Claimed while opening the chat");
      emitLeadChange(req, lead);
    }
    res.json({ conversation_id: conversationId });
  } catch (err) {
    console.error("[leads] open-chat error:", err);
    res.status(500).json({ error: "Failed to open chat" });
  }
});

/* =====================================================================
   PATCH /api/leads/:id
   Body (any of): status, assigned_to, follow_up_date, lost_reason,
                  converted_service_entry_id, centre_id (superadmin)
   Rules:
     • staff can only take a lead for themselves (or let go of their own);
       admin / supervisor / superadmin can assign anyone
     • lost needs a reason; follow-up needs a date
     • every change is written to the activity history
   ===================================================================== */
router.patch("/:id", async (req, res) => {
  const client = await pool.connect();
  try {
    const id = parseInt(req.params.id);
    const { lead, error } = await loadLeadForUser(id, req.user);
    if (error) return res.status(error[0]).json({ error: error[1] });

    const { status, assigned_to, follow_up_date, lost_reason, converted_service_entry_id, centre_id } = req.body;
    const me = myId(req.user);

    if (status !== undefined && !STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${STATUSES.join(", ")}` });
    }
    if (status === "lost" && !String(lost_reason || "").trim()) {
      return res.status(400).json({ error: "Please give a reason when marking a lead as lost" });
    }
    if (status === "follow_up" && !follow_up_date && !lead.follow_up_date) {
      return res.status(400).json({ error: "Please pick a follow-up date" });
    }

    let newAssignee;
    if (assigned_to !== undefined) {
      newAssignee = assigned_to ? parseInt(assigned_to) : null;
      if (!isManager(req.user)) {
        const takingForSelf = newAssignee === me;
        const releasingOwn = newAssignee === null && lead.assigned_to === me;
        if (!takingForSelf && !releasingOwn) {
          return res.status(403).json({ error: "You can only take a lead for yourself. Ask your admin to assign others." });
        }
        if (takingForSelf && lead.assigned_to && lead.assigned_to !== me) {
          return res.status(409).json({ error: "Someone else already has this lead. Ask your admin to reassign it." });
        }
      }
      if (newAssignee) {
        const s = await client.query(
          `SELECT id, name, centre_id FROM staff WHERE id = $1 AND status = 'Active' AND ${OWNER_ROLE_SQL}`,
          [newAssignee]
        );
        if (!s.rows.length) return res.status(400).json({ error: "Leads can only be given to active staff members" });
        const leadCentre = lead.centre_id ?? myCentre(req.user);
        if (leadCentre && s.rows[0].centre_id !== leadCentre) {
          return res.status(400).json({ error: "That staff member is in another centre" });
        }
      }
    }

    let entryId;
    if (converted_service_entry_id !== undefined && converted_service_entry_id !== null && converted_service_entry_id !== "") {
      entryId = parseInt(converted_service_entry_id);
      const e = await client.query(`SELECT id FROM service_entries WHERE id = $1`, [entryId]);
      if (!e.rows.length) return res.status(400).json({ error: `Service entry #${entryId} not found` });
    }

    const sets = [];
    const vals = [];
    const add = (col, val) => { vals.push(val); sets.push(`${col} = $${vals.length}`); };
    const acts = [];

    if (status !== undefined && status !== lead.status) {
      add("status", status);
      if (status === "converted") add("converted_at", new Date());
      acts.push(["status", `${STATUS_LABEL[lead.status]} → ${STATUS_LABEL[status]}`]);
    }
    if (assigned_to !== undefined && newAssignee !== lead.assigned_to) {
      add("assigned_to", newAssignee);
      if (newAssignee === me && !isManager(req.user)) acts.push(["claimed", null]);
      else if (newAssignee) {
        const n = await client.query(`SELECT id, name FROM staff WHERE id = ANY($1::int[])`, [[newAssignee, lead.assigned_to].filter(Boolean)]);
        const nameOf = (id) => n.rows.find((r) => r.id === id)?.name || "someone";
        acts.push(["assigned", lead.assigned_to
          ? `Reassigned from ${nameOf(lead.assigned_to)} to ${nameOf(newAssignee)}`
          : `Assigned to ${nameOf(newAssignee)}`]);
      } else acts.push(["assigned", "Unassigned"]);
    }
    if (follow_up_date !== undefined) {
      add("follow_up_date", follow_up_date || null);
      if (follow_up_date) {
        const [y, m, d] = String(follow_up_date).slice(0, 10).split("-").map(Number);
        const nice = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
        acts.push(["follow_up", `Follow-up on ${nice}`]);
      }
    }
    if (lost_reason !== undefined) {
      add("lost_reason", lost_reason || null);
      if (status === "lost") acts.push(["lost", lost_reason]);
    }
    if (entryId) {
      add("converted_service_entry_id", entryId);
      acts.push(["converted", `Linked to service entry #${entryId}`]);
    }
    // Staff from the lead's centre touching an unknown-centre lead claims it for their centre
    if (centre_id !== undefined && isSuper(req.user)) add("centre_id", centre_id ? parseInt(centre_id) : null);
    else if (lead.centre_id === null && !isSuper(req.user)) add("centre_id", myCentre(req.user));

    if (!sets.length) return res.json(lead);
    if (!lead.first_contact_at) sets.push(`first_contact_at = NOW()`);

    await client.query("BEGIN");
    vals.push(id);
    const { rows } = await client.query(
      `UPDATE leads SET ${sets.join(", ")}, updated_at = NOW() WHERE id = $${vals.length} RETURNING *`,
      vals
    );
    for (const [action, details] of acts) await logActivity(client, id, me, action, details);
    await client.query("COMMIT");

    emitLeadChange(req, rows[0]);
    res.json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[leads] update error:", err);
    res.status(500).json({ error: "Failed to update lead" });
  } finally {
    client.release();
  }
});

export default router;