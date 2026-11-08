import express from "express";
import jwt from "jsonwebtoken";
import pool from "../db.js";
import { addStaffToConversation } from "../utils/conversationService.js";
// Same task creator the Tasks page uses, so follow-ups behave like any other task
// (My Tasks, Calendar, notifications). Path: routes/leads.js → services/taskService.js
import { createTask } from "../services/taskService.js";
// Bell / Notifications page entries for new and assigned leads
import { notifyNewLead, notifyLeadAssigned } from "../utils/leadNotifications.js";

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

/* =====================================================================
   FOLLOW-UP → TASK
   A lead in "Follow-up" with a date and an owner gets one task:
     "📞 Follow up: <name> – <service>", due on the follow-up date, for the owner.
   It shows in My Tasks and on the Calendar (both list tasks by due date).
   The task moves when the date or owner changes, and is closed when the
   lead leaves Follow-up (contacted / converted / lost).
   Never blocks the lead update: problems are written to the lead history.
   ===================================================================== */
const followUpTitle = (lead) => {
  const name = String(lead.customer_details || lead.whatsapp_name || "Customer")
    .replace(/\s*(?:\\n|\r?\n)+\s*/g, ", ").split(",")[0].trim();
  return `📞 Follow up: ${name}${lead.service_needed ? ` – ${lead.service_needed}` : ""}`.slice(0, 200);
};

async function closeFollowUpTask(taskId) {
  await pool.query(
    `UPDATE tasks SET status = 'completed', completed_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND status <> 'completed'`,
    [taskId]
  );
  await pool.query(`DELETE FROM calendar_events WHERE related_task_id = $1`, [taskId]); // same as the Tasks route does
}

async function syncFollowUpTask(lead, actor) {
  try {
    const task = lead.follow_up_task_id
      ? (await pool.query(`SELECT id, status FROM tasks WHERE id = $1`, [lead.follow_up_task_id])).rows[0]
      : null;
    const taskOpen = task && task.status !== "completed";
    // read the date as text straight from the DB (avoids any timezone shift)
    const day = (await pool.query(
      `SELECT to_char(follow_up_date, 'YYYY-MM-DD') AS d FROM leads WHERE id = $1`, [lead.id]
    )).rows[0]?.d || null;

    const wantsTask = lead.status === "follow_up" && day && lead.assigned_to;

    if (!wantsTask) {
      if (taskOpen) {
        await closeFollowUpTask(task.id);
        await logActivity(pool, lead.id, actor.id, "task", "Follow-up task closed");
      }
      return;
    }

    if (taskOpen) {
      // keep the existing task in step with the lead
      await pool.query(
        `UPDATE tasks SET due_date = $2, assigned_to = $3, title = $4, updated_at = NOW() WHERE id = $1`,
        [task.id, day, lead.assigned_to, followUpTitle(lead)]
      );
      return;
    }

    const { task: created } = await createTask({
      actor,
      title: followUpTitle(lead),
      description:
        `WhatsApp lead #${lead.id} · Phone ${lead.phone}` +
        (lead.docs_ready ? ` · Documents: ${lead.docs_ready}` : "") +
        `\nOpen Leads to update the customer after following up.`,
      assigned_to: lead.assigned_to,
      due_date: day,
      priority: "medium",
      related_service_id: null,
      related_service_entry_id: null,
      related_customer_id: lead.customer_id || null,
      note_id: null,
      source: "manual",
    });
    if (created?.id) {
      await pool.query(`UPDATE leads SET follow_up_task_id = $2 WHERE id = $1`, [lead.id, created.id]);
      await logActivity(pool, lead.id, actor.id, "task", `Follow-up task added to My Tasks and Calendar for ${day}`);
    }
  } catch (err) {
    console.error("[leads] follow-up task sync failed:", err.message);
    await logActivity(pool, lead.id, actor.id, "task", `Could not create the follow-up task: ${err.message}`).catch(() => {});
  }
}

/* =====================================================================
   SCHEDULED REMINDERS ON A LEAD (scheduled_actions.lead_id)
   Converted with a service entry → pending ones move to that entry, so they
   show in Service Entry and keep running. Lost / deleted → pending ones are
   cancelled. (The worker also skips any lead reminder once the lead is closed.)
   ===================================================================== */
async function moveLeadSchedules(lead, entryId, actorId) {
  try {
    const { rowCount } = await pool.query(
      `UPDATE scheduled_actions SET service_entry_id = $2, updated_at = NOW()
        WHERE lead_id = $1 AND service_entry_id IS NULL AND status IN ('pending', 'failed')`,
      [lead.id, entryId]
    );
    if (rowCount) await logActivity(pool, lead.id, actorId, "scheduled", `${rowCount} reminder(s) moved to service entry #${entryId}`);
  } catch (err) {
    console.error("[leads] moving reminders failed:", err.message);
  }
}

async function cancelLeadSchedules(lead, actorId, why) {
  try {
    const { rowCount } = await pool.query(
      `UPDATE scheduled_actions
          SET status = 'cancelled', cancelled_at = NOW(), cancelled_by = $2,
              last_error = $3, updated_at = NOW()
        WHERE lead_id = $1 AND service_entry_id IS NULL AND status IN ('pending', 'failed')`,
      [lead.id, actorId || null, why]
    );
    if (rowCount && why !== "Lead deleted") {
      await logActivity(pool, lead.id, actorId, "scheduled", `${rowCount} reminder(s) cancelled – ${why.toLowerCase()}`);
    }
  } catch (err) {
    console.error("[leads] cancelling reminders failed:", err.message);
  }
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
              ft.status AS follow_up_task_status,
              -- The database keeps IST wall-clock time; send it with its offset so browsers read it right
              to_char(l.created_at, 'YYYY-MM-DD"T"HH24:MI:SS') || '+05:30' AS created_at_ist,
              to_char(l.updated_at, 'YYYY-MM-DD"T"HH24:MI:SS') || '+05:30' AS updated_at_ist,
              (l.status = 'follow_up' AND l.follow_up_date IS NOT NULL AND l.follow_up_date <= CURRENT_DATE) AS follow_up_due
       FROM leads l
       LEFT JOIN staff a   ON a.id = l.assigned_to
       LEFT JOIN staff cr  ON cr.id = l.created_by
       LEFT JOIN centres c ON c.id = l.centre_id
       LEFT JOIN conv      ON conv.p10 = l.phone AND conv.centre_id = l.centre_id
       LEFT JOIN tasks ft  ON ft.id = l.follow_up_task_id
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
         COUNT(*) FILTER (WHERE created_at >= date_trunc('month', CURRENT_DATE))::int AS created_month,
         -- Sidebar badge: leads waiting on THIS person
         --   admin / superadmin → open leads nobody is assigned to yet
         --   staff              → new leads given to me, new leads free to take, my follow-ups due
         COUNT(*) FILTER (WHERE ${isManager(req.user)
           ? `status IN ('new','contacted','follow_up') AND assigned_to IS NULL`
           : `(status = 'new' AND (assigned_to = ${me} OR assigned_to IS NULL))
              OR (status = 'follow_up' AND assigned_to = ${me} AND follow_up_date <= CURRENT_DATE)`})::int AS attention
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
   GET /api/leads/services  → active services with their sub-categories
   (for the service pickers on the Leads page)
   ===================================================================== */
router.get("/services", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.id, s.name,
              COALESCE(json_agg(json_build_object('id', sc.id, 'name', sc.name) ORDER BY sc.name)
                       FILTER (WHERE sc.id IS NOT NULL), '[]') AS subcategories
       FROM services s
       LEFT JOIN subcategories sc ON sc.service_id = s.id
       WHERE s.status = 'active'
       GROUP BY s.id, s.name
       ORDER BY s.name`
    );
    res.json(rows);
  } catch (err) {
    console.error("[leads] services error:", err);
    res.status(500).json({ error: "Failed to load services" });
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

    // Given to someone else → tell them; nobody yet → tell the centre team
    if (lead.assigned_to) notifyLeadAssigned(lead, lead.assigned_to, myId(req.user));
    else notifyNewLead(lead, { senderId: myId(req.user) });

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
      `SELECT la.id, la.action, la.details, la.created_at,
              to_char(la.created_at, 'YYYY-MM-DD"T"HH24:MI:SS') || '+05:30' AS created_at_ist,
              s.name AS staff_name
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

    const { status, assigned_to, follow_up_date, lost_reason, converted_service_entry_id, centre_id,
            customer_details, service_needed, docs_ready } = req.body;
    const me = myId(req.user);

    // Staff can only work on a lead that is theirs (or still free). Admins can work on any.
    const onlyClaiming = Object.keys(req.body).every((k) => ["assigned_to", "status"].includes(k)) && assigned_to !== undefined;
    if (!isManager(req.user) && lead.assigned_to && lead.assigned_to !== me && !onlyClaiming) {
      const owner = await client.query(`SELECT name FROM staff WHERE id = $1`, [lead.assigned_to]);
      return res.status(403).json({ error: `This lead is with ${owner.rows[0]?.name || "another staff member"}. Ask your admin to reassign it.` });
    }
    if (service_needed !== undefined && !String(service_needed).trim()) {
      return res.status(400).json({ error: "Service can't be empty" });
    }

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
    const detailChanges = [];
    if (customer_details !== undefined && String(customer_details || "").trim() !== String(lead.customer_details || "")) {
      add("customer_details", String(customer_details || "").trim().slice(0, 500) || null);
      detailChanges.push("name");
    }
    if (service_needed !== undefined && String(service_needed).trim() !== String(lead.service_needed || "")) {
      add("service_needed", String(service_needed).trim().slice(0, 300));
      detailChanges.push(`service → ${String(service_needed).trim()}`);
    }
    if (docs_ready !== undefined && String(docs_ready || "") !== String(lead.docs_ready || "")) {
      add("docs_ready", docs_ready || null);
      detailChanges.push(`documents → ${docs_ready || "unknown"}`);
    }
    if (detailChanges.length) acts.push(["edited", `Updated ${detailChanges.join(", ")}`]);
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

    // Reminders set on the lead follow it into the service entry, or stop when it's lost
    const saved = rows[0];
    if (saved.converted_service_entry_id && saved.converted_service_entry_id !== lead.converted_service_entry_id) {
      await moveLeadSchedules(saved, saved.converted_service_entry_id, me);
    } else if (status === "lost" && lead.status !== "lost") {
      await cancelLeadSchedules(saved, me, "Lead marked lost");
    }

    // Follow-up date / status / owner changed → keep the follow-up task in step
    if (status !== undefined || follow_up_date !== undefined || assigned_to !== undefined || lead.follow_up_task_id) {
      await syncFollowUpTask(rows[0], { ...req.user, id: me });
    }

    // Admin assigned / reassigned it to someone → notify that staff member
    if (assigned_to !== undefined && newAssignee && newAssignee !== lead.assigned_to) {
      notifyLeadAssigned(rows[0], newAssignee, me);
    }

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

/* =====================================================================
   DELETE /api/leads/:id   — admin (own centre) and superadmin only
   Removes the lead and its history (lead_activities cascade).
   Its open tasks (follow-up + reminder tasks) are deleted too, like the Tasks page does.
   The WhatsApp chat and any service entry are NOT touched.
   ===================================================================== */
router.delete("/:id", async (req, res) => {
  try {
    if (!isManager(req.user)) {
      return res.status(403).json({ error: "Only an admin can delete leads" });
    }
    const id = parseInt(req.params.id);
    const { lead, error } = await loadLeadForUser(id, req.user);
    if (error) return res.status(error[0]).json({ error: error[1] });

    // Remove the lead's open tasks (its follow-up task + tasks its reminders created),
    // the same way the Tasks page deletes a task: calendar entry first, then the task.
    // Finished tasks are kept as history.
    try {
      const { rows: tasks } = await pool.query(
        `SELECT id FROM tasks
          WHERE status NOT IN ('completed', 'cancelled')
            AND (id = $2
                 OR scheduled_action_id IN (SELECT id FROM scheduled_actions
                                             WHERE lead_id = $1 AND service_entry_id IS NULL))`,
        [id, lead.follow_up_task_id || 0]
      );
      const taskIds = tasks.map((t) => t.id);
      if (taskIds.length) {
        await pool.query(`DELETE FROM calendar_events WHERE related_task_id = ANY($1::int[])`, [taskIds]);
        await pool.query(`DELETE FROM tasks WHERE id = ANY($1::int[])`, [taskIds]);
        const io = req.io || req.app.get("io");
        if (io && lead.centre_id) taskIds.forEach((tid) => io.to(`centre_${lead.centre_id}`).emit("taskDeleted", { id: tid }));
      }
    } catch (e) {
      console.warn("[leads] could not remove the lead's tasks on delete:", e.message);
    }
    await cancelLeadSchedules(lead, myId(req.user), "Lead deleted");
    await pool.query(`DELETE FROM leads WHERE id = $1`, [id]);

    console.log(`[leads] Lead #${id} (${lead.phone}) deleted by ${req.user.role} #${myId(req.user)}`);
    emitLeadChange(req, lead, "deleted");
    res.json({ ok: true });
  } catch (err) {
    console.error("[leads] delete error:", err);
    res.status(500).json({ error: "Failed to delete lead" });
  }
});

export default router;