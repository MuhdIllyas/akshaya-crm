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
      `SELECT id, name, phone_number, is_active FROM communication_accounts ORDER BY id ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching accounts:', err);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

// POST create a new communication account
router.post('/accounts', authenticateSuperadmin, async (req, res) => {
  const { name, phone_number, access_token } = req.body;
  
  if (!name || !phone_number || !access_token) {
    return res.status(400).json({ error: 'Name, phone number, and access token are required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO communication_accounts (name, phone_number, access_token, is_active) 
       VALUES ($1, $2, $3, true) RETURNING id, name, phone_number, is_active`,
      [name, phone_number, access_token]
    );
    res.status(201).json({ message: 'Account created', account: result.rows[0] });
  } catch (err) {
    console.error('Error creating account:', err);
    // Handle unique constraint violation for phone_number
    if (err.code === '23505') {
      return res.status(400).json({ error: 'An account with this phone number already exists' });
    }
    res.status(500).json({ error: 'Failed to create account' });
  }
});

export default router;