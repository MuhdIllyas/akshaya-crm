import express from 'express';
import pool from '../db.js';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Middleware to verify superadmin token
const authenticateSuperadmin = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Access token required' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'superadmin') {
      return res.status(403).json({ error: 'Superadmin privileges required' });
    }
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// GET all communication accounts
router.get('/accounts', authenticateSuperadmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, phone_number, is_active, channel_id FROM communication_accounts ORDER BY id ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching accounts:', err);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

// POST create a new communication account
router.post('/accounts', authenticateSuperadmin, async (req, res) => {
  const { name, phone_number, access_token, channel_id } = req.body;

  if (!name || !phone_number || !access_token || !channel_id) {
    return res.status(400).json({ error: 'Name, phone number, access token, and channel ID are required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO communication_accounts (name, phone_number, access_token, is_active, channel_id) 
       VALUES ($1, $2, $3, true, $4) RETURNING id, name, phone_number, is_active, channel_id`,
      [name, phone_number, access_token, channel_id]
    );
    res.status(201).json({ message: 'Account created', account: result.rows[0] });
  } catch (err) {
    console.error('Error creating account:', err);
    if (err.code === '23505') {
      return res.status(400).json({ error: 'An account with this phone number already exists' });
    }
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// PUT update an existing communication account
router.put('/accounts/:id', authenticateSuperadmin, async (req, res) => {
  const { id } = req.params;
  const { name, phone_number, access_token, channel_id } = req.body;

  if (!name || !phone_number || !channel_id) {
    return res.status(400).json({ error: 'Name, phone number, and channel ID are required' });
  }

  try {
    let query;
    let values;

    // If a new token is provided, update all fields
    if (access_token && access_token.trim() !== "") {
      query = `
        UPDATE communication_accounts 
        SET name = $1, phone_number = $2, access_token = $3, channel_id = $4
        WHERE id = $5 
        RETURNING id, name, phone_number, is_active, channel_id
      `;
      values = [name, phone_number, access_token, channel_id, id];
    } else {
      // If no token is provided, update only name and phone, leaving the token untouched
      query = `
        UPDATE communication_accounts 
        SET name = $1, phone_number = $2, channel_id = $3
        WHERE id = $4 
        RETURNING id, name, phone_number, is_active, channel_id
      `;
      values = [name, phone_number, channel_id, id];
    }

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    res.json({ message: 'Account updated successfully', account: result.rows[0] });
  } catch (err) {
    console.error('Error updating account:', err);
    if (err.code === '23505') {
      return res.status(400).json({ error: 'An account with this phone number already exists' });
    }
    res.status(500).json({ error: 'Failed to update account' });
  }
});

// PATCH toggle account active status
router.patch('/accounts/:id/status', authenticateSuperadmin, async (req, res) => {
  const { id } = req.params;
  const { is_active } = req.body;

  if (typeof is_active !== 'boolean') {
    return res.status(400).json({ error: 'is_active boolean status is required' });
  }

  try {
    const result = await pool.query(
      `UPDATE communication_accounts 
       SET is_active = $1 
       WHERE id = $2 
       RETURNING id, name, phone_number, is_active`,
      [is_active, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    res.json({ message: 'Account status updated', account: result.rows[0] });
  } catch (err) {
    console.error('Error updating account status:', err);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// GET mappings for a specific account
router.get('/accounts/:id/mappings', authenticateSuperadmin, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT event_key, provider_template_name 
       FROM communication_template_mappings 
       WHERE communication_account_id = $1`,
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching template mappings:', err);
    res.status(500).json({ error: 'Failed to fetch mappings' });
  }
});

// PUT (Upsert) mappings for a specific account
router.put('/accounts/:id/mappings', authenticateSuperadmin, async (req, res) => {
  const { id } = req.params;
  const { mappings } = req.body; // Expected format: { pending_payment: "template_1", review_request: "template_2" }

  if (!mappings || typeof mappings !== 'object') {
    return res.status(400).json({ error: 'Invalid mappings data' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Loop through the submitted mappings
    for (const [eventKey, templateName] of Object.entries(mappings)) {
      if (templateName && templateName.trim() !== '') {
        // If a template name is provided, Insert or Update it
        await client.query(`
          INSERT INTO communication_template_mappings (communication_account_id, event_key, provider_template_name)
          VALUES ($1, $2, $3)
          ON CONFLICT (communication_account_id, event_key) 
          DO UPDATE SET provider_template_name = EXCLUDED.provider_template_name
        `, [id, eventKey, templateName.trim()]);
      } else {
        // If the field was cleared out, delete the mapping from the database
        await client.query(`
          DELETE FROM communication_template_mappings 
          WHERE communication_account_id = $1 AND event_key = $2
        `, [id, eventKey]);
      }
    }

    await client.query('COMMIT');
    res.json({ message: 'Mappings updated successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating template mappings:', err);
    res.status(500).json({ error: 'Failed to update mappings' });
  } finally {
    client.release();
  }
});

export default router;