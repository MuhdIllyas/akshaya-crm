// Tags (like WhatsApp lists). Each staff member keeps their own named tags
// and tags chats and notes with them; Messenger and Notes filter by a tag.
// Every query is scoped to req.user.id, so nobody sees another person's tags.

import express from "express";
import jwt from "jsonwebtoken";
import pool from "../db.js";
import { io } from "../server.js";

const router = express.Router();

export const TAG_COLORS = ["blue", "green", "amber", "rose", "violet", "teal", "orange", "slate"];
const MAX_TAGS = 30;
const MAX_NAME = 40;

router.use((req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(403).json({ error: "Invalid or expired token" });
  }
});

const toId = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const cleanName = (name) => String(name || "").replace(/\s+/g, " ").trim().slice(0, MAX_NAME);

// The user's tags, each with the ids of its chats and notes.
async function tagsFor(staffId) {
  const { rows } = await pool.query(
    `SELECT l.id, l.name, l.color, l.position,
            COALESCE((SELECT array_agg(lc.conversation_id ORDER BY lc.added_at DESC)
                        FROM staff_tag_conversations lc WHERE lc.tag_id = l.id), '{}') AS conversation_ids,
            COALESCE((SELECT array_agg(ln.note_id ORDER BY ln.added_at DESC)
                        FROM staff_tag_notes ln WHERE ln.tag_id = l.id), '{}') AS note_ids
       FROM staff_tags l
      WHERE l.staff_id = $1
      ORDER BY l.position, l.id`,
    [staffId]
  );
  return rows;
}

// Other open tabs / devices of the same person refresh their tags.
const announce = (staffId) => {
  try {
    io.to(`user:${staffId}`).emit("tags_updated");
  } catch (err) {
    console.error("tags: socket emit failed", err);
  }
};

async function ownTag(tagId, staffId) {
  const { rows } = await pool.query(`SELECT * FROM staff_tags WHERE id = $1 AND staff_id = $2`, [tagId, staffId]);
  return rows[0] || null;
}

// Same visibility rule as GET /api/notes/all.
async function canSeeNote(user, noteId) {
  const values = [noteId, user.id];
  let centreFilter = "";
  if (user.role !== "superadmin") {
    values.push(user.centre_id);
    centreFilter = "AND s.centre_id = $3";
  }
  const { rows } = await pool.query(
    `SELECT 1 FROM notes n
       LEFT JOIN staff s ON s.id = n.created_by
      WHERE n.id = $1 ${centreFilter}
        AND (n.visibility IN ('global', 'centre') OR n.created_by = $2
             OR (n.visibility <> 'private' AND EXISTS (
                   SELECT 1 FROM note_mentions nm WHERE nm.note_id = n.id AND nm.staff_id = $2)))`,
    values
  );
  return rows.length > 0;
}

async function isChatMember(conversationId, staffId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM chat_participants WHERE conversation_id = $1 AND staff_id = $2`,
    [conversationId, staffId]
  );
  return rows.length > 0;
}

/* ---------- tags ---------- */

router.get("/", async (req, res) => {
  try {
    res.json(await tagsFor(req.user.id));
  } catch (err) {
    console.error("tags: load failed", err);
    res.status(500).json({ error: "Couldn't load your tags" });
  }
});

router.post("/", async (req, res) => {
  try {
    const name = cleanName(req.body?.name);
    if (!name) return res.status(400).json({ error: "Give the tag a name" });
    const color = TAG_COLORS.includes(req.body?.color) ? req.body.color : TAG_COLORS[0];

    const { rows: count } = await pool.query(`SELECT COUNT(*)::int AS n, COALESCE(MAX(position), -1) AS last FROM staff_tags WHERE staff_id = $1`, [req.user.id]);
    if (count[0].n >= MAX_TAGS) return res.status(400).json({ error: `You can have up to ${MAX_TAGS} tags` });

    const { rows } = await pool.query(
      `INSERT INTO staff_tags (staff_id, name, color, position) VALUES ($1, $2, $3, $4) RETURNING id`,
      [req.user.id, name, color, count[0].last + 1]
    );
    announce(req.user.id);
    const tags = await tagsFor(req.user.id);
    res.status(201).json(tags.find((l) => l.id === rows[0].id));
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "You already have a tag with that name" });
    console.error("tags: create failed", err);
    res.status(500).json({ error: "Couldn't create the tag" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const id = toId(req.params.id);
    if (!id || !(await ownTag(id, req.user.id))) return res.status(404).json({ error: "Tag not found" });

    const name = req.body?.name !== undefined ? cleanName(req.body.name) : null;
    if (req.body?.name !== undefined && !name) return res.status(400).json({ error: "Give the tag a name" });
    const color = TAG_COLORS.includes(req.body?.color) ? req.body.color : null;

    await pool.query(
      `UPDATE staff_tags SET name = COALESCE($1, name), color = COALESCE($2, color), updated_at = NOW()
        WHERE id = $3 AND staff_id = $4`,
      [name, color, id, req.user.id]
    );
    announce(req.user.id);
    const tags = await tagsFor(req.user.id);
    res.json(tags.find((l) => l.id === id));
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "You already have a tag with that name" });
    console.error("tags: update failed", err);
    res.status(500).json({ error: "Couldn't update the tag" });
  }
});

// Body: { ids: [tagId, ...] } in the new order.
router.put("/order", async (req, res) => {
  const ids = (Array.isArray(req.body?.ids) ? req.body.ids : []).map(toId).filter(Boolean);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (let i = 0; i < ids.length; i++) {
      await client.query(`UPDATE staff_tags SET position = $1 WHERE id = $2 AND staff_id = $3`, [i, ids[i], req.user.id]);
    }
    await client.query("COMMIT");
    announce(req.user.id);
    res.json(await tagsFor(req.user.id));
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("tags: reorder failed", err);
    res.status(500).json({ error: "Couldn't reorder your tags" });
  } finally {
    client.release();
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = toId(req.params.id);
    const { rowCount } = await pool.query(`DELETE FROM staff_tags WHERE id = $1 AND staff_id = $2`, [id, req.user.id]);
    if (!rowCount) return res.status(404).json({ error: "Tag not found" });
    announce(req.user.id);
    res.json({ success: true });
  } catch (err) {
    console.error("tags: delete failed", err);
    res.status(500).json({ error: "Couldn't delete the tag" });
  }
});

/* ---------- items ---------- */

const ITEM_TABLES = {
  conversations: { table: "staff_tag_conversations", column: "conversation_id", canUse: (user, id) => isChatMember(id, user.id) },
  notes: { table: "staff_tag_notes", column: "note_id", canUse: (user, id) => canSeeNote(user, id) },
};

// PUT adds, DELETE removes: /api/tags/:id/conversations/:itemId, /api/tags/:id/notes/:itemId
router.put("/:id/:kind/:itemId", async (req, res) => {
  const kind = ITEM_TABLES[req.params.kind];
  if (!kind) return res.status(404).json({ error: "Not found" });
  try {
    const tagId = toId(req.params.id);
    const itemId = toId(req.params.itemId);
    if (!tagId || !itemId || !(await ownTag(tagId, req.user.id))) return res.status(404).json({ error: "Tag not found" });
    if (!(await kind.canUse(req.user, itemId))) return res.status(403).json({ error: "You can't tag this" });

    await pool.query(
      `INSERT INTO ${kind.table} (tag_id, ${kind.column}) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [tagId, itemId]
    );
    announce(req.user.id);
    res.json({ success: true });
  } catch (err) {
    console.error("tags: add item failed", err);
    res.status(500).json({ error: "Couldn't add the tag" });
  }
});

router.delete("/:id/:kind/:itemId", async (req, res) => {
  const kind = ITEM_TABLES[req.params.kind];
  if (!kind) return res.status(404).json({ error: "Not found" });
  try {
    const tagId = toId(req.params.id);
    const itemId = toId(req.params.itemId);
    if (!tagId || !itemId || !(await ownTag(tagId, req.user.id))) return res.status(404).json({ error: "Tag not found" });

    await pool.query(`DELETE FROM ${kind.table} WHERE tag_id = $1 AND ${kind.column} = $2`, [tagId, itemId]);
    announce(req.user.id);
    res.json({ success: true });
  } catch (err) {
    console.error("tags: remove item failed", err);
    res.status(500).json({ error: "Couldn't remove the tag" });
  }
});

export default router;
