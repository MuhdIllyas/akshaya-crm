import express from 'express';
import pool from '../db.js';
import jwt from 'jsonwebtoken';
import { io } from '../server.js';
import { logActivity } from "../utils/activityLogger.js";
import crypto from 'crypto';

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

// Get centres
router.get('/centres', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM centres ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching centres:', err);
    res.status(500).json({ error: 'Failed to fetch centres' });
  }
});

// GET /api/servicemanagement/services
router.get('/services', authenticateToken, async (req, res) => {
  const { search } = req.query;
  const client = await pool.connect();
  try {
    let query = `
      SELECT s.*, (
        SELECT COALESCE(json_agg(sc), '[]'::json)
        FROM (
          SELECT sc.*, (
            SELECT COALESCE(json_agg(rd), '[]'::json)
            FROM required_documents rd
            WHERE rd.sub_category_id = sc.id
          ) AS required_documents
          FROM subcategories sc
          WHERE sc.service_id = s.id
        ) sc
      ) AS subcategories,
      (
        SELECT COALESCE(json_agg(rd), '[]'::json)
        FROM required_documents rd
        WHERE rd.service_id = s.id AND rd.sub_category_id IS NULL
      ) AS required_documents
      FROM services s
    `;
    let values = [];
    if (search && (typeof search !== 'string' || search.length > 100)) {
      return res.status(400).json({ error: 'Search query must be a string and less than 100 characters' });
    }
    if (search) {
      query += ` WHERE s.name ILIKE $1 OR s.description ILIKE $1
                OR EXISTS (
                  SELECT 1 FROM subcategories sc
                  WHERE sc.service_id = s.id AND sc.name ILIKE $1
                )`;
      values = [`%${search}%`];
    }
    const result = await client.query(query, values);
    const services = result.rows.map(service => ({
      ...service,
      wallet_name: null,
      balance: null,
      wallet_type: null,
      is_shared: null,
      wallet_status: null,
      assigned_staff_id: null
    }));

    for (let service of services) {
      if (service.wallet_id) {
        const walletQuery = `SELECT * FROM wallets WHERE id = $1`;
        const walletResult = await client.query(walletQuery, [service.wallet_id]);
        if (walletResult.rows.length > 0) {
          const wallet = walletResult.rows[0];
          service.wallet_name = wallet.name;
          service.balance = wallet.balance;
          service.wallet_type = wallet.wallet_type;
          service.is_shared = wallet.is_shared;
          service.wallet_status = wallet.status;
          service.assigned_staff_id = wallet.assigned_staff_id;
        }
      }
    }

    res.json(services);
  } catch (err) {
    console.error('Error fetching services:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// POST /api/servicemanagement/services
router.post('/services', authenticateToken, async (req, res) => {
  const {
    name,
    description,
    wallet_id,
    website,
    status,
    department_charges,
    service_charges,
    requires_wallet,
    requires_workflow,
    requiredDocuments,
    has_expiry
  } = req.body;

  const client = await pool.connect();
  try {
    if (!name || !description || !website || !status || department_charges == null || service_charges == null) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    await client.query('BEGIN');

    let finalWalletId = null;
    if (req.user.role === 'superadmin') {
      if (wallet_id) {
        throw new Error('Superadmins cannot set wallet_id for services');
      }
    } else if (requires_wallet && wallet_id) {
      const walletQuery = `SELECT id, centre_id FROM wallets WHERE id = $1`;
      const walletResult = await client.query(walletQuery, [wallet_id]);
      if (walletResult.rows.length === 0) {
        throw new Error('Invalid wallet selected');
      }
      if (walletResult.rows[0].centre_id !== req.user.centre_id) {
        throw new Error('Wallet does not belong to your centre');
      }
      finalWalletId = wallet_id;
    } else if (requires_wallet && !wallet_id) {
      throw new Error('Wallet ID is required when requires_wallet is true for admins');
    } else if (!requires_wallet && wallet_id) {
      throw new Error('Wallet ID should not be provided when requires_wallet is false');
    }

    const serviceQuery = `
      INSERT INTO services (name, description, wallet_id, website, status, department_charges, service_charges, requires_wallet, requires_workflow, has_expiry, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10 , NOW(), NOW())
      RETURNING *
    `;
    const serviceValues = [
      name,
      description,
      finalWalletId,
      website,
      status,
      department_charges,
      service_charges,
      requires_wallet || false,
      requires_workflow !== false,
      has_expiry || false
    ];
    const serviceResult = await client.query(serviceQuery, serviceValues);
    const newService = serviceResult.rows[0];

    let documents = [];
    if (requiredDocuments && Array.isArray(requiredDocuments) && requiredDocuments.length > 0) {
      const docQuery = `
        INSERT INTO required_documents (service_id, document_name)
        VALUES ($1, $2)
        RETURNING *
      `;
      for (const doc of requiredDocuments) {
        const docResult = await client.query(docQuery, [newService.id, doc]);
        documents.push(docResult.rows[0]);
      }
    }

    const auditDetails = `Created service ${name} by ${req.user.role}`;
    await client.query(
      `INSERT INTO audit_logs (action, performed_by, details, centre_id, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      ['Service Created', req.user.username, auditDetails, req.user.centre_id]
    );

    await client.query('COMMIT');

    let wallet = null;
    if (newService.wallet_id) {
      const walletQuery = `SELECT * FROM wallets WHERE id = $1`;
      const walletResult = await client.query(walletQuery, [newService.wallet_id]);
      wallet = walletResult.rows[0];
    }

    const subcategoriesQuery = `
      SELECT *, (
        SELECT COALESCE(json_agg(rd), '[]'::json)
        FROM required_documents rd
        WHERE rd.sub_category_id = subcategories.id
      ) AS required_documents
      FROM subcategories WHERE service_id = $1
    `;
    const subcategoriesResult = await client.query(subcategoriesQuery, [newService.id]);

    res.status(201).json({
      ...newService,
      wallet_name: wallet?.name,
      balance: wallet?.balance,
      wallet_type: wallet?.wallet_type,
      is_shared: wallet?.is_shared,
      wallet_status: wallet?.status,
      assigned_staff_id: wallet?.assigned_staff_id,
      subcategories: subcategoriesResult.rows,
      required_documents: documents
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating service:', err);
    res.status(400).json({ error: err.message || 'Internal server error' });
  } finally {
    client.release();
  }
});

// PUT /api/servicemanagement/services/:id
router.put('/services/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const {
    name,
    description,
    wallet_id,
    website,
    status,
    department_charges,
    service_charges,
    requires_wallet,
    requires_workflow,
    requiredDocuments,
    has_expiry
  } = req.body;

  const client = await pool.connect();
  try {
    if (!name || !description || !website || !status || department_charges == null || service_charges == null) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    await client.query('BEGIN');

    const serviceCheck = await client.query('SELECT * FROM services WHERE id = $1', [id]);
    if (serviceCheck.rows.length === 0) {
      throw new Error('Service not found');
    }

    let finalWalletId = null;
    if (req.user.role === 'superadmin') {
      if (wallet_id) {
        throw new Error('Superadmins cannot set wallet_id for services');
      }
    } else if (requires_wallet && wallet_id) {
      const walletQuery = `SELECT id, centre_id FROM wallets WHERE id = $1`;
      const walletResult = await client.query(walletQuery, [wallet_id]);
      if (walletResult.rows.length === 0) {
        throw new Error('Invalid wallet selected');
      }
      if (walletResult.rows[0].centre_id !== req.user.centre_id) {
        throw new Error('Wallet does not belong to your centre');
      }
      finalWalletId = wallet_id;
    } else if (requires_wallet && !wallet_id) {
      throw new Error('Wallet ID is required when requires_wallet is true for admins');
    } else if (!requires_wallet && wallet_id) {
      throw new Error('Wallet ID should not be provided when requires_wallet is false');
    }

    const serviceQuery = `
      UPDATE services
      SET name = $1, description = $2, wallet_id = $3, website = $4, status = $5,
          department_charges = $6, service_charges = $7, requires_wallet = $8, requires_workflow = $9, has_expiry = $10,
          updated_at = NOW()
      WHERE id = $11
      RETURNING *
    `;
    const serviceValues = [
      name,
      description,
      finalWalletId,
      website,
      status,
      department_charges,
      service_charges,
      requires_wallet || false,
      requires_workflow !== false,
      has_expiry || false,
      id
    ];
    const serviceResult = await client.query(serviceQuery, serviceValues);
    if (serviceResult.rows.length === 0) {
      throw new Error('Service not found');
    }
    const updatedService = serviceResult.rows[0];

    await client.query('DELETE FROM required_documents WHERE service_id = $1 AND sub_category_id IS NULL', [id]);

    let documents = [];
    if (requiredDocuments && Array.isArray(requiredDocuments) && requiredDocuments.length > 0) {
      const docQuery = `
        INSERT INTO required_documents (service_id, document_name)
        VALUES ($1, $2)
        RETURNING *
      `;
      for (const doc of requiredDocuments) {
        const docResult = await client.query(docQuery, [id, doc]);
        documents.push(docResult.rows[0]);
      }
    }

    const auditDetails = `Updated service ${name} by ${req.user.role}`;
    await client.query(
      `INSERT INTO audit_logs (action, performed_by, details, centre_id, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      ['Service Updated', req.user.username, auditDetails, req.user.centre_id]
    );

    await client.query('COMMIT');

    let wallet = null;
    if (updatedService.wallet_id) {
      const walletQuery = `SELECT * FROM wallets WHERE id = $1`;
      const walletResult = await client.query(walletQuery, [updatedService.wallet_id]);
      wallet = walletResult.rows[0];
    }

    const subcategoriesQuery = `
      SELECT *, (
        SELECT COALESCE(json_agg(rd), '[]'::json)
        FROM required_documents rd
        WHERE rd.sub_category_id = subcategories.id
      ) AS required_documents
      FROM subcategories WHERE service_id = $1
    `;
    const subcategoriesResult = await client.query(subcategoriesQuery, [id]);

    res.json({
      ...updatedService,
      wallet_name: wallet?.name,
      balance: wallet?.balance,
      wallet_type: wallet?.wallet_type,
      is_shared: wallet?.is_shared,
      wallet_status: wallet?.status,
      assigned_staff_id: wallet?.assigned_staff_id,
      subcategories: subcategoriesResult.rows,
      required_documents: documents
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating service:', err);
    res.status(err.message === 'Service not found' ? 404 : 400).json({ error: err.message || 'Internal server error' });
  } finally {
    client.release();
  }
});

// DELETE /api/servicemanagement/services/:id
router.delete('/services/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const serviceCheck = await client.query('SELECT * FROM services WHERE id = $1', [id]);
    if (serviceCheck.rows.length === 0) {
      throw new Error('Service not found');
    }

    await client.query('DELETE FROM required_documents WHERE service_id = $1', [id]);
    await client.query('DELETE FROM subcategories WHERE service_id = $1', [id]);
    await client.query('DELETE FROM services WHERE id = $1', [id]);

    const auditDetails = `Deleted service ID ${id} by ${req.user.role}`;
    await client.query(
      `INSERT INTO audit_logs (action, performed_by, details, centre_id, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      ['Service Deleted', req.user.username, auditDetails, req.user.centre_id]
    );

    await client.query('COMMIT');
    res.json({ message: 'Service deleted successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error deleting service:', err);
    res.status(err.message === 'Service not found' ? 404 : 400).json({ error: err.message || 'Internal server error' });
  } finally {
    client.release();
  }
});

// POST /api/servicemanagement/services/:id/subcategories
router.post('/services/:id/subcategories', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { name, department_charges, service_charges, requires_wallet, requiredDocuments } = req.body;
  const client = await pool.connect();
  try {
    if (!name || department_charges == null || service_charges == null) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    await client.query('BEGIN');

    const serviceCheck = await client.query('SELECT requires_wallet FROM services WHERE id = $1', [id]);
    if (serviceCheck.rows.length === 0) {
      throw new Error('Service not found');
    }
    const serviceRequiresWallet = serviceCheck.rows[0].requires_wallet;

    if (requires_wallet !== serviceRequiresWallet) {
      throw new Error('Subcategory requires_wallet must match the parent service');
    }

    const subcategoryQuery = `
      INSERT INTO subcategories (service_id, name, department_charges, service_charges, requires_wallet, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING *
    `;
    const subcategoryValues = [id, name, department_charges, service_charges, requires_wallet || false];
    const subcategoryResult = await client.query(subcategoryQuery, subcategoryValues);
    const newSubcategory = subcategoryResult.rows[0];

    let documents = [];
    if (requiredDocuments && Array.isArray(requiredDocuments) && requiredDocuments.length > 0) {
      const docQuery = `
        INSERT INTO required_documents (service_id, sub_category_id, document_name)
        VALUES ($1, $2, $3)
        RETURNING *
      `;
      for (const doc of requiredDocuments) {
        const docResult = await client.query(docQuery, [id, newSubcategory.id, doc]);
        documents.push(docResult.rows[0]);
      }
    }

    const auditDetails = `Added subcategory ${name} to service ID ${id} by ${req.user.role}`;
    await client.query(
      `INSERT INTO audit_logs (action, performed_by, details, centre_id, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      ['Subcategory Created', req.user.username, auditDetails, req.user.centre_id]
    );

    await client.query('COMMIT');

    res.status(201).json({ ...newSubcategory, required_documents: documents });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error adding subcategory:', err);
    res.status(err.message === 'Service not found' ? 404 : 400).json({ error: err.message || 'Internal server error' });
  } finally {
    client.release();
  }
});

// DELETE /api/servicemanagement/services/:id/subcategories/:subId
router.delete('/services/:id/subcategories/:subId', authenticateToken, async (req, res) => {
  const { id, subId } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const subcategoryCheck = await client.query('SELECT * FROM subcategories WHERE id = $1 AND service_id = $2', [subId, id]);
    if (subcategoryCheck.rows.length === 0) {
      throw new Error('Subcategory not found');
    }

    await client.query('DELETE FROM required_documents WHERE sub_category_id = $1', [subId]);
    await client.query('DELETE FROM subcategories WHERE id = $1 AND service_id = $2', [subId, id]);

    const auditDetails = `Deleted subcategory ID ${subId} from service ID ${id} by ${req.user.role}`;
    await client.query(
      `INSERT INTO audit_logs (action, performed_by, details, centre_id, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      ['Subcategory Deleted', req.user.username, auditDetails, req.user.centre_id]
    );

    await client.query('COMMIT');
    res.json({ message: 'Subcategory deleted successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error deleting subcategory:', err);
    res.status(err.message === 'Subcategory not found' ? 404 : 400).json({ error: err.message || 'Internal server error' });
  } finally {
    client.release();
  }
});

// GET /api/servicemanagement/wallets
router.get('/wallets', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    let query = 'SELECT * FROM wallets';
    let values = [];
    if (req.user.role !== 'superadmin') {
      query += ' WHERE centre_id = $1';
      values = [req.user.centre_id];
    }
    const result = await client.query(query, values);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching wallets:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// GET /api/servicemanagement/categories
router.get('/categories', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const query = `
      SELECT 
        s.id, s.name, s.description, s.wallet_id, s.website, s.status,
        COALESCE(s.department_charges, 0) AS department_charges,
        COALESCE(s.service_charges, 0) AS service_charges,
        COALESCE(s.requires_wallet, false) AS requires_wallet,
        COALESCE(s.requires_workflow, false) AS requires_workflow,
        COALESCE(s.has_expiry, false) AS has_expiry,
        (SELECT COALESCE(json_agg(rd), '[]'::json)
         FROM required_documents rd
         WHERE rd.service_id = s.id AND rd.sub_category_id IS NULL) AS required_documents,
        (SELECT COALESCE(json_agg(sc), '[]'::json)
         FROM (SELECT sc.id, sc.name, sc.service_id,
                      COALESCE(sc.department_charges, 0) AS department_charges,
                      COALESCE(sc.service_charges, 0) AS service_charges,
                      COALESCE(sc.requires_wallet, false) AS requires_wallet,
                      (SELECT COALESCE(json_agg(rd2), '[]'::json)
                       FROM required_documents rd2
                       WHERE rd2.sub_category_id = sc.id) AS required_documents
               FROM subcategories sc
               WHERE sc.service_id = s.id) sc) AS subcategories
      FROM services s
      WHERE s.status = 'active'
      ORDER BY s.name ASC
    `;

    const result = await client.query(query);
    const categories = result.rows.map(category => ({
      id: category.id,
      name: category.name,
      description: category.description,
      wallet_id: category.wallet_id,
      website: category.website,
      status: category.status,
      department_charges: parseFloat(category.department_charges),
      service_charges: parseFloat(category.service_charges),
      requires_wallet: category.requires_wallet,
      requires_workflow: category.requires_workflow,
      has_expiry: category.has_expiry,
      required_documents: category.required_documents || [],
      subcategories: (category.subcategories || []).map(sub => ({
        id: sub.id,
        name: sub.name,
        service_id: sub.service_id,
        department_charges: parseFloat(sub.department_charges),
        service_charges: parseFloat(sub.service_charges),
        requires_wallet: sub.requires_wallet,
        required_documents: sub.required_documents || []
      }))
    }));

    res.json(categories);
  } catch (err) {
    console.error('servicemanagement.js: Error fetching categories:', err);
    res.status(500).json({ error: 'Failed to fetch categories: ' + err.message });
  } finally {
    client.release();
  }
});

// 🔥 GET /api/servicemanagement/entries - FINAL CLEAN VERSION
router.get('/entries', authenticateToken, async (req, res) => {
  const { today } = req.query;
  const client = await pool.connect();

  try {
    let query = `
      SELECT se.*, se.is_edited, se.customer_service_id, se.work_source,
             sc.name AS subcategory_name,
             s.wallet_id AS service_wallet_id,
             s.name AS service_name
      FROM service_entries se
      JOIN subcategories sc ON se.subcategory_id::integer = sc.id
      JOIN services s ON se.category_id::integer = s.id
      JOIN staff st ON se.staff_id = st.id
    `;

    let values = [];
    let conditions = [];

    if (today === 'true') {
      conditions.push(`se.created_at::date = CURRENT_DATE`);
    }

    if (req.user.role === 'staff') {
      conditions.push(`se.staff_id = $${values.length + 1}`);
      values.push(parseInt(req.user.id));
    } else if (req.user.role === 'admin') {
      conditions.push(`st.centre_id = $${values.length + 1}`);
      values.push(parseInt(req.user.centre_id));
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY se.created_at DESC`;

    const entriesResult = await client.query(query, values);
    const entries = [];

    for (const entry of entriesResult.rows) {

      // 🔥 ✅ ONLY LATEST PAYMENT (NO CHAINS, NO DUPLICATES)
      const paymentsResult = await client.query(`
        SELECT DISTINCT ON (p.service_entry_id)
          p.id,
          p.wallet_id,
          p.amount,
          p.status,
          p.correction_group_id,
          p.created_at,
          w.name AS wallet_name,
          w.wallet_type,

          (
            SELECT wt.id
            FROM wallet_transactions wt
            WHERE wt.reference_payment_id = p.id
              AND wt.category = 'Service Payment'
              AND wt.type = 'credit'
              AND (wt.is_reversal IS NULL OR wt.is_reversal = FALSE)
            ORDER BY wt.created_at DESC
            LIMIT 1
          ) AS transaction_id

        FROM payments p
        JOIN wallets w ON p.wallet_id = w.id

        WHERE p.service_entry_id = $1
          AND p.is_reversal = FALSE

        ORDER BY p.service_entry_id, p.created_at DESC
      `, [entry.id]);

      // 🔥 Department Charge (latest only)
      const deptTxResult = await client.query(`
        SELECT DISTINCT ON (wt.correction_group_id)
          wt.id, wt.amount, wt.wallet_id,
          w.name AS wallet_name,
          wt.correction_group_id
        FROM wallet_transactions wt
        JOIN wallets w ON wt.wallet_id = w.id
        WHERE wt.reference_id = $1
          AND wt.category = 'Department Payment'
          AND (wt.is_reversal IS NULL OR wt.is_reversal = FALSE)
        ORDER BY wt.correction_group_id, wt.created_at DESC
      `, [entry.id]);

      // 🔥 Service Charge (latest only)
      const serviceChargeTxResult = await client.query(`
        SELECT DISTINCT ON (wt.correction_group_id)
          wt.id, wt.amount, wt.wallet_id,
          w.name AS wallet_name,
          wt.correction_group_id
        FROM wallet_transactions wt
        JOIN wallets w ON wt.wallet_id = w.id
        WHERE wt.reference_id = $1
          AND wt.category = 'Service Charge'
          AND (wt.is_reversal IS NULL OR wt.is_reversal = FALSE)
        ORDER BY wt.correction_group_id, wt.created_at DESC
      `, [entry.id]);

      const latestPayments = paymentsResult.rows;

      const paidAmount = latestPayments
        .filter(p => p.status === 'received')
        .reduce((sum, p) => sum + parseFloat(p.amount), 0);

      const pendingAmount = latestPayments
        .filter(p => p.status === 'pending')
        .reduce((sum, p) => sum + parseFloat(p.amount), 0);

      entries.push({
        id: entry.id,
        tokenId: entry.token_id,
        customerName: entry.customer_name,
        phone: entry.phone,
        category: entry.category_id,
        subcategory: entry.subcategory_id,
        subcategoryName: entry.subcategory_name,

        is_edited: Boolean(entry.is_edited),

        serviceCharge: parseFloat(entry.service_charges),
        departmentCharge: parseFloat(entry.department_charges),
        totalCharge: parseFloat(entry.total_charges),

        serviceWalletId: entry.service_wallet_id,
        staffId: parseInt(entry.staff_id),

        created_at: entry.created_at
          ? entry.created_at.toISOString()
          : null,

        paidAmount,
        pendingAmount,
        balanceAmount: parseFloat(entry.total_charges) - paidAmount,

        expiryDate: entry.expiry_date
          ? entry.expiry_date.toISOString().split('T')[0]
          : null,

        status: entry.status,

        // 🔥 ONLY ONE PAYMENT NOW
        payments: latestPayments.map(p => ({
          id: p.id,
          transaction_id: p.transaction_id,
          wallet: p.wallet_id,
          method: p.wallet_type === 'cash' ? 'cash' : 'wallet',
          amount: parseFloat(p.amount),
          status: p.status,
          correction_group_id: p.correction_group_id,
        })),

        departmentChargeTransaction: deptTxResult.rows[0] ? {
          id: deptTxResult.rows[0].id,
          amount: parseFloat(deptTxResult.rows[0].amount),
          wallet_id: deptTxResult.rows[0].wallet_id,
          wallet_name: deptTxResult.rows[0].wallet_name,
          correction_group_id: deptTxResult.rows[0].correction_group_id,
        } : null,

        serviceChargeTransaction: serviceChargeTxResult.rows[0] ? {
          id: serviceChargeTxResult.rows[0].id,
          amount: parseFloat(serviceChargeTxResult.rows[0].amount),
          wallet_id: serviceChargeTxResult.rows[0].wallet_id,
          wallet_name: serviceChargeTxResult.rows[0].wallet_name,
          correction_group_id: serviceChargeTxResult.rows[0].correction_group_id,
        } : null,

        workSource: entry.work_source,
        customerServiceId: entry.customer_service_id,
      });
    }

    res.json(entries);

  } catch (err) {
    console.error('❌ servicemanagement.js: Error fetching service entries:', err);
    res.status(500).json({
      error: 'Failed to fetch service entries: ' + err.message
    });
  } finally {
    client.release();
  }
});

// GET /api/servicemanagement/entry/:tokenId
router.get('/entry/:tokenId', authenticateToken, async (req, res) => {
  const { tokenId } = req.params;
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT se.*, sc.name AS subcategory_name, s.wallet_id AS service_wallet_id, s.name AS service_name
      FROM service_entries se
      JOIN subcategories sc ON se.subcategory_id::integer = sc.id
      JOIN services s ON se.category_id::integer = s.id
      WHERE se.token_id = $1
    `, [tokenId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Service entry not found' });
    }

    const entry = result.rows[0];
    
    const paymentsResult = await client.query(`
      SELECT DISTINCT ON (p.correction_group_id)
        p.id, p.wallet_id, p.amount, p.status, w.name AS wallet_name, w.wallet_type
      FROM payments p
      JOIN wallets w ON p.wallet_id = w.id
      WHERE p.service_entry_id = $1 AND p.is_reversal = FALSE
      ORDER BY p.correction_group_id, p.created_at DESC
    `, [entry.id]);

    const formattedEntry = {
      id: entry.id,
      tokenId: entry.token_id,
      customerName: entry.customer_name,
      phone: entry.phone,
      category: entry.category_id,
      subcategory: entry.subcategory_id,
      subcategoryName: entry.subcategory_name,
      serviceCharge: parseFloat(entry.service_charges),
      departmentCharge: parseFloat(entry.department_charges),
      totalCharge: parseFloat(entry.total_charges),
      serviceWalletId: entry.service_wallet_id,
      staffId: parseInt(entry.staff_id),
      created_at: entry.created_at ? entry.created_at.toISOString() : null,
      paidAmount: paymentsResult.rows.filter(p => p.status === 'received').reduce((sum, p) => sum + parseFloat(p.amount), 0),
      pendingAmount: paymentsResult.rows.filter(p => p.status === 'pending').reduce((sum, p) => sum + parseFloat(p.amount), 0),
      balanceAmount: parseFloat(entry.total_charges) - paymentsResult.rows.filter(p => p.status === 'received').reduce((sum, p) => sum + parseFloat(p.amount), 0),
      expiryDate: entry.expiry_date ? entry.expiry_date.toISOString().split('T')[0] : null,
      status: entry.status,
      payments: paymentsResult.rows.map(p => ({
        id: p.id,
        wallet: p.wallet_id,
        method: p.wallet_type === 'cash' ? 'cash' : 'wallet',
        amount: parseFloat(p.amount),
        status: p.status,
      })),
    };

    res.json(formattedEntry);
  } catch (err) {
    console.error('servicemanagement.js: Error fetching service entry:', err);
    res.status(500).json({ error: 'Failed to fetch service entry: ' + err.message });
  } finally {
    client.release();
  }
});

// POST /api/servicemanagement/entry
router.post('/entry', authenticateToken, async (req, res) => {
  const {
    tokenId,
    customerName,
    phone,
    categoryId,
    subcategoryId,
    serviceCharge,
    departmentCharge,
    totalCharge,
    status,
    expiryDate,
    serviceWalletId,
    payments,
    staffId,
    customerServiceId
  } = req.body;

  const isQuickEntry = customerName == null && phone == null && tokenId == null;
  const isOnlineBooking = !!customerServiceId;
  const workSource = isOnlineBooking ? 'online' : 'offline';

  const client = await pool.connect();

  try {
    const errors = [];

    if (!isQuickEntry) {
      if (!customerName || customerName.trim() === '') errors.push('customerName is required');
      if (!phone || phone.trim() === '') errors.push('phone is required');
      if (!categoryId || isNaN(parseInt(categoryId))) errors.push('categoryId is required');
      if (!subcategoryId || isNaN(parseInt(subcategoryId))) errors.push('subcategoryId is required');
    }

    if (serviceCharge == null || isNaN(serviceCharge) || serviceCharge < 0) errors.push('serviceCharge must be non-negative');
    if (departmentCharge == null || isNaN(departmentCharge) || departmentCharge < 0) errors.push('departmentCharge must be non-negative');

    const calculatedTotal = Number(serviceCharge || 0) + Number(departmentCharge || 0);
    if (Number(totalCharge) !== calculatedTotal) errors.push('totalCharge must match serviceCharge + departmentCharge');

    if (!Array.isArray(payments) || payments.length === 0) errors.push('payments must be a non-empty array');

    for (const [index, payment] of payments.entries()) {
      if (!payment.wallet || isNaN(parseInt(payment.wallet))) errors.push(`Payment ${index + 1}: wallet is required`);
      if (!payment.amount || isNaN(payment.amount) || payment.amount <= 0) errors.push(`Payment ${index + 1}: amount must be > 0`);
      if (!payment.status || !['received', 'pending', 'not_received'].includes(payment.status)) errors.push(`Payment ${index + 1}: invalid status`);
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }

    await client.query('BEGIN');

    let customerAadhaar = null, customerEmail = null, customerPhone = null;
    let finalCustomerName = customerName, finalCategoryId = categoryId, finalSubcategoryId = subcategoryId;
    let finalServiceCharge = serviceCharge, finalDepartmentCharge = departmentCharge, finalTotalCharge = totalCharge;

    if (isOnlineBooking) {
      const customerServiceResult = await client.query(
        `SELECT cs.*, c.name AS customer_name, c.primary_phone, c.email 
         FROM customer_services cs JOIN customers c ON cs.customer_id = c.id WHERE cs.id = $1`,
        [customerServiceId]
      );
      if (customerServiceResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Customer service not found' });
      }
      const customerData = customerServiceResult.rows[0];
      finalCustomerName = finalCustomerName || customerData.customer_name;
      customerPhone = customerData.primary_phone;
      customerAadhaar = customerData.aadhaar_number;
      customerEmail = customerData.email;
      if (!finalCategoryId) {
        const serviceData = customerData.service_data;
        finalCategoryId = serviceData.category_id || serviceData.service_id;
        finalSubcategoryId = serviceData.subcategory_id;
        if (serviceData.service_charges) finalServiceCharge = serviceData.service_charges;
        if (serviceData.department_charges) finalDepartmentCharge = serviceData.department_charges;
        if (serviceData.total_charges) finalTotalCharge = serviceData.total_charges;
      }
    }

    let centreId = req.user.centre_id;
    let tokenCentreId = null;

    if (tokenId) {
      const tokenResult = await client.query(
        'SELECT centre_id, status FROM tokens WHERE token_id = $1',
        [tokenId]
      );
      if (tokenResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: `Token ${tokenId} not found` });
      }
      centreId = tokenResult.rows[0].centre_id;
      tokenCentreId = centreId;
      if (tokenResult.rows[0].status !== 'pending') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Token ${tokenId} is already processed or completed` });
      }
    }

    let serviceName = 'Quick Service', subcategoryName = null, resolvedServiceWalletId = null;

    if (!isQuickEntry) {
      const categoryResult = await client.query(
        'SELECT id, wallet_id, name, has_expiry FROM services WHERE id = $1',
        [parseInt(finalCategoryId)]
      );
      if (!categoryResult.rows.length) throw new Error(`Category ID ${finalCategoryId} not found`);
      const service = categoryResult.rows[0];
      serviceName = service.name;
      resolvedServiceWalletId = service.wallet_id;
      if (service.has_expiry && (!expiryDate || isNaN(Date.parse(expiryDate)))) {
        throw new Error('expiryDate required for this service');
      }
      const subcategoryResult = await client.query(
        'SELECT name FROM subcategories WHERE id = $1 AND service_id = $2',
        [parseInt(finalSubcategoryId), parseInt(finalCategoryId)]
      );
      if (!subcategoryResult.rows.length) throw new Error(`Subcategory ID ${finalSubcategoryId} not found`);
      subcategoryName = subcategoryResult.rows[0].name;
    }

    const result = await client.query(
      `INSERT INTO service_entries (token_id, customer_name, phone, category_id, subcategory_id, service_charges, department_charges, total_charges, status, expiry_date, staff_id, customer_service_id, work_source, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW()) RETURNING id`,
      [tokenId || null, finalCustomerName ? finalCustomerName.trim() : null,
       (customerPhone || phone) ? (customerPhone || phone).trim() : null,
       finalCategoryId ? parseInt(finalCategoryId) : null,
       finalSubcategoryId ? parseInt(finalSubcategoryId) : null,
       finalServiceCharge, finalDepartmentCharge, finalTotalCharge,
       status || 'completed', expiryDate || null, staffId, customerServiceId || null, workSource]
    );

    const serviceEntryId = result.rows[0].id;
    const paymentStatus = (status === 'completed') ? 'Payment Completed' : 'Payment Pending';

    if (isOnlineBooking) {
      await client.query(
        `UPDATE customer_services SET payment_status = $1, status = $2, last_updated = NOW() WHERE id = $3`,
        [paymentStatus, 'in_progress', customerServiceId]
      );
    }

    if (!isQuickEntry) {
      await client.query(
        `INSERT INTO service_tracking (service_entry_id, assigned_to, status, current_step, progress, aadhaar, email, updated_at)
         VALUES ($1, $2, 'pending', 'Application Received', 0, $3, $4, NOW())`,
        [serviceEntryId, req.user.id, customerAadhaar || null, customerEmail || null]
      );
    }

    const debitWalletId = serviceWalletId || resolvedServiceWalletId;

    if (debitWalletId && Number(finalDepartmentCharge) > 0) {
      const deptGroupId = crypto.randomUUID();
      await client.query('UPDATE wallets SET balance = balance - $1 WHERE id = $2 RETURNING balance', [Number(finalDepartmentCharge), Number(debitWalletId)]);
      await client.query(
        `INSERT INTO wallet_transactions (wallet_id, staff_id, type, amount, description, category, reference_id, reference_type, correction_group_id, created_at)
         VALUES ($1, $2, 'debit', $3, $4, 'Department Payment', $5, 'department', $6, NOW())`,
        [Number(debitWalletId), Number(staffId), Number(finalDepartmentCharge), `Department charge for ${serviceName} (#${serviceEntryId})`, serviceEntryId, deptGroupId]
      );
    }

    for (const payment of payments) {
      const groupId = crypto.randomUUID();
      const paymentRes = await client.query(
        `INSERT INTO payments (service_entry_id, wallet_id, amount, status, correction_group_id, original_payment_id, created_at)
         VALUES ($1, $2, $3, $4, $5, NULL, NOW()) RETURNING id`,
        [serviceEntryId, payment.wallet, payment.amount, payment.status, groupId]
      );
      const paymentId = paymentRes.rows[0].id;
      await client.query(`UPDATE payments SET original_payment_id = $1 WHERE id = $1`, [paymentId]);

      if (payment.status === 'received') {
        const walletRes = await client.query('SELECT wallet_type FROM wallets WHERE id = $1', [payment.wallet]);
        const walletType = walletRes.rows[0].wallet_type;
        await client.query('UPDATE wallets SET balance = balance + $1 WHERE id = $2 RETURNING balance', [payment.amount, payment.wallet]);
        await client.query(
          `INSERT INTO wallet_transactions (wallet_id, staff_id, type, amount, description, category, reference_id, reference_type, correction_group_id, reference_payment_id, created_at)
           VALUES ($1, $2, 'credit', $3, $4, 'Service Payment', $5, 'payment', $6, $7, NOW())`,
          [payment.wallet, staffId, payment.amount, `${walletType === 'cash' ? 'Cash' : 'Online'} payment for ${serviceName} (#${serviceEntryId})`, serviceEntryId, groupId, paymentId]
        );
      }
    }

    if (tokenId) {
      let tokenStatus = 'pending';
      if (status === 'completed') tokenStatus = 'completed';
      else if (status === 'not_received') tokenStatus = 'processed';
      else if (status === 'pending') tokenStatus = 'in-progress';

      await client.query(`UPDATE tokens SET status = $1, staff_id = $2, updated_at = NOW() WHERE token_id = $3`, [tokenStatus, staffId || req.user.id, tokenId]);
      if (tokenCentreId) {
        io.emit('tokenUpdate', { tokenId, status: tokenStatus, message: `Token ${tokenId} status updated to ${tokenStatus}` });
        io.to(`centre_${tokenCentreId}`).emit(`tokenUpdate:${tokenCentreId}`, { tokenId, status: tokenStatus });
      }
    }

    io.emit('serviceEntryCreated', { service_entry_id: serviceEntryId, staff_id: staffId, token_id: tokenId, message: `New service entry created for token ${tokenId}` });

    await client.query('COMMIT');

    if (status === 'completed') {
      await logActivity({
        centre_id: centreId,
        related_type: 'service_entry',
        related_id: serviceEntryId,
        action: 'Service Completed',
        description: `Service completed for ${finalCustomerName || 'Customer'} - ${serviceName}${subcategoryName ? ` (${subcategoryName})` : ''}`,
        performed_by: staffId || req.user.id,
        performed_by_role: req.user.role
      });
    }

    res.status(201).json({ message: 'Service entry created successfully', serviceEntryId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('servicemanagement.js error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PUT /api/servicemanagement/entry/:id
router.put('/entry/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { customerName, phone, categoryId, subcategoryId, serviceCharge, departmentCharge, totalCharge, status, expiryDate, serviceWalletId, payments, staffId } = req.body;

  const client = await pool.connect();
  try {
    const errors = [];
    if (customerName && (typeof customerName !== 'string' || customerName.trim() === '')) errors.push('customerName must be non-empty');
    if (phone && (typeof phone !== 'string' || phone.trim() === '')) errors.push('phone must be non-empty');
    if (categoryId && isNaN(parseInt(categoryId))) errors.push('categoryId must be valid');
    if (subcategoryId && isNaN(parseInt(subcategoryId))) errors.push('subcategoryId must be valid');
    if (serviceCharge !== undefined && (isNaN(parseFloat(serviceCharge)) || parseFloat(serviceCharge) < 0)) errors.push('serviceCharge must be non-negative');
    if (departmentCharge !== undefined && (isNaN(parseFloat(departmentCharge)) || parseFloat(departmentCharge) < 0)) errors.push('departmentCharge must be non-negative');
    if (totalCharge !== undefined) {
      const calc = parseFloat(serviceCharge || 0) + parseFloat(departmentCharge || 0);
      if (isNaN(parseFloat(totalCharge)) || parseFloat(totalCharge) !== calc) errors.push('totalCharge must match serviceCharge + departmentCharge');
    }
    if (status && !['pending', 'completed', 'not_received'].includes(status)) errors.push('status must be pending/completed/not_received');
    if (staffId && isNaN(parseInt(staffId))) errors.push('staffId must be valid');
    if (req.body.payments && req.body.payments.length > 0) {
      return res.status(400).json({ error: 'Payments cannot be modified during service entry update' });
    }
    if (errors.length > 0) return res.status(400).json({ error: 'Missing or invalid fields', details: errors });

    await client.query('BEGIN');

    const entryResult = await client.query('SELECT * FROM service_entries WHERE id = $1', [parseInt(id)]);
    if (entryResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Service Entry ID ${id} not found` });
    }
    const existingEntry = entryResult.rows[0];
    const createdDate = new Date(existingEntry.created_at);
    const today = new Date();
    createdDate.setHours(0,0,0,0);
    today.setHours(0,0,0,0);
    if (createdDate.getTime() !== today.getTime()) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Editing allowed only for today\'s entries' });
    }
    if (req.user.role === 'staff' && existingEntry.is_edited) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'You have already edited this entry' });
    }

    const existingStaffResult = await client.query('SELECT centre_id FROM staff WHERE id = $1', [existingEntry.staff_id]);
    if (existingStaffResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Staff ID ${existingEntry.staff_id} not found` });
    }
    const centreId = existingStaffResult.rows[0].centre_id;
    if (req.user.role !== 'superadmin' && centreId !== parseInt(req.user.centre_id)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Unauthorized to update this entry' });
    }

    let finalCategoryId = existingEntry.category_id;
    let serviceName = null;
    if (categoryId) {
      const categoryResult = await client.query('SELECT id, wallet_id, name, requires_wallet, has_expiry FROM services WHERE id = $1', [parseInt(categoryId)]);
      if (categoryResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Category ID ${categoryId} not found` });
      }
      finalCategoryId = parseInt(categoryId);
      serviceName = categoryResult.rows[0].name;
    }

    let finalSubcategoryId = existingEntry.subcategory_id;
    let subcategoryName = null;
    if (subcategoryId) {
      const subcategoryResult = await client.query('SELECT id, service_id, name FROM subcategories WHERE id = $1 AND service_id = $2', [parseInt(subcategoryId), parseInt(categoryId || finalCategoryId)]);
      if (subcategoryResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Subcategory ID ${subcategoryId} not found` });
      }
      finalSubcategoryId = parseInt(subcategoryId);
      subcategoryName = subcategoryResult.rows[0].name;
    }

    let finalStaffId = existingEntry.staff_id;
    if (staffId) {
      const staffResult = await client.query('SELECT id, centre_id FROM staff WHERE id = $1', [parseInt(staffId)]);
      if (staffResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Staff ID ${staffId} not found` });
      }
      if (req.user.role !== 'superadmin' && staffResult.rows[0].centre_id !== parseInt(req.user.centre_id)) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: `Staff ID ${staffId} does not belong to your centre` });
      }
      finalStaffId = parseInt(staffId);
    }

    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;
    if (customerName) { updateFields.push(`customer_name = $${paramIndex++}`); updateValues.push(customerName.trim()); }
    if (phone) { updateFields.push(`phone = $${paramIndex++}`); updateValues.push(phone.trim()); }
    if (categoryId) { updateFields.push(`category_id = $${paramIndex++}`); updateValues.push(parseInt(categoryId)); }
    if (subcategoryId) { updateFields.push(`subcategory_id = $${paramIndex++}`); updateValues.push(parseInt(subcategoryId)); }
    if (serviceCharge !== undefined) { updateFields.push(`service_charges = $${paramIndex++}`); updateValues.push(parseFloat(serviceCharge)); }
    if (departmentCharge !== undefined) { updateFields.push(`department_charges = $${paramIndex++}`); updateValues.push(parseFloat(departmentCharge)); }
    if (totalCharge !== undefined) { updateFields.push(`total_charges = $${paramIndex++}`); updateValues.push(parseFloat(totalCharge)); }
    if (status) { updateFields.push(`status = $${paramIndex++}`); updateValues.push(status); }
    if (expiryDate !== undefined) { updateFields.push(`expiry_date = $${paramIndex++}`); updateValues.push(expiryDate || null); }
    if (staffId) { updateFields.push(`staff_id = $${paramIndex++}`); updateValues.push(parseInt(staffId)); }
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    if (req.user.role === 'staff') updateFields.push(`is_edited = true`);
    updateValues.push(parseInt(id));

    if (updateFields.length === 1) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No fields to update' });
    }

    const updateQuery = `UPDATE service_entries SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    const result = await client.query(updateQuery, updateValues);
    const updatedEntry = result.rows[0];

    if (status && updatedEntry.token_id) {
      let tokenStatus = 'pending';
      if (status === 'completed') tokenStatus = 'completed';
      else if (status === 'not_received') tokenStatus = 'processed';
      else if (status === 'pending') tokenStatus = 'in-progress';
      await client.query('UPDATE tokens SET status = $1, updated_at = NOW() WHERE token_id = $2', [tokenStatus, updatedEntry.token_id]);
      io.emit('tokenUpdate', { tokenId: updatedEntry.token_id, status: tokenStatus });
      io.to(`centre_${centreId}`).emit(`tokenUpdate:${centreId}`, { tokenId: updatedEntry.token_id, status: tokenStatus });
    }

    if (status) {
      const trackingResult = await client.query('SELECT id, status, application_number FROM service_tracking WHERE service_entry_id = $1', [parseInt(id)]);
      if (trackingResult.rows.length > 0) {
        const trackingStatus = status === 'completed' ? 'completed' : status === 'not_received' ? 'rejected' : 'pending';
        await client.query(`UPDATE service_tracking SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE service_entry_id = $2`, [trackingStatus, parseInt(id)]);
        io.to(`centre_${centreId}`).emit('serviceTrackingUpdate', { applicationNumber: trackingResult.rows[0].application_number, status: trackingStatus });
      }
    }

    await client.query(`INSERT INTO audit_logs (action, performed_by, details, centre_id, created_at) VALUES ($1, $2, $3, $4, NOW())`, ['Service Entry Updated', req.user.username, `Updated service entry ID ${id}`, centreId]);

    const paymentsResult = await client.query(`
      SELECT DISTINCT ON (p.correction_group_id) p.id, p.wallet_id, p.amount, p.status, w.name AS wallet_name, w.wallet_type
      FROM payments p JOIN wallets w ON p.wallet_id = w.id
      WHERE p.service_entry_id = $1 AND p.is_reversal = FALSE
      ORDER BY p.correction_group_id, p.created_at DESC
    `, [id]);

    await client.query('COMMIT');

    if (status === 'completed' && existingEntry.status !== 'completed') {
      await logActivity({
        centre_id: centreId, related_type: 'service_entry', related_id: id,
        action: 'Service Completed', description: `Service marked as completed for ${updatedEntry.customer_name}`,
        performed_by: req.user.id, performed_by_role: req.user.role
      });
    }

    const formattedEntry = {
      id: updatedEntry.id,
      tokenId: updatedEntry.token_id,
      customerName: updatedEntry.customer_name,
      phone: updatedEntry.phone,
      category: updatedEntry.category_id,
      subcategory: updatedEntry.subcategory_id,
      subcategoryName: subcategoryName || (await client.query('SELECT name FROM subcategories WHERE id = $1', [updatedEntry.subcategory_id])).rows[0].name,
      serviceCharge: parseFloat(updatedEntry.service_charges),
      departmentCharge: parseFloat(updatedEntry.department_charges),
      totalCharge: parseFloat(updatedEntry.total_charges),
      serviceWalletId: updatedEntry.service_wallet_id,
      staffId: parseInt(updatedEntry.staff_id),
      created_at: updatedEntry.created_at ? updatedEntry.created_at.toISOString() : null,
      paidAmount: paymentsResult.rows.filter(p => p.status === 'received').reduce((sum, p) => sum + parseFloat(p.amount), 0),
      pendingAmount: paymentsResult.rows.filter(p => p.status === 'pending').reduce((sum, p) => sum + parseFloat(p.amount), 0),
      balanceAmount: parseFloat(updatedEntry.total_charges) - paymentsResult.rows.filter(p => p.status === 'received').reduce((sum, p) => sum + parseFloat(p.amount), 0),
      expiryDate: updatedEntry.expiry_date ? updatedEntry.expiry_date.toISOString().split('T')[0] : null,
      status: updatedEntry.status,
      payments: paymentsResult.rows.map(p => ({ id: p.id, wallet: p.wallet_id, method: p.wallet_type === 'cash' ? 'cash' : 'wallet', amount: parseFloat(p.amount), status: p.status })),
      customerServiceId: updatedEntry.customer_service_id,
    };

    res.json({ message: 'Service entry updated successfully', entry: formattedEntry });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('servicemanagement.js: Error updating service entry:', err);
    res.status(err.message === 'Service Entry ID not found' ? 404 : 500).json({ error: 'Failed to update service entry: ' + err.message });
  } finally {
    client.release();
  }
});

// ========== UNIFIED TRANSACTION CORRECTION ENGINE ==========

// 🔥 UPDATED: GET /api/servicemanagement/transactions/:id/correction-status
// Now accepts either wallet_transactions.id OR reference_payment_id
router.get('/transactions/:id/correction-status', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    console.log(`🔍 Checking correction status for ID: ${id}`);
    
    // 🔥 FIXED: Try to find by id OR by reference_payment_id
    const txRes = await client.query(
      `SELECT wt.id, wt.correction_group_id, wt.category, wt.type, wt.is_reversal, wt.reference_id
       FROM wallet_transactions wt
       WHERE wt.id = $1 
          OR wt.reference_payment_id = $1
       LIMIT 1`,
      [id]
    );
    
    if (txRes.rows.length === 0) {
      console.log(`❌ Transaction not found for ID: ${id}`);
      return res.status(404).json({ 
        error: 'Transaction not found',
        hint: 'Ensure you are passing a valid wallet_transactions.id or payment reference',
        searched_id: id
      });
    }
    
    const tx = txRes.rows[0];
    console.log(`✅ Found transaction:`, { id: tx.id, category: tx.category, type: tx.type, is_reversal: tx.is_reversal });
    
    if (tx.is_reversal) {
      return res.json({ transaction_id: tx.id, can_correct: false, reason: 'Cannot correct a reversal transaction', corrections_used: 0, max_corrections_staff: 2, role: req.user.role });
    }
    if (tx.category === 'Transfer') {
      return res.json({ transaction_id: tx.id, can_correct: false, reason: 'Transfers must be reversed manually', corrections_used: 0, max_corrections_staff: 2, role: req.user.role });
    }
    
    const groupId = tx.correction_group_id;
    if (!groupId) {
      return res.json({ transaction_id: tx.id, can_correct: true, corrections_used: 0, max_corrections_staff: 2, role: req.user.role, category: tx.category, type: tx.type, reference_id: tx.reference_id });
    }
    
    const countRes = await client.query(
      `SELECT COUNT(*) as correction_count FROM wallet_transactions WHERE correction_group_id = $1 AND (is_reversal IS NULL OR is_reversal = FALSE)`,
      [groupId]
    );
    const correctionCount = parseInt(countRes.rows[0].correction_count);
    const correctionsUsed = correctionCount - 1;
    const canCorrect = req.user.role === 'staff' ? correctionsUsed < 2 : true;
    
    res.json({ transaction_id: tx.id, correction_group_id: groupId, total_entries: correctionCount, corrections_used: correctionsUsed, max_corrections_staff: 2, can_correct: canCorrect, role: req.user.role, category: tx.category, type: tx.type, reference_id: tx.reference_id });
  } catch (err) {
    console.error('Error checking correction status:', err);
    res.status(500).json({ error: 'Failed to check correction status' });
  } finally {
    client.release();
  }
});

// GET /api/servicemanagement/transactions/:id/history
router.get('/transactions/:id/history', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    const txRes = await client.query(
      `SELECT wt.id, wt.correction_group_id, wt.amount, wt.type, wt.category, wt.is_reversal, wt.created_at, wt.description, w.name AS wallet_name
       FROM wallet_transactions wt JOIN wallets w ON wt.wallet_id = w.id WHERE wt.id = $1`,
      [id]
    );
    if (txRes.rows.length === 0) return res.status(404).json({ error: 'Transaction not found' });
    
    const groupId = txRes.rows[0].correction_group_id;
    if (!groupId) {
      const tx = txRes.rows[0];
      return res.json([{ id: tx.id, amount: parseFloat(tx.amount), type: tx.type, category: tx.category, wallet_name: tx.wallet_name, is_reversal: tx.is_reversal || false, created_at: tx.created_at, description: tx.description, entry_type: 'Original' }]);
    }

    const result = await client.query(
      `SELECT wt.id, wt.amount, wt.type, wt.category, wt.is_reversal, wt.created_at, wt.description, w.name AS wallet_name, s.name AS staff_name
       FROM wallet_transactions wt JOIN wallets w ON wt.wallet_id = w.id LEFT JOIN staff s ON wt.staff_id = s.id
       WHERE wt.correction_group_id = $1 ORDER BY wt.created_at ASC`,
      [groupId]
    );

    const history = result.rows.map(row => {
      let entryType = 'Correction';
      if (row.is_reversal) entryType = 'Reversal';
      else if (row.id === parseInt(id)) entryType = 'Original';
      return { id: row.id, amount: parseFloat(row.amount), type: row.type, category: row.category, wallet_name: row.wallet_name, is_reversal: row.is_reversal || false, created_at: row.created_at, description: row.description, staff_name: row.staff_name, entry_type: entryType };
    });
    res.json(history);
  } catch (err) {
    console.error('Error fetching transaction history:', err);
    res.status(500).json({ error: 'Failed to fetch transaction history' });
  } finally {
    client.release();
  }
});

// 🔥 PUT /api/servicemanagement/transactions/:id/correct - Unified Correction Engine
router.put('/transactions/:id/correct', authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    const transactionId = parseInt(req.params.id);
    const { new_amount, new_wallet_id, reason } = req.body;
    const user = req.user;

    console.log(`🔧 Correction request for ID: ${transactionId}`, { new_amount, new_wallet_id, reason });

    if (!reason || reason.trim().length < 5) {
      return res.status(400).json({ error: 'Reason is required (min 5 chars)' });
    }

    await client.query('BEGIN');

    // 🔥 STEP 1: FIND TRANSACTION - Try by id OR by reference_payment_id
    const baseRes = await client.query(
      `SELECT wt.*, w.name as wallet_name, w.balance, w.centre_id
       FROM wallet_transactions wt
       JOIN wallets w ON wt.wallet_id = w.id
       WHERE wt.id = $1 
          OR wt.reference_payment_id = $1
       LIMIT 1`,
      [transactionId]
    );

    if (baseRes.rows.length === 0) {
      console.log(`❌ No transaction found for ID: ${transactionId}`);
      throw new Error('Transaction not found');
    }

    const foundTx = baseRes.rows[0];
    console.log(`✅ Found transaction:`, { id: foundTx.id, category: foundTx.category, type: foundTx.type, is_reversal: foundTx.is_reversal });

    const groupId = foundTx.correction_group_id;

    // 🔥 STEP 2: GET LATEST VALID TRANSACTION IN CORRECTION GROUP
    let latestTxRes;

    if (groupId) {
      latestTxRes = await client.query(
        `SELECT wt.*, w.name as wallet_name, w.balance, w.centre_id
         FROM wallet_transactions wt
         JOIN wallets w ON wt.wallet_id = w.id
         WHERE wt.correction_group_id = $1
         AND (wt.is_reversal IS NULL OR wt.is_reversal = FALSE)
         ORDER BY wt.created_at DESC
         LIMIT 1
         FOR UPDATE`,
        [groupId]
      );
    } else {
      latestTxRes = await client.query(
        `SELECT wt.*, w.name as wallet_name, w.balance, w.centre_id
         FROM wallet_transactions wt
         JOIN wallets w ON wt.wallet_id = w.id
         WHERE wt.id = $1
         FOR UPDATE`,
        [foundTx.id]
      );
    }

    if (latestTxRes.rows.length === 0) {
      throw new Error('Valid transaction not found');
    }

    const original = latestTxRes.rows[0];
    console.log(`✅ Latest valid transaction:`, { id: original.id, amount: original.amount, type: original.type });

    // 🔥 VALIDATIONS
    if (original.is_reversal) {
      throw new Error('Cannot correct reversal transaction');
    }

    const allowedCategories = ['Service Payment', 'Department Payment', 'Service Charge'];
    if (!allowedCategories.includes(original.category)) {
      throw new Error(`Cannot correct ${original.category}`);
    }

    if (user.role !== 'superadmin' && original.centre_id !== user.centre_id) {
      throw new Error('Unauthorized access');
    }

    // FINAL VALUES
    const finalAmount = new_amount !== undefined ? parseFloat(new_amount) : parseFloat(original.amount);
    const finalWalletId = new_wallet_id !== undefined ? parseInt(new_wallet_id) : original.wallet_id;

    if (isNaN(finalAmount) || finalAmount <= 0) {
      throw new Error('Invalid amount');
    }

    // 🔥 LOCK NEW WALLET IF CHANGED
    if (finalWalletId !== original.wallet_id) {
      const newWalletRes = await client.query(
        `SELECT * FROM wallets WHERE id = $1 FOR UPDATE`,
        [finalWalletId]
      );
      if (newWalletRes.rows.length === 0) throw new Error('New wallet not found');
    }

    // 🔥 BALANCE CHECK
    const reverseType = original.type === 'credit' ? 'debit' : 'credit';

    if (original.type === 'credit' && parseFloat(original.balance) < parseFloat(original.amount)) {
      throw new Error(`Insufficient balance to reverse`);
    }

    if (original.type === 'debit') {
      const walletRes = await client.query(
        `SELECT balance FROM wallets WHERE id = $1`,
        [finalWalletId]
      );
      if (parseFloat(walletRes.rows[0].balance) < finalAmount) {
        throw new Error(`Insufficient balance in wallet`);
      }
    }

    const correctionGroupId = original.correction_group_id || crypto.randomUUID();

    // 🔥 STAFF LIMIT
    if (user.role === 'staff') {
      const countRes = await client.query(
        `SELECT COUNT(*) FROM wallet_transactions 
         WHERE correction_group_id = $1 
         AND (is_reversal IS NULL OR is_reversal = FALSE)`,
        [correctionGroupId]
      );

      if (parseInt(countRes.rows[0].count) >= 3) {
        throw new Error('Max 2 corrections allowed');
      }
    }

    // 🔥 STEP 3: REVERSAL
    await client.query(
      `INSERT INTO wallet_transactions (
        wallet_id, staff_id, type, amount, description, category,
        reference_id, reference_type, is_reversal, correction_group_id,
        reference_payment_id, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE,$9,$10,NOW())`,
      [
        original.wallet_id,
        user.id,
        reverseType,
        original.amount,
        `Correction reversal: ${reason} (Original: ${original.description || `Txn #${original.id}`})`,
        original.category,
        original.reference_id,
        original.reference_type || 'transaction',
        correctionGroupId,
        original.reference_payment_id
      ]
    );

    // UPDATE ORIGINAL WALLET
    if (original.type === 'credit') {
      await client.query(`UPDATE wallets SET balance = balance - $1 WHERE id = $2`,
        [original.amount, original.wallet_id]);
    } else {
      await client.query(`UPDATE wallets SET balance = balance + $1 WHERE id = $2`,
        [original.amount, original.wallet_id]);
    }

    // 🔥 STEP 4: CREATE NEW CORRECTED TRANSACTION
    let newPaymentId = null;

    if (original.category === 'Service Payment' && original.reference_id) {
      const paymentGroupId = crypto.randomUUID();

      const paymentRes = await client.query(
        `INSERT INTO payments (
          service_entry_id, wallet_id, amount, status,
          correction_group_id, original_payment_id, created_at
        ) VALUES ($1,$2,$3,'received',$4,NULL,NOW()) RETURNING id`,
        [original.reference_id, finalWalletId, finalAmount, paymentGroupId]
      );

      newPaymentId = paymentRes.rows[0].id;

      await client.query(
        `UPDATE payments SET original_payment_id = $1 WHERE id = $1`,
        [newPaymentId]
      );
    }

    const newTx = await client.query(
      `INSERT INTO wallet_transactions (
        wallet_id, staff_id, type, amount, description, category,
        reference_id, reference_type, correction_group_id,
        reference_payment_id, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW()) RETURNING id`,
      [
        finalWalletId,
        user.id,
        original.type,
        finalAmount,
        `Corrected: ${reason} (Was: ₹${original.amount} from ${original.wallet_name})`,
        original.category,
        original.reference_id,
        original.reference_type || 'transaction',
        correctionGroupId,
        newPaymentId
      ]
    );

    // UPDATE NEW WALLET
    if (original.type === 'credit') {
      await client.query(`UPDATE wallets SET balance = balance + $1 WHERE id = $2`,
        [finalAmount, finalWalletId]);
    } else {
      await client.query(`UPDATE wallets SET balance = balance - $1 WHERE id = $2`,
        [finalAmount, finalWalletId]);
    }

    // 🔥 UPDATE SERVICE ENTRY
    if (original.reference_id) {
      if (original.category === 'Department Payment') {
        await client.query(
          `UPDATE service_entries SET department_charges = $1 WHERE id = $2`,
          [finalAmount, original.reference_id]
        );
      }

      if (original.category === 'Service Charge') {
        await client.query(
          `UPDATE service_entries SET service_charges = $1 WHERE id = $2`,
          [finalAmount, original.reference_id]
        );
      }

      await client.query(
        `UPDATE service_entries 
         SET total_charges = service_charges + department_charges 
         WHERE id = $1`,
        [original.reference_id]
      );
    }

    // Audit logging
    const auditDetails = `Corrected txn #${original.id} (${original.category}): ₹${parseFloat(original.amount).toFixed(2)} → ₹${finalAmount.toFixed(2)} | Wallet: ${original.wallet_id} → ${finalWalletId} | Reason: ${reason}`;
    
    await client.query(
      `INSERT INTO audit_logs (action, performed_by, details, centre_id, created_at) 
       VALUES ($1, $2, $3, $4, NOW())`,
      ['Transaction Corrected', user.username, auditDetails, original.centre_id]
    );

    await logActivity({
      centre_id: original.centre_id,
      related_type: 'transaction',
      related_id: transactionId,
      action: 'Transaction Corrected',
      description: auditDetails,
      performed_by: user.id,
      performed_by_role: user.role
    });

    await client.query('COMMIT');

    console.log(`✅ Correction successful. New transaction ID: ${newTx.rows[0].id}`);

    res.json({
      success: true,
      message: 'Transaction corrected successfully',
      new_transaction_id: newTx.rows[0].id,
      correction_group_id: correctionGroupId
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Correction error:', err);
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ========== CAMPAIGN AND TOKEN ROUTES ==========

// GET /api/servicemanagement/tokens/:tokenId
router.get('/tokens/:tokenId', authenticateToken, async (req, res) => {
  const { tokenId } = req.params;
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT t.*, c.name AS centre_name, s.name AS service_name, sc.name AS subcategory_name, cmp.name AS campaign_name,
              st.name AS staff_name, st2.name AS created_by_name
       FROM tokens t
       JOIN centres c ON t.centre_id = c.id
       LEFT JOIN services s ON t.category_id = s.id
       LEFT JOIN subcategories sc ON t.subcategory_id = sc.id
       LEFT JOIN campaigns cmp ON t.campaign_id = cmp.id
       LEFT JOIN staff st ON t.staff_id::integer = st.id
       LEFT JOIN staff st2 ON t.created_by::integer = st2.id
       WHERE t.token_id = $1`,
      [tokenId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Token not found' });
    }
    if (req.user.role !== 'superadmin' && result.rows[0].centre_id !== req.user.centre_id) {
      return res.status(403).json({ error: 'Unauthorized to access this token' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching token:', err);
    res.status(500).json({ error: 'Failed to fetch token: ' + err.message });
  } finally {
    client.release();
  }
});

// GET /api/servicemanagement/staff
router.get('/staff', authenticateToken, async (req, res) => {
  const { centre_id } = req.query;

  try {
    let query = `
      SELECT id, username, name, role, department, email, phone,
             status, join_date, photo, employee_id, employment_type,
             reports_to, salary, dob, gender, emergency_contact, emergency_relationship
      FROM staff
    `;
    const values = [];
    if (req.user.role !== 'superadmin') {
      query += ` WHERE centre_id = $1`;
      values.push(req.user.centre_id);
    } else if (centre_id) {
      query += ` WHERE centre_id = $1`;
      values.push(centre_id);
    }
    query += ` ORDER BY id`;

    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching staff:', err);
    res.status(500).json({ error: 'Failed to fetch staff: ' + err.message });
  }
});

// Generate unique token ID
const generateTokenId = async (db, centreId) => {
  const result = await db.query(
    'SELECT COUNT(*) as count FROM tokens WHERE centre_id = $1 AND created_at::date = CURRENT_DATE',
    [centreId]
  );
  const count = parseInt(result.rows[0].count) + 1;
  return `TKN-${centreId}-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${count.toString().padStart(2, '0')}`;
};

// Generate campaign-specific token ID
const generateCampaignTokenId = async (db, campaignId, centreId) => {
  const campaignResult = await db.query(
    'SELECT name, start_date FROM campaigns WHERE id = $1',
    [campaignId]
  );
  
  if (campaignResult.rows.length === 0) {
    throw new Error('Campaign not found');
  }
  
  const campaign = campaignResult.rows[0];
  
  const campaignCode = campaign.name
    .replace(/[^a-zA-Z0-9]/g, '')
    .substring(0, 5)
    .toUpperCase();
  
  const countResult = await db.query(
    'SELECT COUNT(*) as count FROM tokens WHERE campaign_id = $1',
    [campaignId]
  );
  
  const count = parseInt(countResult.rows[0].count) + 1;
  
  return `${campaignCode}-${centreId}-${count.toString().padStart(3, '0')}`;
};

// Create Token
router.post('/tokens', authenticateToken, async (req, res) => {
  const { customerName, phone, categoryId, subcategoryId, campaignId, centreId, type } = req.body;
  const staffId = req.user.id;
  const userRole = req.user.role;

  console.log('servicemanagement.js: Received token creation request:', JSON.stringify(req.body, null, 2));

  const errors = [];
  if (!customerName || customerName.trim().length < 2) {
    errors.push('Customer name is required and must be at least 2 characters');
  }
  if (!phone || !/^\d{10}$/.test(phone)) {
    errors.push('Valid 10-digit phone number is required');
  }
  if (userRole !== 'admin' && (!centreId || isNaN(parseInt(centreId)))) {
    errors.push('Valid centre ID is required for non-admin users');
  }
  if (categoryId && isNaN(parseInt(categoryId))) {
    errors.push('Valid category ID is required');
  }
  if (subcategoryId && isNaN(parseInt(subcategoryId))) {
    errors.push('Valid subcategory ID is required');
  }
  if (!type || !['normal', 'campaign'].includes(type)) {
    errors.push('Type is required and must be either "normal" or "campaign"');
  }
  
  if (type === 'campaign') {
    if (!campaignId) {
      errors.push('Campaign ID is required for campaign tokens');
    } else {
      const campaignCheck = await pool.query(
        `SELECT id, name, target_tokens, 
                (SELECT COUNT(*) FROM tokens WHERE campaign_id = $1) as tokens_generated,
                start_date, end_date
         FROM campaigns 
         WHERE id = $2 AND centre_id = $3`,
        [parseInt(campaignId), parseInt(campaignId), parseInt(centreId || req.user.centre_id)]
      );
      
      if (campaignCheck.rows.length === 0) {
        errors.push('Campaign not found');
      } else {
        const campaign = campaignCheck.rows[0];
        const today = new Date();
        const startDate = new Date(campaign.start_date);
        const endDate = new Date(campaign.end_date);
        
        if (today < startDate || today > endDate) {
          errors.push('Campaign is not active (outside campaign dates)');
        }
        
        if (parseInt(campaign.tokens_generated) >= parseInt(campaign.target_tokens)) {
          errors.push('Campaign target tokens limit has been reached');
        }
      }
    }
  } else {
    if (campaignId) {
      errors.push('Campaign ID should not be provided for normal tokens');
    }
  }

  if (errors.length > 0) {
    console.log('servicemanagement.js: Validation errors:', errors);
    return res.status(400).json({ error: 'Invalid input', details: errors });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const finalCentreId = userRole === 'admin' ? req.user.centre_id : parseInt(centreId);

    if (userRole !== 'superadmin') {
      const centreResult = await client.query(
        `SELECT c.id 
         FROM centres c
         LEFT JOIN staff s ON s.centre_id = c.id
         WHERE c.id = $1 AND (c.admin_id = $2 OR s.id = $2)`,
        [finalCentreId, parseInt(staffId)]
      );
      if (centreResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'You do not have access to this centre' });
      }
    }

    if (categoryId) {
      const categoryResult = await client.query(
        'SELECT id FROM services WHERE id = $1',
        [parseInt(categoryId)]
      );
      if (categoryResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Invalid category ID' });
      }
    }
    if (subcategoryId) {
      const subResult = await client.query(
        'SELECT id FROM subcategories WHERE id = $1 AND service_id = $2',
        [parseInt(subcategoryId), parseInt(categoryId)]
      );
      if (subResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Invalid subcategory ID' });
      }
    }

    const staffResult = await client.query(
      'SELECT id FROM staff WHERE id = $1',
      [parseInt(staffId)]
    );
    if (staffResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid staff ID' });
    }

    let tokenId;
    if (type === 'campaign') {
      tokenId = await generateCampaignTokenId(client, parseInt(campaignId), finalCentreId);
    } else {
      tokenId = await generateTokenId(client, finalCentreId);
    }

    const result = await client.query(
      `INSERT INTO tokens (
        token_id, centre_id, customer_name, phone, category_id, subcategory_id, campaign_id, status, staff_id, created_by, type, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULL, $9, $10, CURRENT_TIMESTAMP)
      RETURNING id, token_id, centre_id, customer_name, phone, category_id, subcategory_id, campaign_id, status, staff_id, created_by, type, created_at`,
      [
        tokenId,
        finalCentreId,
        customerName.trim(),
        phone.trim(),
        categoryId ? parseInt(categoryId) : null,
        subcategoryId ? parseInt(subcategoryId) : null,
        type === 'campaign' ? parseInt(campaignId) : null,
        'pending',
        staffId.toString(),
        type
      ]
    );

    const token = result.rows[0];

    if (type === 'normal') {
      io.to(`centre_${finalCentreId}`).emit('newToken', {
        token_id: token.token_id,
        centre_id: token.centre_id,
        message: `New token ${token.token_id} created for ${token.customer_name}`,
      });
    }

    await client.query('COMMIT');
    console.log('servicemanagement.js: Token created:', JSON.stringify(token, null, 2));
    res.status(201).json({ message: 'Token created successfully', token });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('servicemanagement.js: Error creating token:', err);
    res.status(500).json({ error: 'Failed to create token: ' + err.message });
  } finally {
    client.release();
  }
});

// Assign or Reassign Staff to Token
router.put('/token/:tokenId/assign', authenticateToken, async (req, res) => {
  const { tokenId } = req.params;
  const { staffId } = req.body;
  const userRole = req.user.role;
  const userId = req.user.id;

  console.log('servicemanagement.js: Received token assignment request:', { tokenId, staffId });

  const errors = [];
  if (!staffId || isNaN(parseInt(staffId))) {
    errors.push('Valid staff ID is required');
  }
  if (userRole !== 'admin' && userRole !== 'superadmin') {
    errors.push('Only admins or superadmins can assign staff');
  }

  if (errors.length > 0) {
    console.log('servicemanagement.js: Validation errors:', errors);
    return res.status(400).json({ error: 'Invalid input', details: errors });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const tokenResult = await client.query(
      'SELECT * FROM tokens WHERE token_id = $1',
      [tokenId]
    );
    
    if (tokenResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Token ${tokenId} not found` });
    }

    const token = tokenResult.rows[0];
    
    if (token.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Token is not in pending status' });
    }

    if (userRole === 'admin') {
      const centreResult = await client.query(
        `SELECT c.id 
         FROM centres c
         WHERE c.id = $1 AND c.admin_id = $2`,
        [token.centre_id, parseInt(userId)]
      );
      if (centreResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'You do not have access to this centre' });
      }
    }

    const staffResult = await client.query(
      'SELECT id, name FROM staff WHERE id = $1 AND centre_id = $2',
      [parseInt(staffId), token.centre_id]
    );
    if (staffResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Assigned staff does not belong to this centre' });
    }

    await client.query(
      'UPDATE tokens SET staff_id = $1, updated_at = CURRENT_TIMESTAMP WHERE token_id = $2',
      [staffId.toString(), tokenId]
    );

    await client.query('COMMIT');
    console.log('servicemanagement.js: Token assigned/reassigned:', { tokenId, staffId });

    const staffName = staffResult.rows[0].name || 'Staff';
    io.to(`centre_${token.centre_id}`).emit('tokenReassigned', {
      token_id: tokenId,
      staff_id: staffId,
      staff_name: staffName,
      message: `Token ${tokenId} reassigned to ${staffName}`,
    });

    res.json({ message: 'Token assigned successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('servicemanagement.js: Error assigning token:', err);
    res.status(500).json({ error: 'Failed to assign token: ' + err.message });
  } finally {
    client.release();
  }
});

// PUT /api/servicemanagement/token/:tokenId/status
router.put('/token/:tokenId/status', authenticateToken, async (req, res) => {
  const { tokenId } = req.params;
  const { status } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const validStatuses = ['pending', 'processed', 'completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const tokenCheck = await client.query('SELECT centre_id FROM tokens WHERE token_id = $1', [tokenId]);
    if (tokenCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Token not found' });
    }
    if (req.user.role !== 'superadmin' && tokenCheck.rows[0].centre_id !== req.user.centre_id) {
      return res.status(403).json({ error: 'Unauthorized to update this token' });
    }
    await client.query('UPDATE tokens SET status = $1, updated_at = NOW() WHERE token_id = $2', [status, tokenId]);
    await client.query(
      'INSERT INTO audit_logs (action, performed_by, details, centre_id, created_at) VALUES ($1, $2, $3, $4, NOW())',
      ['Token Status Updated', req.user.username, `Updated token ${tokenId} to ${status}`, tokenCheck.rows[0].centre_id]
    );
    io.to(`centre_${tokenCheck.rows[0].centre_id}`).emit(`tokenUpdate:${tokenCheck.rows[0].centre_id}`, { tokenId, status });
    console.log('servicemanagement.js: Emitted tokenUpdate:', { tokenId, status, centreId: tokenCheck.rows[0].centre_id });
    await client.query('COMMIT');
    res.json({ message: 'Token status updated successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('servicemanagement.js: Error updating token status:', err);
    res.status(500).json({ error: 'Failed to update token status: ' + err.message });
  } finally {
    client.release();
  }
});

// Get Active Tokens (excludes expired campaign tokens)
router.get('/tokens', authenticateToken, async (req, res) => {
  const { centreId, status } = req.query;
  const userRole = req.user.role;
  const userId = req.user.id;

  const client = await pool.connect();
  try {
    let query = `
      SELECT t.id, t.token_id, t.centre_id, t.customer_name, t.phone, t.category_id, 
             t.subcategory_id, t.campaign_id, t.status, t.staff_id, t.created_by, t.type, 
             t.created_at, c.name AS centre_name, s.name AS service_name, 
             sc.name AS subcategory_name, cmp.name AS campaign_name, st.name AS staff_name,
             st2.name AS created_by_name
      FROM tokens t
      JOIN centres c ON t.centre_id = c.id
      LEFT JOIN services s ON t.category_id = s.id
      LEFT JOIN subcategories sc ON t.subcategory_id = sc.id
      LEFT JOIN campaigns cmp ON t.campaign_id = cmp.id
      LEFT JOIN staff st ON t.staff_id::integer = st.id
      LEFT JOIN staff st2 ON t.created_by::integer = st2.id
    `;
    const queryParams = [];
    const conditions = [];

    if (userRole !== 'superadmin') {
      conditions.push(`t.centre_id IN (
        SELECT c.id 
        FROM centres c
        LEFT JOIN staff s ON s.centre_id = c.id
        WHERE c.admin_id = $${queryParams.length + 1} OR s.id = $${queryParams.length + 1}
      )`);
      queryParams.push(parseInt(userId));
      
      if (centreId) {
        conditions.push(`t.centre_id = $${queryParams.length + 1}`);
        queryParams.push(parseInt(centreId));
      }
    } else {
      if (centreId) {
        conditions.push(`t.centre_id = $${queryParams.length + 1}`);
        queryParams.push(parseInt(centreId));
      }
    }

    if (status && status !== 'all') {
      conditions.push(`t.status = $${queryParams.length + 1}`);
      queryParams.push(status);
    }

    conditions.push(`(
      t.type = 'normal' 
      OR (
        t.type = 'campaign' 
        AND CURRENT_DATE BETWEEN cmp.start_date AND cmp.end_date
      )
    )`);

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY t.created_at DESC`;

    console.log('servicemanagement.js: Fetching active tokens with query:', query, 'params:', queryParams);
    const result = await client.query(query, queryParams);
    const tokens = result.rows.map(row => ({
      id: row.id,
      tokenId: row.token_id,
      centreId: row.centre_id,
      centreName: row.centre_name,
      customerName: row.customer_name,
      phone: row.phone,
      categoryId: row.category_id,
      serviceName: row.service_name,
      subcategoryId: row.subcategory_id,
      subcategoryName: row.subcategory_name,
      campaignId: row.campaign_id,
      campaignName: row.campaign_name,
      status: row.status,
      staffId: row.staff_id,
      staffName: row.staff_name,
      createdBy: row.created_by,
      createdByName: row.created_by_name,
      type: row.type,
      createdAt: row.created_at.toISOString(),
    }));

    console.log('servicemanagement.js: Fetched active tokens:', JSON.stringify(tokens, null, 2));
    res.json(tokens);
  } catch (err) {
    console.error('servicemanagement.js: Error fetching tokens:', err);
    res.status(500).json({ error: 'Failed to fetch tokens: ' + err.message });
  } finally {
    client.release();
  }
});

// GET /api/servicemanagement/campaigns
router.get('/campaigns', authenticateToken, async (req, res) => {
  const { centre_id } = req.query;

  try {
    let query = `
      SELECT c.*, s.name AS service_name, ct.name AS centre_name,
             (SELECT COUNT(*) FROM tokens t WHERE t.campaign_id = c.id) AS tokens_generated,
             UPPER(LEFT(REGEXP_REPLACE(c.name, '[^a-zA-Z0-9]', '', 'g'), 5)) AS campaign_code
      FROM campaigns c
      LEFT JOIN services s ON c.service_id = s.id
      LEFT JOIN centres ct ON c.centre_id = ct.id
    `;
    const values = [];
    if (req.user.role !== 'superadmin') {
      query += ` WHERE c.centre_id = $1`;
      values.push(req.user.centre_id);
    } else if (centre_id && centre_id !== 'all') {
      query += ` WHERE c.centre_id = $1`;
      values.push(centre_id);
    }
    query += ` ORDER BY c.created_at DESC`;

    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching campaigns:', err);
    res.status(500).json({ error: 'Failed to fetch campaigns: ' + err.message });
  }
});

// GET /api/servicemanagement/campaigns/active
router.get('/campaigns/active', authenticateToken, async (req, res) => {
  const { centre_id } = req.query;

  try {
    let query = `
      SELECT c.*, s.name AS service_name, ct.name AS centre_name,
             (SELECT COUNT(*) FROM tokens t WHERE t.campaign_id = c.id) AS tokens_generated,
             UPPER(LEFT(REGEXP_REPLACE(c.name, '[^a-zA-Z0-9]', '', 'g'), 5)) AS campaign_code
      FROM campaigns c
      LEFT JOIN services s ON c.service_id = s.id
      LEFT JOIN centres ct ON c.centre_id = ct.id
      WHERE CURRENT_DATE BETWEEN c.start_date AND c.end_date
    `;
    const values = [];
    if (req.user.role !== 'superadmin') {
      query += ` AND c.centre_id = $1`;
      values.push(req.user.centre_id);
    } else if (centre_id && centre_id !== 'all') {
      query += ` AND c.centre_id = $1`;
      values.push(centre_id);
    }
    query += ` ORDER BY c.created_at DESC`;

    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching active campaigns:', err);
    res.status(500).json({ error: 'Failed to fetch active campaigns: ' + err.message });
  }
});

// GET /api/servicemanagement/staff/campaigns
router.get('/staff/campaigns', authenticateToken, async (req, res) => {
  try {
    const query = `
      SELECT c.*, s.name AS service_name, ct.name AS centre_name,
             (SELECT COUNT(*) FROM tokens t WHERE t.campaign_id = c.id) AS tokens_generated
      FROM campaigns c
      LEFT JOIN services s ON c.service_id = s.id
      LEFT JOIN centres ct ON c.centre_id = ct.id
      WHERE c.centre_id = $1 AND c.start_date <= CURRENT_DATE AND c.end_date >= CURRENT_DATE
      ORDER BY c.created_at DESC
    `;
    const result = await pool.query(query, [req.user.centre_id]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching staff campaigns:', err);
    res.status(500).json({ error: 'Failed to fetch staff campaigns: ' + err.message });
  }
});

// POST /api/servicemanagement/campaigns
router.post('/campaigns', authenticateToken, async (req, res) => {
  const { name, description, service_id, start_date, end_date, centre_id, target_tokens } = req.body;

  const client = await pool.connect();
  try {
    if (!name || !service_id || !start_date || !end_date || !centre_id || target_tokens == null) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    await client.query('BEGIN');

    const serviceQuery = `SELECT id FROM services WHERE id = $1`;
    const serviceResult = await client.query(serviceQuery, [service_id]);
    if (serviceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }

    let finalCentreId = centre_id;
    if (req.user.role !== 'superadmin') {
      finalCentreId = req.user.centre_id;
    } else {
      const centreQuery = `SELECT id FROM centres WHERE id = $1`;
      const centreResult = await client.query(centreQuery, [centre_id]);
      if (centreResult.rows.length === 0) {
        return res.status(404).json({ error: 'Centre not found' });
      }
    }

    const campaignQuery = `
      INSERT INTO campaigns (name, description, service_id, start_date, end_date, centre_id, target_tokens, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING *
    `;
    const campaignResult = await client.query(campaignQuery, [
      name,
      description || null,
      service_id,
      start_date,
      end_date,
      finalCentreId,
      target_tokens
    ]);

    await client.query('COMMIT');
    res.status(201).json(campaignResult.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating campaign:', err);
    res.status(500).json({ error: 'Failed to create campaign: ' + err.message });
  } finally {
    client.release();
  }
});

// PUT /api/servicemanagement/campaigns/:id
router.put('/campaigns/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { name, description, service_id, start_date, end_date, centre_id, target_tokens } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const campaignQuery = `SELECT id, centre_id FROM campaigns WHERE id = $1`;
    const campaignResult = await client.query(campaignQuery, [id]);
    if (campaignResult.rows.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    if (req.user.role !== 'superadmin' && campaignResult.rows[0].centre_id !== req.user.centre_id) {
      return res.status(403).json({ error: 'Campaign does not belong to your centre' });
    }

    const serviceQuery = `SELECT id FROM services WHERE id = $1`;
    const serviceResult = await client.query(serviceQuery, [service_id]);
    if (serviceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }

    let finalCentreId = centre_id;
    if (req.user.role !== 'superadmin') {
      finalCentreId = req.user.centre_id;
    } else {
      const centreQuery = `SELECT id FROM centres WHERE id = $1`;
      const centreResult = await client.query(centreQuery, [centre_id]);
      if (centreResult.rows.length === 0) {
        return res.status(404).json({ error: 'Centre not found' });
      }
    }

    const updateQuery = `
      UPDATE campaigns
      SET name = COALESCE($1, name),
          description = $2,
          service_id = COALESCE($3, service_id),
          start_date = COALESCE($4, start_date),
          end_date = COALESCE($5, end_date),
          centre_id = COALESCE($6, centre_id),
          target_tokens = COALESCE($7, target_tokens),
          updated_at = NOW()
      WHERE id = $8
      RETURNING *
    `;
    const updateResult = await client.query(updateQuery, [
      name,
      description,
      service_id,
      start_date,
      end_date,
      finalCentreId,
      target_tokens,
      id
    ]);

    await client.query('COMMIT');
    res.status(200).json(updateResult.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating campaign:', err);
    res.status(500).json({ error: 'Failed to update campaign: ' + err.message });
  } finally {
    client.release();
  }
});

// GET /api/servicemanagement/campaigns/reports
router.get('/campaigns/reports', authenticateToken, async (req, res) => {
  const { centre_id, start_date, end_date, status } = req.query;

  try {
    let query = `
      SELECT c.id, c.name AS campaign_name, s.name AS service_name, 
             ct.name AS centre_name, c.start_date, c.end_date, c.target_tokens,
             (SELECT COUNT(*) FROM tokens t WHERE t.campaign_id = c.id) AS tokens_generated,
             CASE
               WHEN c.end_date < CURRENT_DATE THEN 'completed'
               WHEN c.start_date <= CURRENT_DATE AND c.end_date >= CURRENT_DATE THEN 'active'
               ELSE 'upcoming'
             END AS status
      FROM campaigns c
      LEFT JOIN services s ON c.service_id = s.id
      LEFT JOIN centres ct ON c.centre_id = ct.id
    `;
    const values = [];
    let conditions = [];

    if (req.user.role !== 'superadmin') {
      conditions.push(`c.centre_id = $${values.length + 1}`);
      values.push(req.user.centre_id);
    } else if (centre_id && centre_id !== 'all') {
      conditions.push(`c.centre_id = $${values.length + 1}`);
      values.push(centre_id);
    }

    if (start_date) {
      conditions.push(`c.start_date >= $${values.length + 1}`);
      values.push(start_date);
    }

    if (end_date) {
      conditions.push(`c.end_date <= $${values.length + 1}`);
      values.push(end_date);
    }

    if (status && status !== 'all') {
      conditions.push(`(
        CASE
          WHEN c.end_date < CURRENT_DATE THEN 'completed'
          WHEN c.start_date <= CURRENT_DATE AND c.end_date >= CURRENT_DATE THEN 'active'
          ELSE 'upcoming'
        END) = $${values.length + 1}`);
      values.push(status);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY c.created_at DESC`;

    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (err) {
    console.error('Error generating campaign reports:', err);
    res.status(500).json({ error: 'Failed to generate campaign reports: ' + err.message });
  }
});

// DELETE /api/servicemanagement/campaigns/:id
router.delete('/campaigns/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const campaignQuery = `SELECT id, centre_id FROM campaigns WHERE id = $1`;
    const campaignResult = await client.query(campaignQuery, [id]);
    if (campaignResult.rows.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    if (req.user.role !== 'superadmin' && campaignResult.rows[0].centre_id !== req.user.centre_id) {
      return res.status(403).json({ error: 'Campaign does not belong to your centre' });
    }

    await client.query(`DELETE FROM tokens WHERE campaign_id = $1`, [id]);
    await client.query(`DELETE FROM campaigns WHERE id = $1`, [id]);

    await client.query('COMMIT');
    res.status(200).json({ message: 'Campaign deleted successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error deleting campaign:', err);
    res.status(500).json({ error: 'Failed to delete campaign: ' + err.message });
  } finally {
    client.release();
  }
});

// Get Campaign Token History (includes expired campaigns)
router.get('/tokens/history', authenticateToken, async (req, res) => {
  const { centreId } = req.query;
  const userRole = req.user.role;
  const userId = req.user.id;

  const client = await pool.connect();
  try {
    let query = `
      SELECT t.id, t.token_id, t.centre_id, t.customer_name, t.phone, t.category_id, 
             t.subcategory_id, t.campaign_id, t.status, t.staff_id, t.created_by, t.type, 
             t.created_at, c.name AS centre_name, s.name AS service_name, 
             sc.name AS subcategory_name, cmp.name AS campaign_name, 
             cmp.start_date AS campaign_start_date, cmp.end_date AS campaign_end_date,
             st.name AS staff_name, st2.name AS created_by_name
      FROM tokens t
      JOIN centres c ON t.centre_id = c.id
      LEFT JOIN services s ON t.category_id = s.id
      LEFT JOIN subcategories sc ON t.subcategory_id = sc.id
      LEFT JOIN campaigns cmp ON t.campaign_id = cmp.id
      LEFT JOIN staff st ON t.staff_id::integer = st.id
      LEFT JOIN staff st2 ON t.created_by::integer = st2.id
      WHERE t.type = 'campaign'
    `;
    const queryParams = [];

    if (userRole !== 'superadmin') {
      query += ` AND t.centre_id IN (
        SELECT c.id 
        FROM centres c
        LEFT JOIN staff s ON s.centre_id = c.id
        WHERE c.admin_id = $${queryParams.length + 1} OR s.id = $${queryParams.length + 1}
      )`;
      queryParams.push(parseInt(userId));
      
      if (centreId) {
        query += ` AND t.centre_id = $${queryParams.length + 1}`;
        queryParams.push(parseInt(centreId));
      }
    } else {
      if (centreId) {
        query += ` AND t.centre_id = $${queryParams.length + 1}`;
        queryParams.push(parseInt(centreId));
      }
    }

    query += ` ORDER BY t.created_at DESC`;

    console.log('servicemanagement.js: Fetching campaign history with query:', query, 'params:', queryParams);
    const result = await client.query(query, queryParams);
    const tokens = result.rows.map(row => ({
      id: row.id,
      tokenId: row.token_id,
      centreId: row.centre_id,
      centreName: row.centre_name,
      customerName: row.customer_name,
      phone: row.phone,
      categoryId: row.category_id,
      serviceName: row.service_name,
      subcategoryId: row.subcategory_id,
      subcategoryName: row.subcategory_name,
      campaignId: row.campaign_id,
      campaignName: row.campaign_name,
      campaignStartDate: row.campaign_start_date,
      campaignEndDate: row.campaign_end_date,
      status: row.status,
      staffId: row.staff_id,
      staffName: row.staff_name,
      createdBy: row.created_by,
      createdByName: row.created_by_name,
      type: row.type,
      createdAt: row.created_at.toISOString(),
    }));

    console.log('servicemanagement.js: Fetched campaign history:', JSON.stringify(tokens, null, 2));
    res.json(tokens);
  } catch (err) {
    console.error('servicemanagement.js: Error fetching campaign history:', err);
    res.status(500).json({ error: 'Failed to fetch campaign history: ' + err.message });
  } finally {
    client.release();
  }
});

// DELETE /api/servicemanagement/tokens/:tokenId
router.delete('/tokens/:tokenId', authenticateToken, async (req, res) => {
  const { tokenId } = req.params;
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const tokenCheck = await client.query(
      'SELECT type FROM tokens WHERE token_id = $1',
      [tokenId]
    );
    
    if (tokenCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Token not found' });
    }
    
    if (tokenCheck.rows[0].type === 'campaign') {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: 'Campaign tokens cannot be deleted as they serve as booking records' 
      });
    }
    
    await client.query('DELETE FROM tokens WHERE token_id = $1', [tokenId]);
    
    await client.query('COMMIT');
    res.json({ message: 'Token deleted successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error deleting token:', err);
    res.status(500).json({ error: 'Failed to delete token: ' + err.message });
  } finally {
    client.release();
  }
});

// ========== PENDING PAYMENTS (FIXED QUERIES) ==========

// GET /api/servicemanagement/pending-payments
router.get("/pending-payments", authenticateToken, async (req, res) => {
  const { from, to } = req.query;
  const client = await pool.connect();

  try {
    const { role, id: userId, centre_id } = req.user;
    const { centreId: queryCentreId } = req.query;

    let CentreId = centre_id;

    if (role === "superadmin" && queryCentreId) {
      CentreId = Number(queryCentreId);
    }

    if ((role === "admin" || role === "superadmin") && !CentreId) {
      return res.status(400).json({ error: "centreId is required" });
    }

    let conditions = [];
    let values = [];
    let idx = 1;

    if (role === "staff") {
      conditions.push(`se.staff_id = $${idx++}`);
      values.push(userId);
    }

    if (role === "admin" || role === "superadmin") {
      conditions.push(`st.centre_id = $${idx++}`);
      values.push(CentreId);
    }

    if (from) {
      conditions.push(`se.created_at >= $${idx++}`);
      values.push(`${from} 00:00:00`);
    }

    if (to) {
      conditions.push(`se.created_at <= $${idx++}`);
      values.push(`${to} 23:59:59`);
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const query = `
      SELECT
        se.id AS service_entry_id,
        se.customer_name,
        se.phone AS customer_phone,
        se.total_charges,
        se.created_at,
        st.name AS staff_name,
        s.name AS service_name,
        sc.name AS subcategory_name,

        COALESCE(
          SUM(CASE WHEN p.status = 'received' THEN p.amount ELSE 0 END),
          0
        ) AS paid_amount,

        se.total_charges -
        COALESCE(
          SUM(CASE WHEN p.status = 'received' THEN p.amount ELSE 0 END),
          0
        ) AS pending_amount,

        COALESCE(
          json_agg(
            json_build_object(
              'id', p.id,
              'wallet_id', p.wallet_id,
              'wallet_name', w.name,
              'amount', p.amount,
              'status', p.status,
              'created_at', p.created_at
            )
            ORDER BY p.created_at NULLS LAST
          ) FILTER (WHERE p.id IS NOT NULL),
          '[]'
        ) AS payment_history

      FROM service_entries se
      JOIN staff st ON st.id = se.staff_id
      LEFT JOIN services s ON s.id = se.category_id
      LEFT JOIN subcategories sc ON sc.id = se.subcategory_id

      LEFT JOIN payments p 
        ON p.service_entry_id = se.id
        AND p.is_reversal = FALSE

      LEFT JOIN wallets w 
        ON w.id = p.wallet_id

      ${whereClause}

      GROUP BY
        se.id,
        se.customer_name,
        se.phone,
        se.total_charges,
        se.created_at,
        st.name,
        s.name,
        sc.name

      HAVING
        se.total_charges >
        COALESCE(
          SUM(CASE WHEN p.status = 'received' THEN p.amount ELSE 0 END),
          0
        )

      ORDER BY pending_amount DESC
    `;

    const { rows } = await client.query(query, values);
    res.json(rows);

  } catch (err) {
    console.error("❌ Pending payments error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch pending payments" });
  } finally {
    client.release();
  }
});

// Receive pending payment (CREDIT ONLY)
router.post("/pending-payments/:id/receive-payment", authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    const serviceEntryId = req.params.id;
    const { wallet_id, amount } = req.body;

    if (!wallet_id || !amount || Number(amount) <= 0) {
      return res.status(400).json({
        error: "wallet_id and valid amount are required"
      });
    }

    await client.query("BEGIN");

    const serviceRes = await client.query(
      `SELECT id FROM service_entries WHERE id = $1`,
      [serviceEntryId]
    );

    if (serviceRes.rows.length === 0) {
      throw new Error("Service entry not found");
    }

    const groupId = crypto.randomUUID();

    const paymentRes = await client.query(
      `
      INSERT INTO payments (
        service_entry_id,
        wallet_id,
        amount,
        status,
        correction_group_id,
        original_payment_id,
        created_at
      )
      VALUES ($1, $2, $3, 'received', $4, NULL, NOW())
      RETURNING id
      `,
      [serviceEntryId, wallet_id, amount, groupId]
    );

    const paymentId = paymentRes.rows[0].id;

    await client.query(
      `UPDATE payments SET original_payment_id = $1 WHERE id = $1`,
      [paymentId]
    );

    await client.query(
      `UPDATE wallets SET balance = balance + $1 WHERE id = $2`,
      [amount, wallet_id]
    );

    await client.query(
      `
      INSERT INTO wallet_transactions (
        wallet_id,
        staff_id,
        type,
        amount,
        description,
        category,
        reference_id,
        reference_type,
        correction_group_id,
        reference_payment_id,
        created_at
      )
      VALUES ($1, $2, 'credit', $3, $4, 'Service Payment', $5, 'payment', $6, $7, NOW())
      `,
      [
        wallet_id,
        req.user.id,
        amount,
        `Pending payment collected for service #${serviceEntryId}`,
        serviceEntryId,
        groupId,
        paymentId
      ]
    );

    await client.query("COMMIT");

    res.json({
      success: true,
      message: "Pending payment collected successfully"
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Receive payment error:", err);
    res.status(500).json({
      error: err.message || "Failed to receive payment"
    });
  } finally {
    client.release();
  }
});

// GET /api/servicemanagement/pending-payments/history
router.get("/pending-payments/history", authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    const { role, id: userId, centre_id: userCentreId } = req.user;
    const { centreId: queryCentreId, from, to } = req.query;

    let CentreId;

    if (role === "superadmin") {
      if (!queryCentreId) {
        return res.status(400).json({ error: "centreId is required for superadmin" });
      }
      CentreId = Number(queryCentreId);
    } else if (role === "admin") {
      CentreId = userCentreId;
    } else {
      CentreId = null;
    }

    let conditions = [];
    let values = [];
    let idx = 1;

    if (role === "staff") {
      conditions.push(`se.staff_id = $${idx++}`);
      values.push(userId);
    }

    if (role === "admin" || role === "superadmin") {
      conditions.push(`st.centre_id = $${idx++}`);
      values.push(CentreId);
    }

    if (from) {
      conditions.push(`se.created_at::date >= $${idx++}`);
      values.push(from);
    }

    if (to) {
      conditions.push(`se.created_at::date <= $${idx++}`);
      values.push(to);
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const query = `
      SELECT
        se.id AS service_entry_id,
        se.customer_name,
        se.phone AS customer_phone,
        se.total_charges,
        se.created_at,
        se.updated_at,
        s.name AS service_name,
        sc.name AS subcategory_name,

        COALESCE(
          SUM(CASE WHEN p.status = 'received' THEN p.amount ELSE 0 END),
          0
        ) AS paid_amount,

        se.total_charges -
        COALESCE(
          SUM(CASE WHEN p.status = 'received' THEN p.amount ELSE 0 END),
          0
        ) AS pending_amount,

        COUNT(p.id) AS payment_count,

        COALESCE(
          json_agg(
            json_build_object(
              'id', p.id,
              'wallet_name', w.name,
              'amount', p.amount,
              'status', p.status,
              'created_at', p.created_at
            )
            ORDER BY p.created_at NULLS LAST
          ) FILTER (WHERE p.id IS NOT NULL),
          '[]'
        ) AS payment_history

      FROM service_entries se
      JOIN staff st ON st.id = se.staff_id
      LEFT JOIN services s ON s.id = se.category_id
      LEFT JOIN subcategories sc ON sc.id = se.subcategory_id

      LEFT JOIN payments p 
        ON p.service_entry_id = se.id
        AND p.is_reversal = FALSE

      LEFT JOIN wallets w 
        ON w.id = p.wallet_id

      ${whereClause}

      GROUP BY
        se.id,
        se.customer_name,
        se.phone,
        se.total_charges,
        se.created_at,
        se.updated_at,
        s.name,
        sc.name

      HAVING
        -- fully paid
        se.total_charges <= COALESCE(
          SUM(CASE WHEN p.status = 'received' THEN p.amount ELSE 0 END),
          0
        )
        -- AND had multiple payments (was pending before)
        AND COUNT(p.id) > 1

      ORDER BY se.updated_at DESC
    `;

    const { rows } = await client.query(query, values);
    res.json(rows);

  } catch (err) {
    console.error("❌ Pending payments history error:", err);
    res.status(500).json({
      error: err.message || "Failed to fetch pending payments history"
    });
  } finally {
    client.release();
  }
});

// ========== CUSTOMER ONLINE WORK BOOKING ==========

// GET /api/servicemanagement/customer-services/:id
router.get('/customer-services/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT cs.*, 
              c.name AS customer_name, 
              c.primary_phone AS phone,
              c.email AS email
       FROM customer_services cs
       JOIN customers c ON cs.customer_id = c.id
       WHERE cs.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer service not found' });
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error('Error fetching customer service:', err);
    res.status(500).json({ error: 'Failed to fetch customer service' });
  }
});

// GET /api/servicemanagement/customer-services
router.get('/customer-services', authenticateToken, async (req, res) => {
  const { status, staff_id } = req.query;

  try {
    let query = `
      SELECT cs.*, 
             c.name AS customer_name, 
             c.primary_phone AS phone,
             c.email AS email
      FROM customer_services cs
      JOIN customers c ON cs.customer_id = c.id
      WHERE 1=1
    `;

    const values = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND cs.status = $${paramIndex++}`;
      values.push(status);
    }

    if (staff_id) {
      query += ` AND cs.assigned_staff_id = $${paramIndex++}`;
      values.push(staff_id);
    }

    query += ` ORDER BY cs.applied_at DESC`;

    const result = await pool.query(query, values);
    res.json(result.rows);

  } catch (err) {
    console.error('Error fetching customer services:', err);
    res.status(500).json({ error: 'Failed to fetch customer services' });
  }
});

// PUT /api/servicemanagement/customer-services/:id/take
router.put('/customer-services/:id/take', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE customer_services
       SET status = 'processing',
           assigned_staff_id = $1,
           taken_at = NOW()
       WHERE id = $2
       AND status = 'under_review'
       AND assigned_staff_id IS NULL
       RETURNING *`,
      [req.user.id, id]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Already taken by another staff' });
    }

    await client.query('COMMIT');

    res.json({ message: 'Work assigned successfully', data: result.rows[0] });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error taking customer service:', err);
    res.status(500).json({ error: 'Failed to take work' });
  } finally {
    client.release();
  }
});

export default router;
