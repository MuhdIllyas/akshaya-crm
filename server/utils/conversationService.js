import pool from "../db.js";

/**
 * Helper: Add staff to conversation
 */
export async function addStaffToConversation(conversationId, staffId, role = 'member') {
  await pool.query(
    `INSERT INTO chat_participants (conversation_id, staff_id, participant_type, role, joined_at)
     VALUES ($1, $2, 'staff', $3, NOW())
     ON CONFLICT (conversation_id, staff_id) DO NOTHING`,
    [conversationId, staffId, role]
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
  centre_id = null,
  created_by = null,
  name = null,
  is_group = false,
  participant_ids = null,
  communication_account_id = null
}) {
  let conversation;
  let externalContactId = null;

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
         AND c.context_type IS NULL
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
     3. FIND EXISTING GENERIC CUSTOMER CONVERSATION (Non-WhatsApp)
  ========================= */
  // 🔥 Modified: Force WhatsApp traffic to skip this and use the tenant-isolated block below
  if (channel !== "whatsapp" && context_type === "customer" && customer_id) {
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
     4. 🔥 THE NEW MULTI-TENANT WHATSAPP RESOLVER 🔥
  ========================= */
  if (channel === "whatsapp" && phone_number && communication_account_id) {
    
    // A. Attempt to find the specific local contact for this Centre's WhatsApp account
    let ecRes = await pool.query(
      `SELECT id FROM external_contacts 
       WHERE communication_account_id = $1 AND phone_number = $2 LIMIT 1`,
      [communication_account_id, phone_number]
    );

    if (ecRes.rows.length > 0) {
      externalContactId = ecRes.rows[0].id;
    } else {
      // B. Contact doesn't exist for this account. Create it.
      // Try to map it to a global customer profile if we don't already have the customer_id
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
      externalContactId = insertEc.rows[0].id;
    }

    // C. Find the specific conversation tied to this External Contact
    const res = await pool.query(
      `SELECT * FROM chat_conversations
       WHERE channel = 'whatsapp' 
         AND external_contact_id = $1
         AND status != 'deleted'
       LIMIT 1`,
      [externalContactId]
    );

    if (res.rows.length) {
      return res.rows[0];
    }
  }

  /* =========================
     5. CREATE NEW CONVERSATION
  ========================= */

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

  const finalCustomerId = (context_type === "customer") ? customer_id : null;
  const finalContextType = (!is_group && participant_ids && participant_ids.length === 2) 
    ? null  
    : context_type;

  const insertRes = await pool.query(
    `INSERT INTO chat_conversations
    (name, is_group, channel, context_type, context_id, centre_id, 
     customer_id, phone_number, created_by, assigned_staff_id, communication_account_id, external_contact_id, status, created_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'active',NOW())
    RETURNING *`,
    [
      conversationName,
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
      externalContactId // 🔥 Embeds the isolated contact identity
    ]
  );

  conversation = insertRes.rows[0];
  console.log("Created new conversation:", conversation.id, "Name:", conversation.name);

  /* =========================
     6. ADD PARTICIPANTS BASED ON CONTEXT
  ========================= */
  if (!is_group && participant_ids && participant_ids.length === 2) {
    for (const staffId of participant_ids) {
      await addStaffToConversation(conversation.id, staffId);
    }
  } else if (context_type === "service_entry" && context_id) {
    await addStaffToConversation(conversation.id, created_by, 'owner');
    const participantsRes = await pool.query(
      `SELECT staff_id FROM service_participants WHERE service_entry_id = $1`,
      [context_id]
    );
    for (const row of participantsRes.rows) {
      await addStaffToConversation(conversation.id, row.staff_id, 'collaborator');
    }
  } else if (context_type === "customer" && customer_id) {
    await addCustomerToConversation(conversation.id, customer_id);
    if (conversation.assigned_staff_id) {
      await addStaffToConversation(conversation.id, conversation.assigned_staff_id);
    }
  } else if (channel === "whatsapp" && phone_number) {
    if (customer_id) await addCustomerToConversation(conversation.id, customer_id);
    if (conversation.assigned_staff_id) await addStaffToConversation(conversation.id, conversation.assigned_staff_id);
  }

  // Automatically add Centre Admin as a reviewer to external chats
  if ((channel === "whatsapp" || channel === "portal") && centre_id) {
    const adminRes = await pool.query(`SELECT admin_id FROM centres WHERE id = $1`, [centre_id]);
    if (adminRes.rows.length > 0 && adminRes.rows[0].admin_id) {
      await addStaffToConversation(conversation.id, adminRes.rows[0].admin_id, 'reviewer');
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
  if (context_type === "service_entry" && context_id) {
    const res = await pool.query(
      `SELECT se.id, s.name as service_name, se.customer_name
       FROM service_entries se
       LEFT JOIN services s ON se.category_id = s.id
       WHERE se.id = $1`,
      [context_id]
    );

    if (res.rows.length) {
      const serviceName = res.rows[0].service_name || 'Service';
      const customerName = res.rows[0].customer_name || 'Customer';
      return `${serviceName} - ${customerName}`;
    }
  }

  if (customer_id) {
    const res = await pool.query(
      `SELECT name FROM customers WHERE id = $1`,
      [customer_id]
    );

    if (res.rows.length) {
      return `Chat with ${res.rows[0].name}`;
    }
  }

  if (channel === "whatsapp" && phone_number) {
    return `WhatsApp: ${phone_number}`;
  }

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
    
    for (const staffId of staff_ids) {
      await client.query(
        `INSERT INTO chat_participants (conversation_id, staff_id, participant_type, role, joined_at)
         VALUES ($1, $2, 'staff', 'member', NOW())
         ON CONFLICT (conversation_id, staff_id) DO NOTHING`,
        [conversation_id, staffId]
      );
    }
    
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