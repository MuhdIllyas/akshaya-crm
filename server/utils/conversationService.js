import pool from "../db.js";

/* =========================================================
   1. CORE ORCHESTRATOR (The Switchboard)
========================================================= */
/* ---------- Direct-chat helpers ---------- */

const toId = (v) => {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
};

// Every caller (new chat button, task creation, mentions…) goes through this,
// so small differences in how they build the request can't create duplicates.
function normalizeParams(params) {
  const p = { ...params };
  p.channel = p.channel || "internal";
  if (p.created_by != null) p.created_by = toId(p.created_by);
  if (Array.isArray(p.participant_ids)) {
    p.participant_ids = [...new Set(p.participant_ids.map(toId).filter((id) => id !== null))];
  }
  return p;
}

// A plain staff-to-staff chat (or a chat with yourself, e.g. a task assigned to yourself).
// Any context other than service/customer (e.g. 'task') still counts as the same direct chat.
function isDirectInternal(p) {
  return (
    p.channel === "internal" &&
    !p.is_group &&
    Array.isArray(p.participant_ids) &&
    p.participant_ids.length >= 1 &&
    p.participant_ids.length <= 2 &&
    p.context_type !== "service_entry" &&
    p.context_type !== "customer"
  );
}

// Finds the existing non-group internal chat whose staff members are EXACTLY these people.
async function findDirectConversation(db, sortedIds) {
  const res = await db.query(
    `SELECT c.* FROM chat_conversations c
     WHERE c.channel = 'internal'
       AND COALESCE(c.is_group, false) = false
       AND (c.context_type IS NULL OR c.context_type NOT IN ('service_entry', 'customer'))
       AND c.status IN ('active', 'archived')
       AND EXISTS (SELECT 1 FROM chat_participants x WHERE x.conversation_id = c.id AND x.staff_id = $2)
       AND (
         SELECT array_agg(DISTINCT p.staff_id::int ORDER BY p.staff_id::int)
         FROM chat_participants p
         WHERE p.conversation_id = c.id AND p.participant_type = 'staff'
       ) = $1::int[]
     ORDER BY c.last_message_at DESC NULLS LAST, c.id ASC
     LIMIT 1`,
    [sortedIds, sortedIds[0]]
  );
  return res.rows[0] || null;
}

// Lookup + create inside one transaction with a lock on this pair of people,
// so two requests at the same moment can't both create a chat.
async function resolveDirectConversation(p) {
  const sortedIds = [...p.participant_ids].sort((a, b) => a - b);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`dm:${sortedIds.join(":")}`]);

    let conversation = await findDirectConversation(client, sortedIds);
    if (conversation) {
      if (conversation.status === "archived") {
        await client.query(
          `UPDATE chat_conversations SET status = 'active', archived_at = NULL WHERE id = $1`,
          [conversation.id]
        );
        conversation.status = "active";
      }
      await client.query("COMMIT");
      return conversation;
    }

    conversation = await createConversationRecord(
      { ...p, context_type: null, context_id: null, is_group: false, centre_id: null },
      null,
      null,
      client
    );
    for (const staffId of sortedIds) {
      await addStaffToConversation(conversation.id, staffId, staffId === p.created_by ? "owner" : "member", client);
    }
    await client.query("COMMIT");
    console.log("Created new direct conversation:", conversation.id, "between", sortedIds.join(" & "));
    return conversation;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function resolveConversation(rawParams) {
  const params = normalizeParams(rawParams);

  // Staff-to-staff chats have their own duplicate-proof path
  if (isDirectInternal(params)) {
    return resolveDirectConversation(params);
  }

  // 1. Look for an existing conversation
  let { conversation, externalContactId } = await findExistingConversation(params);
  
  // If found, return it immediately (and unarchive if necessary)
  if (conversation) {
    if (conversation.status === 'archived') {
      await pool.query(`UPDATE chat_conversations SET status = 'active', archived_at = NULL WHERE id = $1`, [conversation.id]);
      conversation.status = 'active';
    }
    return conversation;
  }

  // 2. Generate a name if one wasn't provided
  const name = params.name || await generateConversationName(params);

  // 3. Create the new conversation record in the database
  conversation = await createConversationRecord(params, name, externalContactId);
  console.log("Created new conversation:", conversation.id, "Name:", conversation.name);

  // 4. Assign the correct participants based on the context
  await assignParticipants(conversation, params);

  return conversation;
}

/* =========================================================
   2. LOOKUP SERVICE (Finds existing chats)
========================================================= */
async function findExistingConversation(params) {
  const { channel, context_type, context_id, customer_id, phone_number, is_group, participant_ids, communication_account_id, centre_id } = params;
  let externalContactId = null;

  // A. Internal direct chats are handled by resolveDirectConversation()

  // B. Service Conversation
  if (context_type === "service_entry" && context_id) {
    const res = await pool.query(
      `SELECT * FROM chat_conversations WHERE channel = $1 AND context_type = $2 AND context_id = $3 AND status IN ('active', 'archived') LIMIT 1`,
      [channel, context_type, context_id]
    );
    if (res.rows.length) return { conversation: res.rows[0], externalContactId };
  }

  // C. Multi-Tenant WhatsApp Contact & Conversation
  if (channel === "whatsapp" && phone_number && communication_account_id) {
    externalContactId = await findOrCreateExternalContact(phone_number, communication_account_id, centre_id, customer_id);
    const res = await pool.query(
      `SELECT * FROM chat_conversations WHERE channel = 'whatsapp' AND external_contact_id = $1 AND status != 'deleted' LIMIT 1`,
      [externalContactId]
    );
    if (res.rows.length) return { conversation: res.rows[0], externalContactId };
  }

  // D. Generic Customer Conversation (Portal, etc.)
  if (channel !== "whatsapp" && context_type === "customer" && customer_id) {
    const res = await pool.query(
      `SELECT * FROM chat_conversations WHERE channel = $1 AND context_type = $2 AND customer_id = $3 AND status != 'deleted' LIMIT 1`,
      [channel, context_type, customer_id]
    );
    if (res.rows.length) return { conversation: res.rows[0], externalContactId };
  }

  return { conversation: null, externalContactId };
}

/* =========================================================
   3. EXTERNAL CONTACT SERVICE (Tenant Isolation)
========================================================= */
async function findOrCreateExternalContact(phone_number, communication_account_id, centre_id, customer_id) {
  let ecRes = await pool.query(
    `SELECT id FROM external_contacts WHERE communication_account_id = $1 AND phone_number = $2 LIMIT 1`,
    [communication_account_id, phone_number]
  );

  if (ecRes.rows.length > 0) return ecRes.rows[0].id;

  let targetCustomerId = customer_id;
  if (!targetCustomerId) {
    const custMatch = await pool.query(
      `SELECT id FROM customers WHERE primary_phone = $1 OR primary_phone = $2 LIMIT 1`, 
      [phone_number, phone_number.replace('+', '')]
    );
    if (custMatch.rows.length > 0) targetCustomerId = custMatch.rows[0].id;
  }

  const insertEc = await pool.query(
    `INSERT INTO external_contacts (customer_id, communication_account_id, centre_id, phone_number, created_at)
     VALUES ($1, $2, $3, $4, NOW()) RETURNING id`,
    [targetCustomerId, communication_account_id, centre_id, phone_number]
  );
  
  return insertEc.rows[0].id;
}

/* =========================================================
   4. FACTORY SERVICE (Database Creation)
========================================================= */
async function createConversationRecord(params, name, externalContactId, db = pool) {
  const { is_group, channel, context_type, context_id, centre_id, customer_id, phone_number, created_by, participant_ids, communication_account_id } = params;

  const finalCustomerId = (context_type === "customer") ? customer_id : null;
  const finalContextType = (!is_group && participant_ids && participant_ids.length === 2 && channel === 'internal') ? null : context_type;

  const insertRes = await db.query(
    `INSERT INTO chat_conversations
    (name, is_group, channel, context_type, context_id, centre_id, 
     customer_id, phone_number, created_by, assigned_staff_id, communication_account_id, external_contact_id, status, created_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'active',NOW())
    RETURNING *`,
    [
      name,
      is_group,
      channel,
      finalContextType,
      context_id,
      centre_id,
      finalCustomerId, 
      phone_number,
      created_by,
      (channel === 'whatsapp' ? created_by : null),
      communication_account_id,
      externalContactId
    ]
  );

  return insertRes.rows[0];
}

/* =========================================================
   5. PARTICIPANT SERVICE (Access Control)
========================================================= */
async function assignParticipants(conversation, params) {
  const { is_group, participant_ids, context_type, context_id, customer_id, channel, phone_number, created_by, centre_id } = params;

  // 🔥 FIX: Handle ALL internal chats (both 1-on-1 and Groups)
  if (channel === 'internal' && participant_ids && participant_ids.length > 0) {
    for (const staffId of participant_ids) {
      const role = (staffId === created_by) ? 'owner' : 'member';
      await addStaffToConversation(conversation.id, staffId, role);
    }
  } 
  else if (context_type === "service_entry" && context_id) {
    await addStaffToConversation(conversation.id, created_by, 'owner');
    const participantsRes = await pool.query(`SELECT staff_id FROM service_participants WHERE service_entry_id = $1`, [context_id]);
    for (const row of participantsRes.rows) {
      await addStaffToConversation(conversation.id, row.staff_id, 'collaborator');
    }
  } 
  else if (context_type === "customer" && customer_id) {
    await addCustomerToConversation(conversation.id, customer_id);
    if (conversation.assigned_staff_id) {
      await addStaffToConversation(conversation.id, conversation.assigned_staff_id, 'owner');
    }
  } 
  else if (channel === "whatsapp" && phone_number) {
    if (customer_id) await addCustomerToConversation(conversation.id, customer_id);
    if (conversation.assigned_staff_id) {
      await addStaffToConversation(conversation.id, conversation.assigned_staff_id, 'owner');
    }
  }

  // Automatically add Centre Admin as a reviewer to external chats
  if ((channel === "whatsapp" || channel === "portal") && centre_id) {
    const adminRes = await pool.query(`SELECT admin_id FROM centres WHERE id = $1`, [centre_id]);
    if (adminRes.rows.length > 0 && adminRes.rows[0].admin_id) {
      await addStaffToConversation(conversation.id, adminRes.rows[0].admin_id, 'reviewer');
    }
  }
}

/* =========================================================
   6. NAMING UTILITY
========================================================= */
async function generateConversationName({ channel, context_type, context_id, customer_id, phone_number, is_group, participant_ids }) {
  // 1. Service Chats
  if (context_type === "service_entry" && context_id) {
    const res = await pool.query(
      `SELECT se.id, s.name as service_name, se.customer_name FROM service_entries se
       LEFT JOIN services s ON se.category_id = s.id WHERE se.id = $1`, [context_id]
    );
    if (res.rows.length) return `${res.rows[0].service_name || 'Service'} - ${res.rows[0].customer_name || 'Customer'}`;
  }

  // 2. Portal Customer Chats
  if (customer_id) {
    const res = await pool.query(`SELECT name FROM customers WHERE id = $1`, [customer_id]);
    if (res.rows.length) return `Chat with ${res.rows[0].name}`;
  }

  // 3. WhatsApp Chats
  if (channel === "whatsapp" && phone_number) return `WhatsApp: ${phone_number}`;

  // 4. 🔥 THE FIX: If it's a direct internal chat, return NULL! 
  // Let the frontend dynamically render the other person's name.
  if (channel === "internal" && !is_group) {
    return null; 
  }

  // 5. Fallback for unnamed groups
  return is_group ? "Group Conversation" : null;
}

/* =========================================================
   7. BASE UTILITIES (Exported Helpers)
========================================================= */
export async function addStaffToConversation(conversationId, staffId, role = 'member', db = pool) {
  await db.query(
    `INSERT INTO chat_participants (conversation_id, staff_id, participant_type, role, joined_at)
     VALUES ($1, $2, 'staff', $3, NOW()) ON CONFLICT (conversation_id, staff_id) DO NOTHING`,
    [conversationId, staffId, role]
  );
}

export async function addCustomerToConversation(conversationId, customerId) {
  await pool.query(
    `INSERT INTO chat_participants (conversation_id, customer_id, participant_type, role, joined_at)
     VALUES ($1, $2, 'customer', 'member', NOW()) ON CONFLICT (conversation_id, customer_id) DO NOTHING`,
    [conversationId, customerId]
  );
}

export async function addParticipantsToConversation({ conversation_id, staff_ids = [], customer_ids = [] }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const staffId of staff_ids) {
      await client.query(
        `INSERT INTO chat_participants (conversation_id, staff_id, participant_type, role, joined_at)
         VALUES ($1, $2, 'staff', 'member', NOW()) ON CONFLICT (conversation_id, staff_id) DO NOTHING`, [conversation_id, staffId]
      );
    }
    for (const customerId of customer_ids) {
      await client.query(
        `INSERT INTO chat_participants (conversation_id, customer_id, participant_type, role, joined_at)
         VALUES ($1, $2, 'customer', 'member', NOW()) ON CONFLICT (conversation_id, customer_id) DO NOTHING`, [conversation_id, customerId]
      );
    }
    await client.query('COMMIT');
    return { success: true, added_staff: staff_ids.length, added_customers: customer_ids.length };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}