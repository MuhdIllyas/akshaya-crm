import express from 'express';
import pool from '../db.js';
import jwt from 'jsonwebtoken';
import { io } from '../server.js'; // 🔥 1. IMPORT SOCKET.IO

const router = express.Router();

// Middleware to verify token and role
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    console.log('servicemanagement.js: No token provided');
    return res.status(403).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.error('servicemanagement.js: Token verification error:', err.message);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Apply middleware to all routes in this file
router.use(authenticateToken);

// 🔥 2. NEW ROUTE: GET /api/notes/unread - Count new/unread notes
router.get('/unread', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { centre_id, id: userId, role } = req.user;
    
    // Count notes created in the last 24 hours OR notes where the user was mentioned
    let query = `
      SELECT COUNT(DISTINCT n.id) as unread_count
      FROM notes n
      LEFT JOIN staff s ON n.created_by = s.id
      WHERE n.created_by != $1 
      AND n.created_at >= NOW() - INTERVAL '24 hours'
      AND (
        n.visibility = 'global' 
        OR (n.visibility = 'centre' AND s.centre_id = $2)
        OR EXISTS (SELECT 1 FROM note_mentions nm WHERE nm.note_id = n.id AND nm.staff_id = $1)
      )
    `;
    
    // Superadmins see global and their own mentions
    if (role === 'superadmin') {
      query = `
        SELECT COUNT(DISTINCT n.id) as unread_count
        FROM notes n
        WHERE n.created_by != $1
        AND n.created_at >= NOW() - INTERVAL '24 hours'
        AND (
          n.visibility = 'global'
          OR EXISTS (SELECT 1 FROM note_mentions nm WHERE nm.note_id = n.id AND nm.staff_id = $1)
        )
      `;
    }

    const result = await client.query(query, [userId, centre_id]);
    res.json({ count: parseInt(result.rows[0].unread_count) || 0 });
  } catch (err) {
    console.error('Error fetching unread notes count:', err);
    res.status(500).json({ error: 'Failed to fetch unread notes count' });
  } finally {
    client.release();
  }
});


// GET /api/notes/all - Fetch all notes for the centre
router.get('/all', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { centre_id, id: userId, role } = req.user;
    
    let query = `
      SELECT 
        n.id, n.title, n.content, n.visibility, n.created_at, 
        n.related_service_entry_id,
        n.related_service_tracking_id, 
        n.created_by, 
        s.name AS creator_name,
        se.customer_name,
        se.token_id,
        (SELECT COUNT(*) FROM note_mentions nm WHERE nm.note_id = n.id AND nm.staff_id = $1) as is_mentioned
      FROM notes n
      LEFT JOIN staff s ON n.created_by = s.id
      LEFT JOIN service_entries se ON n.related_service_entry_id = se.id
      WHERE 1=1
    `;
    
    const values = [userId];
    let idx = 2;

    if (role !== 'superadmin') {
      query += ` AND s.centre_id = $${idx++}`;
      values.push(centre_id);
    }

    query += ` AND (
      n.visibility = 'global' OR 
      n.visibility = 'centre' OR 
      n.created_by = $1 OR 
      EXISTS (SELECT 1 FROM note_mentions nm WHERE nm.note_id = n.id AND nm.staff_id = $1)
    )`;

    query += ` ORDER BY n.created_at DESC LIMIT 100`;

    const result = await client.query(query, values);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching all notes:', err);
    res.status(500).json({ error: 'Failed to fetch notes' });
  } finally {
    client.release();
  }
});

// --- 2. Create Note ---
router.post("/", async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      title,
      content,
      visibility = "centre",
      mentions = [],
      related_customer_id,
      related_service_id,
      related_service_entry_id,
      related_service_tracking_id
    } = req.body;

    if (!content?.trim()) {
      return res.status(400).json({ error: "Content is required" });
    }

    await client.query("BEGIN");

    const noteResult = await client.query(
      `
      INSERT INTO notes (
        centre_id, title, content, visibility, created_by,
        related_customer_id, related_service_id, related_service_entry_id, related_service_tracking_id,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING *
      `,
      [
        req.user.centre_id,
        title || null,
        content,
        visibility,
        req.user.id,
        related_customer_id || null,
        related_service_id || null,
        related_service_entry_id || null,
        related_service_tracking_id || null
      ]
    );

    const note = noteResult.rows[0];

    // Insert Mentions safely
    if (Array.isArray(mentions) && mentions.length > 0) {
      for (const staffId of mentions) {
        await client.query(
          `
          INSERT INTO note_mentions (note_id, staff_id, created_at)
          VALUES ($1, $2, NOW())
          ON CONFLICT (note_id, staff_id) DO NOTHING
          `,
          [note.id, staffId]
        );
      }
    }

    await client.query("COMMIT");

    // 🔥 3. TRIGGER SOCKET EVENTS FOR REAL-TIME BADGE UPDATES
    try {
      // Alert specifically mentioned users
      if (Array.isArray(mentions) && mentions.length > 0) {
        mentions.forEach(staffId => {
          io.to(`user_${staffId}`).emit('unread_notes_update', { type: 'mention' });
        });
      }

      // Alert the centre or everyone based on visibility
      if (visibility === 'centre') {
        io.to(`centre_${req.user.centre_id}`).emit('unread_notes_update', { type: 'centre' });
      } else if (visibility === 'global') {
        io.emit('unread_notes_update', { type: 'global' });
      }
    } catch (socketErr) {
      console.error("Failed to emit socket event for notes:", socketErr);
    }

    res.status(201).json(note);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("CREATE NOTE ERROR:", err);
    res.status(500).json({ error: "Failed to create note" });
  } finally {
    client.release();
  }
});

// --- 3. Get Notes by Customer ID ---
router.get("/customer/:id", async (req, res) => {
  if (isNaN(parseInt(req.params.id, 10))) return res.status(400).json({ error: "Invalid customer ID" });

  try {
    const result = await pool.query(
      `
      SELECT 
        n.*, 
        s.name AS created_by_name,
        t.id AS task_id, t.title AS task_title, t.status AS task_status, 
        t.due_date AS task_due_date, t.assigned_to AS task_assigned_to,
        ts.name AS task_assigned_to_name,
        (
          SELECT COALESCE(json_agg(json_build_object('staff_id', nm.staff_id, 'staff_name', ms.name)), '[]'::json)
          FROM note_mentions nm
          JOIN staff ms ON ms.id = nm.staff_id
          WHERE nm.note_id = n.id
        ) AS mentions
      FROM notes n
      LEFT JOIN staff s ON s.id = n.created_by
      LEFT JOIN tasks t ON t.note_id = n.id
      LEFT JOIN staff ts ON ts.id = t.assigned_to
      WHERE n.related_customer_id = $1
      ORDER BY n.created_at DESC
      `,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load customer notes" });
  }
});

// --- 4. Get Notes by Service Entry ID ---
router.get("/service-entry/:id", async (req, res) => {
  if (isNaN(parseInt(req.params.id, 10))) return res.status(400).json({ error: "Invalid service entry ID" });

  try {
    const result = await pool.query(
      `
      SELECT 
        n.*, 
        s.name AS created_by_name,
        t.id AS task_id, t.title AS task_title, t.status AS task_status, 
        t.due_date AS task_due_date, t.assigned_to AS task_assigned_to,
        ts.name AS task_assigned_to_name,
        (
          SELECT COALESCE(json_agg(json_build_object('staff_id', nm.staff_id, 'staff_name', ms.name)), '[]'::json)
          FROM note_mentions nm
          JOIN staff ms ON ms.id = nm.staff_id
          WHERE nm.note_id = n.id
        ) AS mentions
      FROM notes n
      LEFT JOIN staff s ON s.id = n.created_by
      LEFT JOIN tasks t ON t.note_id = n.id
      LEFT JOIN staff ts ON ts.id = t.assigned_to
      WHERE n.related_service_entry_id = $1
      ORDER BY n.created_at DESC
      `,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load service entry notes" });
  }
});

// --- 5. Update a Note ---
router.put("/:id", async (req, res) => {
  if (isNaN(parseInt(req.params.id, 10))) return res.status(400).json({ error: "Invalid note ID" });

  try {
    const noteCheck = await pool.query("SELECT * FROM notes WHERE id = $1", [req.params.id]);
    if (!noteCheck.rows.length) return res.status(404).json({ error: "Note not found" });

    const note = noteCheck.rows[0];
    const canEdit = note.created_by === req.user.id || req.user.role === "admin" || req.user.role === "superadmin";

    if (!canEdit) return res.status(403).json({ error: "Unauthorized" });

    const { title, content, visibility } = req.body;

    const result = await pool.query(
      `
      UPDATE notes
      SET title = $1, content = $2, visibility = $3, updated_at = NOW()
      WHERE id = $4
      RETURNING *
      `,
      [title, content, visibility, req.params.id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update note" });
  }
});

// --- 6. Delete a Note ---
router.delete("/:id", async (req, res) => {
  const noteId = parseInt(req.params.id, 10);
  if (isNaN(noteId)) return res.status(400).json({ error: "Invalid note ID" });

  const client = await pool.connect();
  
  try {
    const noteCheck = await client.query("SELECT * FROM notes WHERE id = $1", [noteId]);
    if (!noteCheck.rows.length) return res.status(404).json({ error: "Note not found" });

    const note = noteCheck.rows[0];
    const canDelete = note.created_by === req.user.id || req.user.role === "admin" || req.user.role === "superadmin";

    if (!canDelete) return res.status(403).json({ error: "Unauthorized" });

    await client.query("BEGIN");
    await client.query("DELETE FROM note_mentions WHERE note_id = $1", [noteId]);
    await client.query("DELETE FROM notes WHERE id = $1", [noteId]);
    await client.query("COMMIT");
    
    res.json({ success: true, message: "Note deleted successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Failed to delete note" });
  } finally {
    client.release();
  }
});

export default router;