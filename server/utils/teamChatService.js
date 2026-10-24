// utils/teamChatService.js
//
// Keeps one Messenger group chat per team.
//
//   - The chat is an ordinary internal group (chat_conversations) tagged
//     context_type = 'team', context_id = <team id>, centre_id = NULL.
//     centre_id NULL makes it participant-owned, so members from different
//     centres (global teams) can all read and write in it.
//   - Members are chat_participants rows. Adding / removing a team member
//     adds / removes them from the chat. Deleting a team archives its chat.
//   - Everything is idempotent: ensureTeamChat() can be called any number of
//     times (it creates the chat on first use, so teams that existed before
//     this feature get a chat the first time somebody opens it).
//
// None of these helpers ever throws into the team routes: team changes must
// not fail because the chat could not be updated (see safely()).

import pool from "../db.js";
import { resolveConversation } from "./conversationService.js";

const emitTo = (io, staffIds, event, payload) => {
  if (!io) return;
  for (const id of staffIds) io.to(`user:${id}`).emit(event, payload);
};

const loadConversation = async (db, conversationId) => {
  const { rows } = await db.query(
    `
    SELECT
      c.id,
      c.name,
      c.is_group,
      c.channel,
      c.context_type,
      c.context_id,
      c.phone_number AS context_identifier,
      c.name AS context_name,
      c.status,
      c.assigned_staff_id,
      c.last_message_at,
      (
        SELECT COALESCE(
          json_agg(
            json_build_object(
              'staff_id', p.staff_id,
              'name', s.name,
              'role', s.role,
              'photo', s.photo,
              'joined_at', p.joined_at,
              'centre_name', cs.name
            )
          ),
          '[]'::json
        )
        FROM chat_participants p
        JOIN staff s ON s.id = p.staff_id
        LEFT JOIN centres cs ON cs.id = s.centre_id
        WHERE p.conversation_id = c.id
      ) AS participants
    FROM chat_conversations c
    WHERE c.id = $1
    `,
    [conversationId]
  );
  return rows[0] || null;
};

export const findTeamChat = async (db, teamId) => {
  const { rows } = await db.query(
    `
    SELECT id, status
    FROM chat_conversations
    WHERE context_type = 'team' AND context_id = $1
    ORDER BY (status = 'active') DESC, id DESC
    LIMIT 1
    `,
    [teamId]
  );
  return rows[0] || null;
};

const activeMemberIds = async (db, teamId) => {
  const { rows } = await db.query(
    `
    SELECT tm.staff_id
    FROM team_members tm
    JOIN staff s ON s.id = tm.staff_id
    WHERE tm.team_id = $1
      AND tm.is_active = true
      AND s.status = 'Active'
    `,
    [teamId]
  );
  return rows.map((r) => r.staff_id);
};

/**
 * Create the team's chat if it does not exist, bring it back if it was
 * archived/deleted, and make sure every active member is a participant.
 * Returns the conversation id, or null when the team is missing or empty.
 */
export const ensureTeamChat = async (teamId, { createdBy = null, io = null, joinStaffId = null } = {}) => {
  const lock = await pool.connect();

  try {
    // One creator at a time per team, so two people opening the chat at the
    // same moment cannot make two chats.
    await lock.query("BEGIN");
    await lock.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`team_chat:${teamId}`]);

    const teamRes = await lock.query(`SELECT id, name FROM teams WHERE id = $1`, [teamId]);
    const team = teamRes.rows[0];
    if (!team) {
      await lock.query("COMMIT");
      return null;
    }

    const teamMemberIds = await activeMemberIds(lock, teamId);
    // An admin/superadmin opening the chat from the Teams page is added too,
    // so the chat shows up in their Messenger.
    const memberIds = [...teamMemberIds];
    if (joinStaffId && !memberIds.some((id) => String(id) === String(joinStaffId))) {
      memberIds.push(Number(joinStaffId));
    }
    let conv = await findTeamChat(lock, teamId);
    let conversationId;
    let isNew = false;

    if (!conv) {
      // an empty team gets no chat (an admin alone is not a team chat)
      if (teamMemberIds.length === 0) {
        await lock.query("COMMIT");
        return null;
      }

      const created = await resolveConversation({
        channel: "internal",
        context_type: "team",
        context_id: team.id,
        customer_id: null,
        phone_number: null,
        centre_id: null,
        created_by: createdBy,
        name: team.name,
        is_group: true,
        participant_ids: memberIds,
        communication_account_id: null,
      });

      conversationId = created.id;
      isNew = true;
    } else {
      conversationId = conv.id;

      if (conv.status !== "active") {
        await lock.query(
          `UPDATE chat_conversations
           SET status = 'active', archived_at = NULL, updated_at = NOW()
           WHERE id = $1`,
          [conversationId]
        );
        isNew = true;
      }
    }

    // Add anybody who is on the team but not in the chat yet
    const added = await lock.query(
      `
      INSERT INTO chat_participants (conversation_id, staff_id, participant_type, role, joined_at)
      SELECT $1, sid, 'staff', 'member', NOW()
      FROM unnest($2::bigint[]) AS sid
      ON CONFLICT (conversation_id, staff_id) DO NOTHING
      RETURNING staff_id
      `,
      [conversationId, memberIds]
    );

    await lock.query("COMMIT");

    if (io && (isNew || added.rows.length > 0)) {
      const payload = await loadConversation(pool, conversationId);
      if (payload) {
        const notify = isNew ? memberIds : added.rows.map((r) => r.staff_id);
        emitTo(io, notify, "added_to_conversation", payload);
      }
    }

    return conversationId;
  } catch (err) {
    await lock.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    lock.release();
  }
};

/** A member left the team: take them out of its chat and drop it from their list. */
export const removeMemberFromTeamChat = async (teamId, staffId, { io = null } = {}) => {
  const conv = await findTeamChat(pool, teamId);
  if (!conv) return;

  const res = await pool.query(
    `DELETE FROM chat_participants
     WHERE conversation_id = $1 AND staff_id = $2 AND participant_type = 'staff'`,
    [conv.id, staffId]
  );

  if (res.rowCount > 0) {
    emitTo(io, [staffId], "conversation_deleted", { conversationId: conv.id });
  }
};

/** The team was deleted: hide its chat from everybody (history is kept). */
export const archiveTeamChat = async (teamId, { io = null } = {}) => {
  const conv = await findTeamChat(pool, teamId);
  if (!conv) return;

  const people = await pool.query(
    `SELECT staff_id FROM chat_participants
     WHERE conversation_id = $1 AND participant_type = 'staff'`,
    [conv.id]
  );

  await pool.query(
    `UPDATE chat_conversations
     SET status = 'archived', archived_at = NOW(), updated_at = NOW()
     WHERE id = $1`,
    [conv.id]
  );

  emitTo(io, people.rows.map((r) => r.staff_id), "conversation_deleted", { conversationId: conv.id });
};

/** Run a chat side effect without ever failing the team request that triggered it. */
export const safely = async (label, fn) => {
  try {
    return await fn();
  } catch (err) {
    console.error(`Team chat (${label}) failed:`, err);
    return null;
  }
};