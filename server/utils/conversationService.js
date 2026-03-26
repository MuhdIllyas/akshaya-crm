import pool from "../db.js";

/**
 * Helper: Add staff to conversation
 */
export async function addStaffToConversation(conversationId, staffId) {
  await pool.query(
    `INSERT INTO chat_participants (conversation_id, staff_id, participant_type, role, joined_at)
     VALUES ($1, $2, 'staff', 'member', NOW())
     ON CONFLICT (conversation_id, staff_id) DO NOTHING`,
    [conversationId, staffId]
  );
}

/**
 * Helper: Add customer to conversation
 */
export async function addCustomerToConversation(conversationId, customerId) {
  await pool.query(
    `INSERT INTO chat_participants (conversation_id, customer_id, participant_type, role, joined_at)
     VALUES ($1, $2, 'customer', 'member', NOW())
     ON CONFLICT (conversation_id, customer_id) DO NOTHING`,
    [conversationId, customerId]
  );
}

/**
 * Resolve or create conversation
 */
export async function resolveConversation({
  channel = "internal",
  context_type = null,
  context_id = null,
  customer_id = null,
  phone_number = null,
  centre_id,
  created_by,
  name = null,
  is_group = false,
  participant_ids = null  // For direct staff chats - array of staff IDs
}) {
  let conversation;

  /* =========================
     1. FIND EXISTING DIRECT STAFF CHAT
  ========================= */
  if (!is_group && participant_ids && participant_ids.length === 2) {
    const [staff1, staff2] = participant_ids;
    
    const res = await pool.query(
      `SELECT c.* FROM chat_conversations c
       INNER JOIN chat_participants p1 ON c.id = p1.conversation_id AND p1.staff_id = $1
       INNER JOIN chat_participants p2 ON c.id = p2.conversation_id AND p2.staff_id = $2
       WHERE c.is_group = false 
         AND c.channel = $3 
         AND c.status = 'active'
         AND c.context_type IS NULL  -- No context for direct staff chats
       LIMIT 1`,
      [staff1, staff2, channel]
    );

    if (res.rows.length) {
      console.log("Found existing direct staff conversation:", res.rows[0].id);
      return res.rows[0];
    }
  }

  /* =========================
     2. FIND EXISTING SERVICE CONVERSATION
  ========================= */
  if (context_type === "service_entry" && context_id) {
    const res = await pool.query(
      `SELECT * FROM chat_conversations
       WHERE channel = $1 AND context_type = $2 AND context_id = $3
       AND status IN ('active', 'archived')
       LIMIT 1`,
      [channel, context_type, context_id]
    );

    if (res.rows.length) {
      if (res.rows[0].status === 'archived') {
        await pool.query(
          `UPDATE chat_conversations SET status = 'active', archived_at = NULL WHERE id = $1`,
          [res.rows[0].id]
        );
      }
      return res.rows[0];
    }
  }

  /* =========================
     3. FIND EXISTING CUSTOMER CONVERSATION
  ========================= */
  if (context_type === "customer" && customer_id) {
    const res = await pool.query(
      `SELECT * FROM chat_conversations
       WHERE channel = $1 AND context_type = $2 AND customer_id = $3
       AND status != 'deleted'
       LIMIT 1`,
      [channel, context_type, customer_id]
    );

    if (res.rows.length) {
      return res.rows[0];
    }
  }

  /* =========================
     4. WHATSAPP FALLBACK (by phone number)
  ========================= */
  if (channel === "whatsapp" && phone_number) {
    const res = await pool.query(
      `SELECT * FROM chat_conversations
       WHERE channel = 'whatsapp' AND phone_number = $1
       AND status != 'deleted'
       LIMIT 1`,
      [phone_number]
    );

    if (res.rows.length) {
      return res.rows[0];
    }
  }

  /* =========================
     5. CREATE NEW CONVERSATION
  ========================= */

  // Generate conversation name if not provided
  let conversationName = name;
  if (!conversationName) {
    conversationName = await generateConversationName({
      channel,
      context_type,
      context_id,
      customer_id,
      phone_number,
      created_by,
      is_group,
      participant_ids
    });
  }

  // For direct staff chat, don't set customer_id (it's NULL)
  const finalCustomerId = (context_type === "customer") ? customer_id : null;
  const finalContextType = (!is_group && participant_ids && participant_ids.length === 2) 
    ? null  // Direct staff chats have no context
    : context_type;

  const insertRes = await pool.query(
    `INSERT INTO chat_conversations
    (name, is_group, channel, context_type, context_id, centre_id, 
     customer_id, phone_number, created_by, assigned_staff_id, status, created_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'active',NOW())
    RETURNING *`,
    [
      conversationName,
      is_group,
      channel,
      finalContextType,
      context_id,
      centre_id,
      finalCustomerId,  // NULL for staff chats
      phone_number,
      created_by,
      (channel === 'whatsapp' ? created_by : null)  // Only for WhatsApp
    ]
  );

  conversation = insertRes.rows[0];
  console.log("Created new conversation:", conversation.id, "Name:", conversation.name);

  /* =========================
     6. ADD PARTICIPANTS BASED ON CONTEXT
  ========================= */
  if (!is_group && participant_ids && participant_ids.length === 2) {
    // Direct staff chat – add both staff
    for (const staffId of participant_ids) {
      await addStaffToConversation(conversation.id, staffId);
    }
  } else if (context_type === "service_entry" && context_id) {
    // Service conversation: add creator and all service participants
    await addStaffToConversation(conversation.id, created_by);
    const participantsRes = await pool.query(
      `SELECT staff_id FROM service_participants WHERE service_entry_id = $1`,
      [context_id]
    );
    for (const row of participantsRes.rows) {
      await addStaffToConversation(conversation.id, row.staff_id);
    }
  } else if (context_type === "customer" && customer_id) {
    // Customer conversation: add the customer and assigned staff (if any)
    await addCustomerToConversation(conversation.id, customer_id);
    if (conversation.assigned_staff_id) {
      await addStaffToConversation(conversation.id, conversation.assigned_staff_id);
    }
  } else if (channel === "whatsapp" && phone_number) {
    // WhatsApp conversation: add the customer (if customer_id exists) and assigned staff
    if (customer_id) {
      await addCustomerToConversation(conversation.id, customer_id);
    }
    if (conversation.assigned_staff_id) {
      await addStaffToConversation(conversation.id, conversation.assigned_staff_id);
    }
  }

  return conversation;
}

async function generateConversationName({
  channel,
  context_type,
  context_id,
  customer_id,
  phone_number,
  created_by,
  is_group,
  participant_ids
}) {
  // Service conversation
  if (context_type === "service_entry" && context_id) {
    const res = await pool.query(
      `SELECT se.id, s.name as service_name, c.name as customer_name
       FROM service_entries se
       JOIN services s ON se.service_id = s.id
       JOIN customers c ON se.customer_id = c.id
       WHERE se.id = $1`,
      [context_id]
    );

    if (res.rows.length) {
      return `${res.rows[0].service_name} - ${res.rows[0].customer_name}`;
    }
  }

  // Customer conversation (portal or WhatsApp)
  if (customer_id) {
    const res = await pool.query(
      `SELECT name FROM customers WHERE id = $1`,
      [customer_id]
    );

    if (res.rows.length) {
      return `Chat with ${res.rows[0].name}`;
    }
  }

  // WhatsApp conversation (fallback if customer not yet created)
  if (channel === "whatsapp" && phone_number) {
    return `WhatsApp: ${phone_number}`;
  }

  // Direct staff-to-staff conversation - Get names from participants
  if (!is_group && participant_ids && participant_ids.length >= 2) {
    const staffNames = await pool.query(
      `SELECT name FROM staff WHERE id = ANY($1::int[]) ORDER BY id`,
      [participant_ids]
    );
    
    if (staffNames.rows.length === 2) {
      return `${staffNames.rows[0].name} & ${staffNames.rows[1].name}`;
    } else if (staffNames.rows.length > 0) {
      return staffNames.rows.map(s => s.name).join(', ');
    }
  }

  // Group conversation
  if (is_group) {
    return "Group Conversation";
  }

  return "New Conversation";
}

/**
 * Add participants to conversation (existing function)
 */
export async function addParticipantsToConversation({
  conversation_id,
  staff_ids = [],
  customer_ids = [],
  added_by
}) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Add staff participants
    for (const staffId of staff_ids) {
      await client.query(
        `INSERT INTO chat_participants (conversation_id, staff_id, participant_type, role, joined_at)
         VALUES ($1, $2, 'staff', 'member', NOW())
         ON CONFLICT (conversation_id, staff_id) DO NOTHING`,
        [conversation_id, staffId]
      );
    }
    
    // Add customer participants
    for (const customerId of customer_ids) {
      await client.query(
        `INSERT INTO chat_participants (conversation_id, customer_id, participant_type, role, joined_at)
         VALUES ($1, $2, 'customer', 'member', NOW())
         ON CONFLICT (conversation_id, customer_id) DO NOTHING`,
        [conversation_id, customerId]
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