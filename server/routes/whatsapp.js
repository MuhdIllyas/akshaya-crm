import express from "express";
import pool from "../db.js";
import { sendManualWhatsAppTemplate } from "../utils/messageRouter.js";

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
   🤖 BOT: CHECK APPLICATION STATUS
   Called by the Libromi chatbot ("Check Your Status" → Rest API block).

   POST /api/whatsapp/track-application
   Header: x-bot-key: <BOT_API_KEY from .env>
   Body:   { "query": "{{Application_Number}}", "wa_phone": "{{STAT_PHONE}}" }

   Reply:  { found: true|false, count, reply: "<ready-to-send WhatsApp text>" }
   The bot just saves `reply` into a variable and sends it.

   Lookup order:
     1. query looks like an application number → match service_tracking.application_number
     2. query is a phone number (10+ digits)   → applications for that phone
        (only if it is the same number they are chatting from, unless
         ALLOW_OTHER_PHONE_LOOKUP=true)
     3. nothing matched                        → applications for the WhatsApp number itself
   ===================================================================== */

const BOT_API_KEY = process.env.BOT_API_KEY;
const ALLOW_OTHER_PHONE_LOOKUP = process.env.ALLOW_OTHER_PHONE_LOOKUP === "true";
const MAX_RESULTS = 5;

const STATUS_LABELS = {
  pending: "⏳ Pending",
  in_progress: "🔄 In progress",
  completed: "✅ Completed",
  paid: "✅ Completed",
  rejected: "❌ Rejected – please contact the centre",
  resubmit: "⚠️ Needs resubmission – please contact the centre",
};

const last10 = (v) => String(v || "").replace(/\D/g, "").slice(-10);

const formatDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })
    : null;

const BASE_SELECT = `
  SELECT st.application_number, st.status, st.current_step, st.estimated_delivery, st.updated_at,
         se.customer_name, se.phone, se.created_at,
         s.name AS service_name, sub.name AS subcategory_name
  FROM service_tracking st
  JOIN service_entries se ON st.service_entry_id = se.id
  LEFT JOIN services s ON se.category_id = s.id
  LEFT JOIN subcategories sub ON se.subcategory_id = sub.id
`;

async function findByApplicationNumber(appNo) {
  const clean = String(appNo).replace(/\s+/g, "").toUpperCase();
  if (clean.length < 3) return [];
  const { rows } = await pool.query(
    `${BASE_SELECT}
     WHERE UPPER(REPLACE(st.application_number, ' ', '')) = $1
     LIMIT 1`,
    [clean]
  );
  return rows;
}

async function findByPhone(phone10) {
  if (phone10.length !== 10) return [];
  const { rows } = await pool.query(
    `${BASE_SELECT}
     WHERE RIGHT(regexp_replace(se.phone, '\\D', '', 'g'), 10) = $1
       -- open applications, plus ones finished in the last 30 days
       AND (st.status NOT IN ('completed', 'paid') OR st.updated_at >= NOW() - INTERVAL '30 days')
     ORDER BY st.updated_at DESC
     LIMIT ${MAX_RESULTS}`,
    [phone10]
  );
  return rows;
}

function buildReply(rows, { intro } = {}) {
  const name = rows[0]?.customer_name;
  const lines = [];
  lines.push(intro || (name ? `Hi ${name}, here is your application status:` : "Here is your application status:"));
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

  lines.push("For any help, reply *Staff* to talk to our team.");
  return lines.join("\n");
}

router.post("/track-application", async (req, res) => {
  // Simple shared-secret check so only our bot can call this
  if (BOT_API_KEY && req.get("x-bot-key") !== BOT_API_KEY) {
    return res.status(401).json({ found: false, reply: "Sorry, something went wrong. Please try again later." });
  }

  try {
    const query = String(req.body?.query || req.body?.application_number || "").trim();
    const waPhone = last10(req.body?.wa_phone || req.body?.phone);
    const queryDigits = query.replace(/\D/g, "");
    const queryIsPhone = queryDigits.length >= 10 && queryDigits.length <= 13 && /^[\d\s+()-]+$/.test(query);

    let rows = [];
    let note = null;

    // 1. Application number
    if (query && !queryIsPhone) {
      rows = await findByApplicationNumber(query);
      if (!rows.length) note = `We couldn't find application number *${query}*.`;
    }

    // 2. Phone number typed by the customer
    if (!rows.length && queryIsPhone) {
      const typed = last10(queryDigits);
      if (typed === waPhone || ALLOW_OTHER_PHONE_LOOKUP) {
        rows = await findByPhone(typed);
      } else {
        // Privacy: don't show another person's applications
        note = "For privacy, we can only show applications linked to the number you are chatting from.";
      }
    }

    // 3. Fall back to the WhatsApp number they are chatting from
    if (!rows.length && waPhone) {
      rows = await findByPhone(waPhone);
      if (rows.length && note) note += "\nBut we found these applications for your WhatsApp number:";
    }

    if (!rows.length) {
      return res.json({
        found: false,
        count: 0,
        reply:
          (note ? note + "\n\n" : "") +
          "We couldn't find any application for this number. Please check the application number and try again, or reply *Staff* to talk to our team.",
      });
    }

    return res.json({
      found: true,
      count: rows.length,
      reply: buildReply(rows, { intro: note || undefined }),
    });
  } catch (err) {
    console.error("[track-application] Error:", err);
    return res.status(500).json({
      found: false,
      reply: "Sorry, we couldn't check the status right now. Please try again later or reply *Staff*.",
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

   Centre: the bot can't tell which number the customer wrote to, so we use
   the WhatsApp conversation in Sahayi that most recently received a message
   from this phone (the Messenger webhook already stores centre_id on it).
   Duplicate protection: an open lead for the same phone + centre in the last
   7 days is updated instead of creating a new one.
   ===================================================================== */

// Libromi sends "{{var}}" literally when a variable is empty — treat that as empty
const clean = (v) => {
  const s = String(v ?? "").trim();
  return !s || /^\{\{.*\}\}$/.test(s) ? null : s.slice(0, 1000);
};

async function findCentreForPhone(phone10) {
  const { rows } = await pool.query(
    `SELECT c.centre_id
     FROM chat_conversations c
     JOIN chat_messages m ON m.conversation_id = c.id
     WHERE c.channel = 'whatsapp'
       AND c.centre_id IS NOT NULL
       AND RIGHT(regexp_replace(c.phone_number, '\\D', '', 'g'), 10) = $1
     ORDER BY m.created_at DESC
     LIMIT 1`,
    [phone10]
  );
  return rows[0]?.centre_id || null;
}

router.post("/create-lead", async (req, res) => {
  if (BOT_API_KEY && req.get("x-bot-key") !== BOT_API_KEY) {
    return res.status(401).json({ ok: false });
  }

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

    const centreId = await findCentreForPhone(phone);

    // Existing customer? (helps staff; not required)
    const cust = await pool.query(
      `SELECT id FROM customers
       WHERE RIGHT(regexp_replace(primary_phone, '\\D', '', 'g'), 10) = $1
       LIMIT 1`,
      [phone]
    );
    const customerId = cust.rows[0]?.id || null;

    // Update an open lead from the last 7 days instead of duplicating
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
    } else {
      const { rows } = await pool.query(
        `INSERT INTO leads (centre_id, phone, whatsapp_name, customer_details, service_needed, docs_ready, customer_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [centreId, phone, data.whatsapp_name, data.customer_details, data.service_needed, data.docs_ready, customerId]
      );
      lead = rows[0];
    }

    // Live alert for staff of that centre (and superadmins listening to all)
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

export default router;