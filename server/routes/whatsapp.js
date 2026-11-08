import express from "express";
import pool from "../db.js";
import { sendManualWhatsAppTemplate, sendSystemMessage, getUnreadCount } from "../utils/messageRouter.js";
import { addStaffToConversation } from "../utils/conversationService.js";
import { notifyNewLead } from "../utils/leadNotifications.js";

const router = express.Router();

router.post("/send-template", async (req, res) => {
  const { conversationId, templateName, params } = req.body;
  const io = req.app.get("io"); // assuming you store io instance on app

  if (!conversationId || !templateName) {
    return res.status(400).json({ error: "Missing conversationId or templateName" });
  }

  try {
    const result = await sendManualWhatsAppTemplate({
      conversationId,
      templateName,
      params: params || [],
      io
    });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/* =====================================================================
   🔧 SHARED BOT HELPERS
   ===================================================================== */

const BOT_API_KEY = process.env.BOT_API_KEY;
const ALLOW_OTHER_PHONE_LOOKUP = process.env.ALLOW_OTHER_PHONE_LOOKUP === "true";
const MAX_RESULTS = 5;

const botAuthOk = (req) => !BOT_API_KEY || req.get("x-bot-key") === BOT_API_KEY;

const last10 = (v) => String(v || "").replace(/\D/g, "").slice(-10);

// Libromi sends "{{var}}" literally when a variable is empty — treat that as empty.
// A customer's multi-line answer arrives with a literal "\n" (backslash + n):
// turn line breaks into ", " so "Illyas\nMamburam" becomes "Illyas, Mamburam".
const clean = (v) => {
  const s = String(v ?? "")
    .replace(/\s*(?:\\r\\n|\\n|\\r|\r?\n)+\s*/g, ", ")
    .replace(/^[,\s]+|[,\s]+$/g, "")
    .trim();
  return !s || /^\{\{.*\}\}$/.test(s) ? null : s.slice(0, 1000);
};

const isPhoneLike = (q) => {
  const d = String(q || "").replace(/\D/g, "");
  return d.length >= 10 && d.length <= 13 && /^[\d\s+()-]+$/.test(String(q));
};

/**
 * Which centre is this customer chatting with RIGHT NOW?
 * Each centre has its own WhatsApp number → its own conversation (webhook sets
 * centre_id on it). The conversation with the most recent INCOMING message is
 * the one the bot session started from. Outgoing staff messages from another
 * centre are ignored, so they can't pull the lead/chat to the wrong centre.
 */
async function findActiveWaConversation(phone10) {
  if (phone10.length !== 10) return null;
  const { rows } = await pool.query(
    `SELECT c.id, c.centre_id, c.assigned_staff_id, ce.name AS centre_name, ce.admin_id, li.last_in
     FROM chat_conversations c
     LEFT JOIN centres ce ON ce.id = c.centre_id
     CROSS JOIN LATERAL (
       SELECT MAX(m.created_at) AS last_in
       FROM chat_messages m
       WHERE m.conversation_id = c.id AND m.direction = 'incoming'
     ) li
     WHERE c.channel = 'whatsapp'
       AND c.status <> 'deleted'
       AND RIGHT(regexp_replace(c.phone_number, '\\D', '', 'g'), 10) = $1
       AND li.last_in IS NOT NULL
     ORDER BY li.last_in DESC
     LIMIT 1`,
    [phone10]
  );
  return rows[0] || null;
}

/* =====================================================================
   🤖 BOT: CHECK APPLICATION STATUS
   POST /api/whatsapp/track-application
   Header: x-bot-key: <BOT_API_KEY>
   Body:   { "query": "{{status_query}}", "wa_phone": "{{STAT_PHONE}}" }
   Reply:  { found, count, application_number, reply }

   Centre rule: the centre is the one whose WhatsApp number the customer is
   messaging (findActiveWaConversation). ONLY that centre's applications are
   shown — a customer messaging Pukayur never sees Kolathur's details.
   • Phone lookup → this centre's applications for that phone.
   • Application number → matches in this centre only (numbers can repeat
     across centres). Several in this centre → the one on the customer's own
     phone, otherwise ask for their phone number.
   • If the application belongs to a different phone, only the status is
     shown — the customer name is hidden.
   • If the centre can't be worked out (no chat record yet), we fall back to
     all centres so the bot still answers.
   ===================================================================== */

const STATUS_LABELS = {
  pending: "⏳ Pending",
  in_progress: "🔄 In progress",
  completed: "✅ Completed",
  paid: "✅ Completed",
  rejected: "❌ Rejected – please contact the centre",
  resubmit: "⚠️ Needs resubmission – please contact the centre",
};

const formatDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })
    : null;

// Centre of an application = centre of the staff who made the service entry
const BASE_SELECT = `
  SELECT st.application_number, st.status, st.current_step, st.estimated_delivery, st.updated_at,
         st.assigned_to,
         se.id AS service_entry_id, se.staff_id, se.customer_name, se.phone, se.created_at,
         s.name AS service_name, sub.name AS subcategory_name,
         stf.centre_id, ce.name AS centre_name
  FROM service_tracking st
  JOIN service_entries se ON st.service_entry_id = se.id
  LEFT JOIN services s ON se.category_id = s.id
  LEFT JOIN subcategories sub ON se.subcategory_id = sub.id
  LEFT JOIN staff stf ON stf.id = se.staff_id
  LEFT JOIN centres ce ON ce.id = stf.centre_id
`;

async function findByApplicationNumber(appNo) {
  const key = String(appNo).replace(/\s+/g, "").toUpperCase();
  if (key.length < 3) return [];
  const { rows } = await pool.query(
    `${BASE_SELECT}
     WHERE UPPER(REPLACE(st.application_number, ' ', '')) = $1
     ORDER BY st.updated_at DESC
     LIMIT 10`,
    [key]
  );
  return rows;
}

// Applications for a phone — only in the given centre (all centres if centreId is null)
async function findByPhone(phone10, centreId = null) {
  if (phone10.length !== 10) return [];
  const { rows } = await pool.query(
    `${BASE_SELECT}
     WHERE RIGHT(regexp_replace(se.phone, '\\D', '', 'g'), 10) = $1
       AND ($2::int IS NULL OR stf.centre_id = $2::int)
       -- open applications, plus ones finished in the last 30 days
       AND (st.status NOT IN ('completed', 'paid') OR st.updated_at >= NOW() - INTERVAL '30 days')
     ORDER BY st.updated_at DESC
     LIMIT ${MAX_RESULTS}`,
    [phone10, centreId]
  );
  return rows;
}

/**
 * Narrow down application-number matches (duplicates across centres).
 * Returns { rows, ambiguous }.
 */
function pickApplication(matches, waPhone, centreId) {
  // Only this centre's applications (all centres if the centre is unknown)
  const here = centreId ? matches.filter((r) => Number(r.centre_id) === Number(centreId)) : matches;
  if (here.length <= 1) return { rows: here, ambiguous: false };
  const own = here.filter((r) => last10(r.phone) === waPhone);
  if (own.length >= 1) return { rows: own.slice(0, MAX_RESULTS), ambiguous: false };
  return { rows: [], ambiguous: true };
}

const maskName = (n) => {
  const s = String(n || "").trim();
  if (s.length <= 2) return "***";
  return `${s[0]}${"*".repeat(Math.min(s.length - 2, 5))}${s[s.length - 1]}`;
};

function buildReply(rows, { intro, masked = false } = {}) {
  const name = rows[0]?.customer_name;
  const lines = [];
  if (intro) lines.push(intro);
  else if (masked) lines.push(`Here is the status of application for ${maskName(name)}:`);
  else lines.push(name ? `Hi ${name}, here is your application status:` : "Here is your application status:");
  lines.push("");

  rows.forEach((r, i) => {
    const service = [r.service_name, r.subcategory_name].filter(Boolean).join(" – ") || "Service";
    lines.push(`*${rows.length > 1 ? `${i + 1}. ` : ""}${service}*`);
    if (r.application_number) lines.push(`Application No: ${r.application_number}`);
    lines.push(`Status: ${STATUS_LABELS[r.status] || r.status || "Pending"}`);
    if (r.current_step && !["completed", "paid"].includes(r.status)) lines.push(`Stage: ${r.current_step}`);
    if (r.estimated_delivery && !["completed", "paid", "rejected"].includes(r.status)) {
      lines.push(`Expected by: ${formatDate(r.estimated_delivery)}`);
    }
    lines.push(`Last updated: ${formatDate(r.updated_at)}`);
    lines.push("");
  });

  return lines.join("\n").trim();
}

router.post("/track-application", async (req, res) => {
  if (!botAuthOk(req)) {
    return res.status(401).json({ found: false, reply: "Sorry, something went wrong. Please try again later." });
  }

  try {
    const query = clean(req.body?.query || req.body?.application_number) || "";
    const waPhone = last10(req.body?.wa_phone || req.body?.phone);
    const queryIsPhone = isPhoneLike(query);

    const conv = await findActiveWaConversation(waPhone);
    const centreId = conv?.centre_id || null;

    let rows = [];
    let note = null;
    let masked = false;

    // 1. Application number (may exist in more than one centre)
    if (query && !queryIsPhone) {
      const matches = await findByApplicationNumber(query);
      const picked = pickApplication(matches, waPhone, centreId);
      if (picked.ambiguous) {
        return res.json({
          found: false,
          count: 0,
          reply:
            `We found more than one application with number *${query}*.\n` +
            "Please send your registered phone number so we can show the right one.",
        });
      }
      rows = picked.rows;
      if (rows.length && rows.some((r) => last10(r.phone) !== waPhone)) masked = true;
      if (!rows.length) note = `We couldn't find application number *${query}*.`;
    }

    // 2. Phone number typed by the customer
    if (!rows.length && queryIsPhone) {
      const typed = last10(query);
      if (typed === waPhone || ALLOW_OTHER_PHONE_LOOKUP) {
        rows = await findByPhone(typed, centreId);
        masked = typed !== waPhone;
      } else {
        note = "For privacy, we can only show applications linked to the number you are chatting from.";
      }
    }

    // 3. Fall back to the WhatsApp number they are chatting from
    if (!rows.length && waPhone) {
      rows = await findByPhone(waPhone, centreId);
      masked = false;
      if (rows.length && note) note += "\nBut we found these applications for your WhatsApp number:";
    }

    if (!rows.length) {
      return res.json({
        found: false,
        count: 0,
        reply:
          (note ? note + "\n\n" : "") +
          "We couldn't find any application for this number. Please check the number and try again.",
      });
    }

    return res.json({
      found: true,
      count: rows.length,
      application_number: rows.length === 1 ? rows[0].application_number : "",
      reply: buildReply(rows, { intro: note || undefined, masked }),
    });
  } catch (err) {
    console.error("[track-application] Error:", err);
    return res.status(500).json({
      found: false,
      reply: "Sorry, we couldn't check the status right now. Please try again later.",
    });
  }
});

/* =====================================================================
   🤖 BOT: REQUIRED DOCUMENTS FOR A SERVICE
   POST /api/whatsapp/service-documents
   Header: x-bot-key: <BOT_API_KEY>
   Body:   { "query": "{{service_needed}}" }

   Matches what the customer typed against service and sub-category names
   (tolerates spelling mistakes: "aadhar", "pasport", "income certifcate").
   Reply: { found, service_label, reply }
     - reply          → ready-to-send WhatsApp text with the document list
     - service_label  → clean "Service – Sub-category" name (saved on the lead)
   ===================================================================== */

let catalogCache = { at: 0, items: [] };
const CATALOG_TTL_MS = 5 * 60 * 1000; // services change rarely → reload every 5 min

const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9ഀ-ൿ\s]/g, " ") // keep English, numbers, Malayalam
    .replace(/\s+/g, " ")
    .trim();

const trigrams = (s) => {
  const t = `  ${s} `;
  const set = new Set();
  for (let i = 0; i < t.length - 2; i++) set.add(t.slice(i, i + 3));
  return set;
};

// Dice similarity on trigrams: 1 = identical, 0 = nothing in common
const similarity = (a, b) => {
  if (!a || !b) return 0;
  const A = trigrams(a), B = trigrams(b);
  let common = 0;
  A.forEach((g) => B.has(g) && common++);
  return (2 * common) / (A.size + B.size);
};

function scoreName(q, name) {
  const n = norm(name);
  if (!n) return 0;
  if (n === q) return 1;
  if (q.length >= 3 && (n.includes(q) || q.includes(n))) return 0.88;
  // best of: whole-string similarity, or any word of the name vs the query
  let best = similarity(q, n);
  for (const w of n.split(" ")) if (w.length >= 3) best = Math.max(best, similarity(q, w) * 0.95);
  for (const w of q.split(" ")) if (w.length >= 3) best = Math.max(best, similarity(w, n) * 0.9);

  // Word coverage: every word the customer typed should appear (roughly) in the name.
  // "aadhar dob" → "Aadhaar Update DOB Change" beats plain "Aadhaar Update".
  const qWords = q.split(" ").filter((w) => w.length >= 2);
  const nWords = n.split(" ");
  if (qWords.length > 1) {
    const avg =
      qWords.reduce((sum, qw) => sum + Math.max(...nWords.map((nw) => (qw === nw ? 1 : similarity(qw, nw)))), 0) /
      qWords.length;
    best = Math.max(best, avg * 0.95);
  }
  return best;
}

async function loadCatalog() {
  if (Date.now() - catalogCache.at < CATALOG_TTL_MS && catalogCache.items.length) {
    return catalogCache.items;
  }
  const { rows } = await pool.query(`
    SELECT s.id AS service_id, s.name AS service_name,
           sc.id AS sub_id, sc.name AS sub_name,
           COALESCE((SELECT json_agg(rd.document_name ORDER BY rd.id)
                     FROM required_documents rd
                     WHERE rd.service_id = s.id AND rd.sub_category_id IS NULL), '[]') AS service_docs,
           COALESCE((SELECT json_agg(rd.document_name ORDER BY rd.id)
                     FROM required_documents rd
                     WHERE rd.sub_category_id = sc.id), '[]') AS sub_docs
    FROM services s
    LEFT JOIN subcategories sc ON sc.service_id = s.id
    WHERE s.status = 'active'
  `);

  // One entry per service and one per sub-category
  const items = [];
  const seenService = new Set();
  for (const r of rows) {
    if (!seenService.has(r.service_id)) {
      seenService.add(r.service_id);
      items.push({
        type: "service",
        service_id: r.service_id,
        label: r.service_name,
        names: [r.service_name],
        docs: r.service_docs,
        subs: rows.filter((x) => x.service_id === r.service_id && x.sub_id),
      });
    }
    if (r.sub_id) {
      items.push({
        type: "sub",
        service_id: r.service_id,
        label: `${r.service_name} – ${r.sub_name}`,
        names: [r.sub_name, `${r.service_name} ${r.sub_name}`],
        // service-level documents apply to every sub-category too
        docs: [...new Set([...(r.service_docs || []), ...(r.sub_docs || [])])],
      });
    }
  }
  catalogCache = { at: Date.now(), items };
  return items;
}

const docLines = (docs) => docs.map((d, i) => `${i + 1}. ${d}`).join("\n");

router.post("/service-documents", async (req, res) => {
  if (BOT_API_KEY && req.get("x-bot-key") !== BOT_API_KEY) {
    return res.status(401).json({ found: false, reply: "Sorry, something went wrong." });
  }

  try {
    const raw = clean(req.body?.query) || "";
    const q = norm(raw);
    if (q.length < 2) {
      return res.json({
        found: false,
        service_label: raw,
        reply: "Please type the service name, for example: Passport, Aadhaar update, Income certificate.",
      });
    }

    const catalog = await loadCatalog();
    const ranked = catalog
      .map((item) => ({ item, score: Math.max(...item.names.map((n) => scoreName(q, n))) }))
      .filter((r) => r.score >= 0.45)
      // prefer a sub-category over its parent service when scores are close
      .sort((a, b) => b.score - a.score || (a.item.type === "sub" ? -1 : 1));

    if (!ranked.length) {
      return res.json({
        found: false,
        service_label: raw,
        reply:
          `We couldn't find "${raw}" in our service list.\n` +
          "Our staff will share the documents needed for it.",
      });
    }

    const best = ranked[0];
    const close = ranked.filter((r) => best.score - r.score < 0.08 && r.item !== best.item).slice(0, 2);

    // A whole service with several options → show each option's documents (max 4)
    if (best.item.type === "service" && best.item.subs.length > 1) {
      const subs = catalog.filter((i) => i.type === "sub" && i.service_id === best.item.service_id).slice(0, 4);
      const parts = subs.map((s) =>
        s.docs.length ? `*${s.label}*\n${docLines(s.docs)}` : `*${s.label}*\nOur staff will confirm the documents.`
      );
      const more = best.item.subs.length > 4 ? `\n…and ${best.item.subs.length - 4} more options. Type the exact option name to see its list.` : "";
      return res.json({
        found: true,
        service_label: best.item.label,
        reply: `📄 *Documents needed for ${best.item.label}:*\n\n${parts.join("\n\n")}${more}`,
      });
    }

    // One clear match (service or sub-category)
    let reply = best.item.docs.length
      ? `📄 *Documents needed for ${best.item.label}:*\n${docLines(best.item.docs)}`
      : `*${best.item.label}*\nOur staff will confirm the documents needed for this service.`;

    // Mention near-matches so the customer can correct us
    if (close.length) {
      reply += `\n\nDid you mean something else? Similar services: ${close.map((c) => c.item.label).join(", ")}`;
    }

    return res.json({ found: true, service_label: best.item.label, reply });
  } catch (err) {
    console.error("[service-documents] Error:", err);
    return res.status(500).json({
      found: false,
      service_label: clean(req.body?.query) || "", // keep what the customer typed
      reply: "Sorry, we couldn't load the document list right now. Our staff will help you.",
    });
  }
});

/* =====================================================================
   🤖 BOT: CREATE LEAD ("New Service" branch)
   POST /api/whatsapp/create-lead
   Header: x-bot-key: <BOT_API_KEY>
   Body: { "wa_phone": "{{STAT_PHONE}}", "wa_name": "{{STAT_NAME}}",
           "service_needed": "{{service_needed}}",
           "customer_details": "{{customer_details}}",
           "docs_ready": "{{docs_ready}}" }

   Centre = the centre whose WhatsApp number the customer just messaged
   (findActiveWaConversation). A customer of centres A, B and C gets a
   separate lead in each centre they enquire with.
   Duplicate protection: an open lead for the same phone + centre in the
   last 7 days is updated instead of creating a new one.
   ===================================================================== */

router.post("/create-lead", async (req, res) => {
  if (!botAuthOk(req)) return res.status(401).json({ ok: false });

  try {
    const phone = last10(req.body?.wa_phone || req.body?.phone);
    if (phone.length !== 10) {
      return res.status(400).json({ ok: false, error: "wa_phone missing" });
    }

    const data = {
      whatsapp_name: clean(req.body?.wa_name),
      customer_details: clean(req.body?.customer_details),
      service_needed: clean(req.body?.service_needed),
      docs_ready: clean(req.body?.docs_ready),
    };

    const conv = await findActiveWaConversation(phone);
    const centreId = conv?.centre_id || null;

    // Existing customer? (helps staff; not required)
    const cust = await pool.query(
      `SELECT id FROM customers
       WHERE RIGHT(regexp_replace(primary_phone, '\\D', '', 'g'), 10) = $1
       LIMIT 1`,
      [phone]
    );
    const customerId = cust.rows[0]?.id || null;

    const existing = await pool.query(
      `SELECT id FROM leads
       WHERE phone = $1
         AND centre_id IS NOT DISTINCT FROM $2
         AND status IN ('new', 'contacted', 'follow_up')
         AND created_at >= NOW() - INTERVAL '7 days'
       ORDER BY created_at DESC
       LIMIT 1`,
      [phone, centreId]
    );

    let lead;
    if (existing.rows.length) {
      const { rows } = await pool.query(
        `UPDATE leads SET
           whatsapp_name    = COALESCE($2, whatsapp_name),
           customer_details = COALESCE($3, customer_details),
           service_needed   = COALESCE($4, service_needed),
           docs_ready       = COALESCE($5, docs_ready),
           customer_id      = COALESCE(customer_id, $6),
           updated_at       = NOW()
         WHERE id = $1
         RETURNING *`,
        [existing.rows[0].id, data.whatsapp_name, data.customer_details, data.service_needed, data.docs_ready, customerId]
      );
      lead = rows[0];
      await pool.query(
        `INSERT INTO lead_activities (lead_id, staff_id, action, details) VALUES ($1, NULL, 'enquiry', $2)`,
        [lead.id, `Customer asked again on WhatsApp: ${data.service_needed || "service"}${data.docs_ready ? ` · Documents: ${data.docs_ready}` : ""}`]
      ).catch((e) => console.warn("[create-lead] activity log skipped:", e.message));
    } else {
      const { rows } = await pool.query(
        `INSERT INTO leads (centre_id, phone, whatsapp_name, customer_details, service_needed, docs_ready, customer_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [centreId, phone, data.whatsapp_name, data.customer_details, data.service_needed, data.docs_ready, customerId]
      );
      lead = rows[0];
      await pool.query(
        `INSERT INTO lead_activities (lead_id, staff_id, action, details) VALUES ($1, NULL, 'created', $2)`,
        [lead.id, `From WhatsApp bot${data.docs_ready ? ` · Documents: ${data.docs_ready}` : ""}`]
      ).catch((e) => console.warn("[create-lead] activity log skipped:", e.message));
    }

    // Bell + Notifications page (new lead → centre team; repeat enquiry → the lead's owner)
    notifyNewLead(lead, { repeat: existing.rows.length > 0 });

    const io = req.io || req.app.get("io");
    if (io) {
      const payload = { lead, message: `New WhatsApp lead: ${data.service_needed || "Service enquiry"}` };
      if (centreId) io.to(`centre:${centreId}`).emit("new_lead", payload);
      io.emit("new_lead_global", payload);
    }

    console.log(`[create-lead] Lead #${lead.id} for ${phone} (centre ${centreId ?? "unknown"})`);
    return res.json({ ok: true, lead_id: lead.id });
  } catch (err) {
    console.error("[create-lead] Error:", err);
    return res.status(500).json({ ok: false });
  }
});

/* =====================================================================
   🤖 BOT: TALK TO STAFF → connect to the staff who handled the application
   POST /api/whatsapp/connect-staff
   Header: x-bot-key: <BOT_API_KEY>
   Body: { "wa_phone": "{{STAT_PHONE}}", "query": "{{status_query}}" }
   Reply: { ok, staff_name, reply }   → bot sends `reply`, then disables itself

   Who gets the chat (always someone from the centre the customer messaged,
   because replies go out from that centre's number):
     1. Staff handling the customer's application IN THIS CENTRE
        (service_tracking.assigned_to, else service_entries.staff_id),
        if Active and belonging to this centre
     2. Staff already assigned to this WhatsApp chat, if Active in this centre
     3. Centre admin
   Only this centre's applications are considered.
   ===================================================================== */

async function activeStaffInCentre(ids, centreId) {
  const list = ids.filter(Boolean).map(Number);
  if (!list.length || !centreId) return null;
  const { rows } = await pool.query(
    `SELECT id, name, centre_id FROM staff
     WHERE id = ANY($1::int[]) AND status = 'Active' AND centre_id = $2`,
    [list, centreId]
  );
  // keep the priority order of `ids`
  for (const id of list) {
    const s = rows.find((r) => Number(r.id) === id);
    if (s) return s;
  }
  return null;
}

router.post("/connect-staff", async (req, res) => {
  const fallbackReply = "Sure! One of our staff will reply to you here shortly. 🙏";
  if (!botAuthOk(req)) return res.status(401).json({ ok: false, reply: fallbackReply });

  try {
    const waPhone = last10(req.body?.wa_phone || req.body?.phone);
    const query = clean(req.body?.query);

    const conv = await findActiveWaConversation(waPhone);
    if (!conv || !conv.centre_id) {
      console.warn(`[connect-staff] No WhatsApp conversation found for ${waPhone}`);
      return res.json({ ok: false, reply: fallbackReply });
    }
    const centreId = conv.centre_id;

    // --- 1. Which application is this about? ---
    let candidates = [];
    if (query && !isPhoneLike(query)) {
      const matches = await findByApplicationNumber(query);
      // only applications of this centre
      candidates = matches.filter((r) => Number(r.centre_id) === Number(centreId));
    }
    if (!candidates.length) candidates = await findByPhone(waPhone, centreId); // this centre only, newest first

    // Prefer an application that is still being worked on; a finished one is only a last resort
    const DONE = ["completed", "paid", "rejected"];
    const openApp = candidates.find((r) => !DONE.includes(r.status)) || null;
    const doneApp = !openApp ? candidates[0] || null : null;
    const appHere = openApp || doneApp;

    // Open lead for this customer at this centre (the enquiry staff are already handling)
    let openLead = null;
    try {
      const { rows } = await pool.query(
        `SELECT id, assigned_to, service_needed, updated_at FROM leads
         WHERE phone = $1 AND centre_id = $2 AND status IN ('new', 'contacted', 'follow_up')
         ORDER BY updated_at DESC LIMIT 1`,
        [waPhone, centreId]
      );
      openLead = rows[0] || null;
    } catch (e) {
      /* leads table missing — ignore */
    }

    // --- 2. Pick the staff member (always active staff of this centre) ---
    //   1. staff on an OPEN application or on the customer's open lead — whichever was touched last
    //   2. staff already assigned to this chat
    //   3. staff on their latest finished application
    const appLabel = (r) =>
      r.application_number || [r.service_name, r.subcategory_name].filter(Boolean).join(" – ") || `entry #${r.service_entry_id}`;
    let staff = null;
    let reason = "";
    const tryApp = async () => {
      if (staff || !openApp) return;
      staff = await activeStaffInCentre([openApp.assigned_to, openApp.staff_id], centreId);
      if (staff) reason = `handles open application ${appLabel(openApp)}`;
    };
    const tryLead = async () => {
      if (staff || !openLead?.assigned_to) return;
      staff = await activeStaffInCentre([openLead.assigned_to], centreId);
      if (staff) reason = `has the customer's enquiry${openLead.service_needed ? ` (${openLead.service_needed})` : ""}`;
    };
    const leadIsNewer =
      openLead && (!openApp || new Date(openLead.updated_at) > new Date(openApp.updated_at));
    if (leadIsNewer) { await tryLead(); await tryApp(); }
    else { await tryApp(); await tryLead(); }
    if (!staff && conv.assigned_staff_id) {
      staff = await activeStaffInCentre([conv.assigned_staff_id], centreId);
      if (staff) reason = "already assigned to this chat";
    }
    if (!staff && doneApp) {
      staff = await activeStaffInCentre([doneApp.assigned_to, doneApp.staff_id], centreId);
      if (staff) reason = `handled their last application ${appLabel(doneApp)}`;
    }
    // No staff found → the centre admin is alerted to ASSIGN someone.
    // Admins don't do service entries, so they never become the owner of the chat or the lead.
    let toAdmin = false;
    if (!staff && conv.admin_id) {
      const { rows } = await pool.query(`SELECT id, name, centre_id FROM staff WHERE id = $1`, [conv.admin_id]);
      staff = rows[0] || null;
      toAdmin = !!staff;
      reason = "please assign a staff member";
    }

    // --- 3. Assign the chat (only to real staff) ---
    const io = req.io || req.app.get("io");
    if (staff && !toAdmin) {
      await addStaffToConversation(conv.id, staff.id, "owner");
      await pool.query(
        `UPDATE chat_conversations
         SET assigned_staff_id = $2, status = 'active', updated_at = NOW()
         WHERE id = $1`,
        [conv.id, staff.id]
      );

      // Lead for this phone + centre → give it to the same person if nobody has it
      try {
        const upd = await pool.query(
          `UPDATE leads SET assigned_to = $3, updated_at = NOW()
           WHERE phone = $1 AND centre_id = $2 AND assigned_to IS NULL
             AND status IN ('new', 'contacted', 'follow_up')
           RETURNING id`,
          [waPhone, centreId, staff.id]
        );
        for (const r of upd.rows) {
          await pool.query(
            `INSERT INTO lead_activities (lead_id, staff_id, action, details) VALUES ($1, NULL, 'assigned', $2)`,
            [r.id, `Customer asked for staff on WhatsApp → assigned to ${staff.name}`]
          );
        }
      } catch (e) {
        /* leads table not deployed yet — ignore */
      }
    }

    // --- 4. Internal note in the chat (customer does not see this) ---
    const noteParts = ["🙋 Customer asked to talk to staff."];
    if (appHere) {
      const svc = [appHere.service_name, appHere.subcategory_name].filter(Boolean).join(" – ");
      noteParts.push(`Application: ${appHere.application_number ? `${appHere.application_number} · ` : ""}${svc || "service"} · ${appHere.status}.`);
    }
    if (staff && !toAdmin) noteParts.push(`Connected to ${staff.name} — ${reason}.`);
    else noteParts.push("No staff found for this customer — admin, please assign a staff member.");
    await sendSystemMessage(conv.id, noteParts.join("\n"), io);

    // --- 5. Live alert for the chosen staff member ---
    if (io && staff) {
      const unread = await getUnreadCount(staff.id, conv.id);
      io.to(`user:${staff.id}`).emit("unread_update", { conversationId: Number(conv.id), unread });
      io.to(`user:${staff.id}`).emit("conversation_updated", {
        conversationId: Number(conv.id),
        lastMessage: "🙋 Customer asked to talk to staff",
        lastMessageSender: "System",
        time: new Date().toISOString(),
        unread,
      });
      io.to(`user:${staff.id}`).emit("staff_requested", {
        conversationId: Number(conv.id),
        phone: waPhone,
        centreId,
        applicationNumber: appHere?.application_number || null,
        message: toAdmin
          ? "A customer wants to talk to staff — please assign someone"
          : "A customer wants to talk to you on WhatsApp",
      });
    }

    console.log(`[connect-staff] ${waPhone} → staff ${staff?.id ?? "none"} (centre ${centreId}, ${reason})`);

    const centreLabel = conv.centre_name ? ` at ${conv.centre_name}` : "";
    const reply =
      staff && !toAdmin
        ? `You're now connected to *${staff.name}*${centreLabel}. They will reply to you here shortly. 🙏`
        : `Sure! Our team${centreLabel} will reply to you here shortly. 🙏`;

    return res.json({ ok: !!staff, staff_name: staff && !toAdmin ? staff.name : "", reply });
  } catch (err) {
    console.error("[connect-staff] Error:", err);
    return res.status(500).json({ ok: false, reply: fallbackReply });
  }
});

export default router;