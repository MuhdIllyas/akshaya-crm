import express from 'express';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import pool from '../../db.js';
import { sendSystemMessage } from '../../utils/messageRouter.js';
import { logActivity } from '../../utils/activityLogger.js';

const router = express.Router();

// Multer setup for document uploads
const uploadDir = 'uploads/service_documents';
const fullUploadPath = path.join(process.cwd(), uploadDir);
if (!fs.existsSync(fullUploadPath)) {
  fs.mkdirSync(fullUploadPath, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, fullUploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|txt/;
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.test(ext)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'));
    }
  },
});

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Unauthorized - No token provided" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      console.error("Token verification error:", err);
      return res.status(403).json({ error: "Invalid or expired token" });
    }

    req.user = user;
    next();
  });
};

// ==================== HELPER FUNCTIONS ====================

// Get conversation for a service entry (creates if missing)
async function getOrCreateServiceConversation(serviceEntryId, serviceName, customerName, createdBy) {
  // Get centre_id from staff associated with the service entry
  const centreRes = await pool.query(
    `SELECT staff.centre_id
     FROM service_entries se
     JOIN staff ON se.staff_id = staff.id
     WHERE se.id = $1`,
    [serviceEntryId]
  );
  const centreId = centreRes.rows[0]?.centre_id;
  if (!centreId) throw new Error('Centre not found for service entry');

  const convRes = await pool.query(
    `SELECT * FROM chat_conversations 
     WHERE context_type = 'service_entry' AND context_id = $1`,
    [serviceEntryId]
  );
  if (convRes.rows.length) {
    // Ensure current user is a participant
    await addStaffToConversation(convRes.rows[0].id, createdBy);
    return convRes.rows[0];
  }

  const name = `${serviceName} – ${customerName}`;
  const result = await pool.query(
    `INSERT INTO chat_conversations
     (name, is_group, channel, context_type, context_id, centre_id, created_by, status, created_at)
     VALUES ($1, true, 'internal', 'service_entry', $2, $3, $4, 'active', NOW())
     RETURNING *`,
    [name, serviceEntryId, centreId, createdBy]
  );
  const conversation = result.rows[0];

  // Add the creator as a participant
  await addStaffToConversation(conversation.id, createdBy);

  return conversation;
}

// Add staff to service conversation
async function addStaffToConversation(conversationId, staffId) {
  await pool.query(
    `INSERT INTO chat_participants (conversation_id, staff_id, participant_type, role, joined_at)
     VALUES ($1, $2, 'staff', 'member', NOW())
     ON CONFLICT (conversation_id, staff_id) DO NOTHING`,
    [conversationId, staffId]
  );
}

// Check if user has permission for service action
async function canAccessService(serviceEntryId, userId, userRole) {
  if (userRole === 'superadmin') return true;
  if (userRole === 'admin') {
    const centreRes = await pool.query(
      `SELECT staff.centre_id
       FROM service_entries se
       JOIN staff ON se.staff_id = staff.id
       WHERE se.id = $1`,
      [serviceEntryId]
    );
    if (centreRes.rows.length && centreRes.rows[0].centre_id === userId) return true;
  }
  if (userRole === 'staff') {
    const partRes = await pool.query(
      `SELECT 1 FROM service_participants WHERE service_entry_id = $1 AND staff_id = $2`,
      [serviceEntryId, userId]
    );
    if (partRes.rows.length) return true;
    const assignRes = await pool.query(
      `SELECT 1 FROM service_entries WHERE id = $1 AND staff_id = $2`,
      [serviceEntryId, userId]
    );
    if (assignRes.rows.length) return true;
  }
  return false;
}

// ==================== ROUTES ====================

// GET /api/servicecollaboration/:serviceEntryId/participants
router.get('/:serviceEntryId/participants', authenticateToken, async (req, res) => {
  const { serviceEntryId } = req.params;
  try {
    const allowed = await canAccessService(serviceEntryId, req.user.id, req.user.role);
    if (!allowed) {
      return res.status(403).json({ error: 'Not authorized to view participants' });
    }

    const participants = await pool.query(
      `SELECT sp.*, s.name, s.role as staff_role
       FROM service_participants sp
       JOIN staff s ON sp.staff_id = s.id
       WHERE sp.service_entry_id = $1
       ORDER BY sp.role, s.name`,
      [serviceEntryId]
    );

    const ownerRes = await pool.query(
      `SELECT se.staff_id, s.name, s.role
       FROM service_entries se
       JOIN staff s ON se.staff_id = s.id
       WHERE se.id = $1`,
      [serviceEntryId]
    );
    const owner = ownerRes.rows[0];
    const ownerExists = participants.rows.some(p => p.staff_id === owner?.staff_id);
    if (owner && !ownerExists) {
      participants.rows.unshift({
        service_entry_id: parseInt(serviceEntryId),
        staff_id: owner.staff_id,
        role: 'owner',
        added_by: null,
        added_at: null,
        name: owner.name,
        staff_role: owner.role,
      });
    }
    res.json(participants.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch participants' });
  }
});

// POST /api/servicecollaboration/:serviceEntryId/participants
router.post('/:serviceEntryId/participants', authenticateToken, async (req, res) => {
  const { serviceEntryId } = req.params;
  const { staffId, role = 'collaborator' } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get service owner and centre details
    const ownerRes = await client.query(
      `SELECT se.staff_id, s.centre_id
       FROM service_entries se
       JOIN staff s ON se.staff_id = s.id
       WHERE se.id = $1`,
      [serviceEntryId]
    );
    if (!ownerRes.rows.length) {
      return res.status(404).json({ error: 'Service not found' });
    }
    const service = ownerRes.rows[0];
    const isOwner = service.staff_id === req.user.id;
    const isAdmin = req.user.role === 'admin' && service.centre_id === req.user.centre_id;
    const isSuperadmin = req.user.role === 'superadmin';
    if (!isOwner && !isAdmin && !isSuperadmin) {
      return res.status(403).json({ error: 'Not authorized to add participants' });
    }

    // Check if staff exists and is in same centre (if not superadmin)
    const staffRes = await client.query(
      `SELECT name, centre_id FROM staff WHERE id = $1`,
      [staffId]
    );
    if (!staffRes.rows.length) {
      return res.status(400).json({ error: 'Staff not found' });
    }
    const staff = staffRes.rows[0];
    if (!isSuperadmin && staff.centre_id !== service.centre_id) {
      return res.status(400).json({ error: 'Staff must belong to the same centre' });
    }

    // Insert into service_participants
    await client.query(
      `INSERT INTO service_participants (service_entry_id, staff_id, role, added_by, added_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (service_entry_id, staff_id) DO UPDATE SET role = EXCLUDED.role`,
      [serviceEntryId, staffId, role, req.user.id]
    );

    // Get or create conversation for this service
    const serviceInfo = await client.query(
      `SELECT se.id, s.name as service_name, se.customer_name
       FROM service_entries se
       JOIN services s ON se.category_id = s.id
       WHERE se.id = $1`,
      [serviceEntryId]
    );
    const { service_name, customer_name } = serviceInfo.rows[0];
    const conversation = await getOrCreateServiceConversation(
      serviceEntryId,
      service_name,
      customer_name,
      req.user.id
    );

    await addStaffToConversation(conversation.id, staffId);

    await sendSystemMessage(
      conversation.id,
      `${staff.name} added as ${role} to the service.`,
      req.io
    );

    await logActivity({
      centre_id: service.centre_id,
      related_type: 'service_entry',
      related_id: serviceEntryId,
      action: 'Collaborator Added',
      description: `${staff.name} added as ${role} to service ${service_name}`,
      performed_by: req.user.id,
      performed_by_role: req.user.role
    });

    await client.query('COMMIT');
    res.json({ message: 'Participant added successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to add participant' });
  } finally {
    client.release();
  }
});

// DELETE /api/servicecollaboration/:serviceEntryId/participants/:staffId
router.delete('/:serviceEntryId/participants/:staffId', authenticateToken, async (req, res) => {
  const { serviceEntryId, staffId } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get service owner and centre details
    const ownerRes = await client.query(
      `SELECT se.staff_id, s.centre_id
       FROM service_entries se
       JOIN staff s ON se.staff_id = s.id
       WHERE se.id = $1`,
      [serviceEntryId]
    );
    if (!ownerRes.rows.length) return res.status(404).json({ error: 'Service not found' });
    const service = ownerRes.rows[0];
    const isOwner = service.staff_id === req.user.id;
    const isAdmin = req.user.role === 'admin' && service.centre_id === req.user.centre_id;
    const isSuperadmin = req.user.role === 'superadmin';
    if (!isOwner && !isAdmin && !isSuperadmin) {
      return res.status(403).json({ error: 'Not authorized to remove participants' });
    }

    await client.query(
      `DELETE FROM service_participants WHERE service_entry_id = $1 AND staff_id = $2`,
      [serviceEntryId, staffId]
    );

    const convRes = await client.query(
      `SELECT id FROM chat_conversations WHERE context_type = 'service_entry' AND context_id = $1`,
      [serviceEntryId]
    );
    if (convRes.rows.length) {
      const staffName = await client.query(`SELECT name FROM staff WHERE id = $1`, [staffId]);
      await sendSystemMessage(
        convRes.rows[0].id,
        `${staffName.rows[0]?.name || 'A staff member'} removed from the service.`,
        req.io
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'Participant removed' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to remove participant' });
  } finally {
    client.release();
  }
});

// GET /api/servicecollaboration/:serviceEntryId/documents
router.get('/:serviceEntryId/documents', authenticateToken, async (req, res) => {
  const { serviceEntryId } = req.params;
  try {
    const allowed = await canAccessService(serviceEntryId, req.user.id, req.user.role);
    if (!allowed) {
      return res.status(403).json({ error: 'Not authorized to view documents' });
    }

    const docs = await pool.query(
      `SELECT * FROM customer_documents
       WHERE service_entry_id = $1 AND is_latest = true
       ORDER BY created_at DESC`,
      [serviceEntryId]
    );
    res.json(docs.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// POST /api/servicecollaboration/:serviceEntryId/documents
router.post('/:serviceEntryId/documents', authenticateToken, upload.single('file'), async (req, res) => {
  const { serviceEntryId } = req.params;
  const { document_type, document_name, description, expiry_date, document_number } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const allowed = await canAccessService(serviceEntryId, req.user.id, req.user.role);
    if (!allowed) {
      return res.status(403).json({ error: 'Not authorized to upload documents' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Get service details
    const serviceRes = await client.query(
      `SELECT se.id, s.name as service_name, se.customer_name, staff.centre_id
       FROM service_entries se
       JOIN services s ON se.category_id = s.id
       JOIN staff ON se.staff_id = staff.id
       WHERE se.id = $1`,
      [serviceEntryId]
    );
    if (!serviceRes.rows.length) {
      return res.status(404).json({ error: 'Service not found' });
    }
    const service = serviceRes.rows[0];

    // Insert into customer_documents (with service_entry_id, customer_id left NULL)
    const insertRes = await client.query(
      `INSERT INTO customer_documents
       (scope, service_entry_id, customer_id, document_type, document_name,
        file_url, file_size, mime_type, version, is_latest, status,
        uploaded_by, expiry_date, document_number, created_at)
       VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, 1, true, 'pending',
               $8, $9, $10, NOW())
       RETURNING *`,
      [
        'service',
        serviceEntryId,
        document_type || 'other',
        document_name || req.file.originalname,
        req.file.path,
        req.file.size,
        req.file.mimetype,
        req.user.id,
        expiry_date || null,
        document_number || null
      ]
    );
    const newDoc = insertRes.rows[0];

    // Get conversation
    const conversation = await getOrCreateServiceConversation(
      serviceEntryId,
      service.service_name,
      service.customer_name,
      req.user.id
    );

    await sendSystemMessage(
      conversation.id,
      `📎 Document uploaded: ${newDoc.document_name || req.file.originalname} by ${req.user.username || 'Staff'}.`,
      req.io
    );

    await logActivity({
      centre_id: service.centre_id,
      related_type: 'service_entry',
      related_id: serviceEntryId,
      action: 'Document Uploaded',
      description: `Document ${newDoc.document_name} uploaded for service ${service.service_name}`,
      performed_by: req.user.id,
      performed_by_role: req.user.role
    });

    await client.query('COMMIT');
    res.status(201).json(newDoc);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Failed to upload document' });
  } finally {
    client.release();
  }
});

// DELETE /api/servicecollaboration/:serviceEntryId/documents/:docId
router.delete('/:serviceEntryId/documents/:docId', authenticateToken, async (req, res) => {
  const { serviceEntryId, docId } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const allowed = await canAccessService(serviceEntryId, req.user.id, req.user.role);
    if (!allowed) {
      return res.status(403).json({ error: 'Not authorized to delete documents' });
    }

    const docRes = await client.query(
      `SELECT * FROM customer_documents WHERE id = $1 AND service_entry_id = $2`,
      [docId, serviceEntryId]
    );
    if (!docRes.rows.length) {
      return res.status(404).json({ error: 'Document not found' });
    }
    const doc = docRes.rows[0];

    await client.query(
      `UPDATE customer_documents SET is_latest = false WHERE id = $1`,
      [docId]
    );

    if (doc.file_url && fs.existsSync(doc.file_url)) {
      fs.unlinkSync(doc.file_url);
    }

    const serviceInfo = await client.query(
      `SELECT se.id, s.name as service_name, se.customer_name, staff.centre_id
       FROM service_entries se
       JOIN services s ON se.category_id = s.id
       JOIN staff ON se.staff_id = staff.id
       WHERE se.id = $1`,
      [serviceEntryId]
    );
    const conversation = await getOrCreateServiceConversation(
      serviceEntryId,
      serviceInfo.rows[0].service_name,
      serviceInfo.rows[0].customer_name,
      req.user.id
    );
    await sendSystemMessage(
      conversation.id,
      `🗑️ Document deleted: ${doc.document_name || 'File'}.`,
      req.io
    );

    await client.query('COMMIT');
    res.json({ message: 'Document deleted' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to delete document' });
  } finally {
    client.release();
  }
});

// GET /api/servicecollaboration/:serviceEntryId/tasks
router.get('/:serviceEntryId/tasks', authenticateToken, async (req, res) => {
  const { serviceEntryId } = req.params;
  try {
    const allowed = await canAccessService(serviceEntryId, req.user.id, req.user.role);
    if (!allowed) {
      return res.status(403).json({ error: 'Not authorized to view tasks' });
    }

    const tasks = await pool.query(
      `SELECT t.*, s.name as assigned_to_name
       FROM tasks t
       LEFT JOIN staff s ON t.assigned_to = s.id
       WHERE t.related_service_entry_id = $1
       ORDER BY t.created_at DESC`,
      [serviceEntryId]
    );
    res.json(tasks.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// POST /api/servicecollaboration/:serviceEntryId/tasks
router.post('/:serviceEntryId/tasks', authenticateToken, async (req, res) => {
  const { serviceEntryId } = req.params;
  const { title, description, assigned_to, due_date, priority = 'medium' } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const allowed = await canAccessService(serviceEntryId, req.user.id, req.user.role);
    if (!allowed) {
      return res.status(403).json({ error: 'Not authorized to create tasks' });
    }

    // Get service info including centre_id from staff
    const serviceRes = await client.query(
      `SELECT se.id, staff.centre_id, s.name as service_name, se.customer_name
       FROM service_entries se
       JOIN services s ON se.category_id = s.id
       JOIN staff ON se.staff_id = staff.id
       WHERE se.id = $1`,
      [serviceEntryId]
    );
    if (!serviceRes.rows.length) {
      return res.status(404).json({ error: 'Service not found' });
    }
    const service = serviceRes.rows[0];

    const insertRes = await client.query(
      `INSERT INTO tasks
       (related_service_entry_id, title, description, assigned_to, assigned_by, assigned_by_role,
        priority, due_date, centre_id, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', NOW())
       RETURNING *`,
      [
        serviceEntryId,
        title,
        description || null,
        assigned_to,
        req.user.id,
        req.user.role,
        priority,
        due_date || null,
        service.centre_id
      ]
    );
    const newTask = insertRes.rows[0];

    if (due_date) {
      await client.query(
        `INSERT INTO calendar_events (date, title, type, description, centre_id, related_task_id, created_by, created_at)
         VALUES ($1, $2, 'task', $3, $4, $5, $6, NOW())`,
        [due_date, title, description, service.centre_id, newTask.id, req.user.id]
      );
    }

    const conversation = await getOrCreateServiceConversation(
      serviceEntryId,
      service.service_name,
      service.customer_name,
      req.user.id
    );

    const assigneeName = await client.query(`SELECT name FROM staff WHERE id = $1`, [assigned_to]);
    const assigneeText = assigneeName.rows[0]?.name || 'staff';
    await sendSystemMessage(
      conversation.id,
      `📋 Task created: "${title}" assigned to ${assigneeText}. ${due_date ? `Due: ${due_date}` : ''}`,
      req.io,
      newTask.id   // Pass the task ID to store in the message
    );

    await logActivity({
      centre_id: service.centre_id,
      related_type: 'service_entry',
      related_id: serviceEntryId,
      action: 'Task Created',
      description: `Task "${title}" created for service ${service.service_name}`,
      performed_by: req.user.id,
      performed_by_role: req.user.role
    });

    await client.query('COMMIT');
    res.status(201).json(newTask);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to create task' });
  } finally {
    client.release();
  }
});

// PATCH /api/servicecollaboration/:serviceEntryId/tasks/:taskId
router.patch('/:serviceEntryId/tasks/:taskId', authenticateToken, async (req, res) => {
  const { serviceEntryId, taskId } = req.params;
  const { status, title, description, assigned_to, due_date, priority } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const allowed = await canAccessService(serviceEntryId, req.user.id, req.user.role);
    if (!allowed) {
      return res.status(403).json({ error: 'Not authorized to update tasks' });
    }

    const taskRes = await client.query(
      `SELECT * FROM tasks WHERE id = $1 AND related_service_entry_id = $2`,
      [taskId, serviceEntryId]
    );
    if (!taskRes.rows.length) {
      return res.status(404).json({ error: 'Task not found' });
    }
    const task = taskRes.rows[0];

    const updates = [];
    const values = [];
    let idx = 1;
    if (status !== undefined) {
      updates.push(`status = $${idx++}`);
      values.push(status);
    }
    if (title !== undefined) {
      updates.push(`title = $${idx++}`);
      values.push(title);
    }
    if (description !== undefined) {
      updates.push(`description = $${idx++}`);
      values.push(description);
    }
    if (assigned_to !== undefined) {
      updates.push(`assigned_to = $${idx++}`);
      values.push(assigned_to);
    }
    if (due_date !== undefined) {
      updates.push(`due_date = $${idx++}`);
      values.push(due_date);
    }
    if (priority !== undefined) {
      updates.push(`priority = $${idx++}`);
      values.push(priority);
    }
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    updates.push(`updated_at = NOW()`);
    values.push(taskId);

    await client.query(
      `UPDATE tasks SET ${updates.join(', ')} WHERE id = $${idx}`,
      values
    );

    if (due_date !== undefined) {
      await client.query(
        `UPDATE calendar_events SET date = $1 WHERE related_task_id = $2`,
        [due_date, taskId]
      );
    }

    if (status === 'completed' && task.status !== 'completed') {
      const serviceInfo = await client.query(
        `SELECT se.id, s.name as service_name, se.customer_name
         FROM service_entries se
         JOIN services s ON se.category_id = s.id
         WHERE se.id = $1`,
        [serviceEntryId]
      );
      const conversation = await getOrCreateServiceConversation(
        serviceEntryId,
        serviceInfo.rows[0].service_name,
        serviceInfo.rows[0].customer_name,
        req.user.id
      );
      await sendSystemMessage(
        conversation.id,
        `✅ Task completed: "${task.title}".`,
        req.io
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'Task updated' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to update task' });
  } finally {
    client.release();
  }
});

// GET /api/servicecollaboration/:serviceEntryId/conversation
router.get('/:serviceEntryId/conversation', authenticateToken, async (req, res) => {
  const { serviceEntryId } = req.params;
  try {
    const allowed = await canAccessService(serviceEntryId, req.user.id, req.user.role);
    if (!allowed) {
      return res.status(403).json({ error: 'Not authorized to view conversation' });
    }

    const convRes = await pool.query(
      `SELECT * FROM chat_conversations
       WHERE context_type = 'service_entry' AND context_id = $1`,
      [serviceEntryId]
    );
    if (!convRes.rows.length) {
      const serviceInfo = await pool.query(
        `SELECT se.id, s.name as service_name, se.customer_name
         FROM service_entries se
         JOIN services s ON se.category_id = s.id
         WHERE se.id = $1`,
        [serviceEntryId]
      );
      if (serviceInfo.rows.length) {
        const conv = await getOrCreateServiceConversation(
          serviceEntryId,
          serviceInfo.rows[0].service_name,
          serviceInfo.rows[0].customer_name,
          req.user.id
        );
        return res.json(conv);
      }
      return res.status(404).json({ error: 'Service not found' });
    }
    res.json(convRes.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

export default router;