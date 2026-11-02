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

export default router;