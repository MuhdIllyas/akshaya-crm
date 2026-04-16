import express from 'express';
import pool from '../db.js';
import jwt from 'jsonwebtoken';
import { io } from '../server.js';
import axios from 'axios';
import { logActivity } from "../utils/activityLogger.js"; // Add this import

import { createReviewRequest } from './reviews.js';

const router = express.Router();

// Libromi configuration
const LIBROMI_ACCESS_TOKEN = process.env.LIBROMI_ACCESS_TOKEN;
const LIBROMI_PHONE_NUMBER = process.env.LIBROMI_PHONE_NUMBER;
const LIBROMI_BASE_URL = process.env.LIBROMI_BASE_URL || 'https://wa-api.cloud/api/v1';
const CENTRE_PHONE = process.env.CENTRE_PHONE || '+919961900071';
const TEMPLATE_NAME = 'akshaya';

// Helper to send WhatsApp notification via Libromi API
const sendStatusNotification = async (serviceEntryId, status, currentStep, notes) => {
  if (!LIBROMI_ACCESS_TOKEN || !LIBROMI_PHONE_NUMBER) {
    console.warn('servicetracking.js: Libromi credentials not configured. Skipping WhatsApp notification.');
    return { success: false, error: 'Libromi credentials missing' };
  }

  const client = await pool.connect();
  try {
    // Fetch service entry details
    const serviceEntryResult = await client.query(
      `SELECT se.customer_name, se.phone, se.created_at, se.token_id, se.category_id, se.subcategory_id, se.staff_id, se.customer_service_id,
              s.name AS service_name, sub.name AS subcategory_name, st.name AS staff_name
       FROM service_entries se
       LEFT JOIN services s ON se.category_id = s.id
       LEFT JOIN subcategories sub ON se.subcategory_id = sub.id
       LEFT JOIN staff st ON se.staff_id = st.id
       WHERE se.id = $1`,
      [serviceEntryId]
    );

    if (serviceEntryResult.rows.length === 0) {
      console.warn(`servicetracking.js: Service entry ${serviceEntryId} not found for notification.`);
      return { success: false, error: 'Service entry not found' };
    }

    const entry = serviceEntryResult.rows[0];

    // Fetch application_number from service_tracking
    const trackingResult = await client.query(
      `SELECT application_number FROM service_tracking WHERE service_entry_id = $1 LIMIT 1`,
      [serviceEntryId]
    );

    const formattedPhone = entry.phone.startsWith('+91') ? entry.phone : `+91${entry.phone.replace(/^\+91/, '')}`;
    const submissionDate = entry.created_at ? new Date(entry.created_at).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN');

    // Determine application number
    let appNum;
    if (trackingResult.rows.length > 0 && trackingResult.rows[0].application_number) {
      appNum = trackingResult.rows[0].application_number;
    } else if (entry.token_id) {
      appNum = `T${entry.token_id}`;
    } else {
      appNum = `APP${serviceEntryId}`;
    }

    // Calculate estimated delivery date
    const stepsResult = await client.query(
      `SELECT SUM(estimated_days) AS total_estimated_days
       FROM service_tracking_steps sts
       JOIN service_tracking st ON sts.service_tracking_id = st.id
       WHERE st.service_entry_id = $1 AND sts.completed = false`,
      [serviceEntryId]
    );
    const totalEstimatedDays = parseInt(stepsResult.rows[0].total_estimated_days) || 0;
    const estimatedDeliveryDate = new Date(entry.created_at || new Date());
    estimatedDeliveryDate.setDate(estimatedDeliveryDate.getDate() + totalEstimatedDays);
    const deliDate = estimatedDeliveryDate.toLocaleDateString('en-IN');

    // Format status for display - this is the key change!
    // Convert backend status (pending, in_progress, etc.) to display format (Pending, In Progress, etc.)
    let displayStatus = 'Submitted';
    if (status) {
      // Handle different status formats
      if (status === 'pending') displayStatus = 'Pending';
      else if (status === 'in_progress') displayStatus = 'In Progress';
      else if (status === 'completed') displayStatus = 'Completed';
      else if (status === 'rejected') displayStatus = 'Delayed';
      else if (status === 'resubmit') displayStatus = 'Resubmit';
      else if (status === 'paid') displayStatus = 'Paid';
      else displayStatus = status; // fallback
    }

    const templateParams = [
      entry.customer_name || 'Customer',
      appNum,
      submissionDate,
      entry.service_name || 'Service',
      entry.subcategory_name || 'N/A',
      displayStatus, // Use the formatted status, NOT currentStep
      deliDate,
      entry.staff_name || 'Staff',
      notes || 'No additional notes'
    ];

    const response = await axios.post(
      `${LIBROMI_BASE_URL}/messages`,
      {
        to: formattedPhone,
        type: 'template',
        template: {
          name: TEMPLATE_NAME,
          language: { code: 'en', policy: 'deterministic' },
          components: [
            {
              type: 'body',
              parameters: templateParams.map(param => ({ type: 'text', text: param.toString() }))
            }
          ]
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${LIBROMI_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    await client.query(
      `INSERT INTO audit_logs (action, performed_by, details, centre_id, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [
        'WhatsApp Notification Sent',
        'system',
        `Sent status notification to ${formattedPhone} for service entry ${serviceEntryId}: ${displayStatus} with application number ${appNum}`,
        entry.centre_id || null
      ]
    );

    console.log(`servicetracking.js: WhatsApp notification sent to ${formattedPhone} for service ${serviceEntryId} with status ${displayStatus} and application number ${appNum}:`, response.data);
    return { success: true, data: response.data };
  } catch (err) {
    await client.query(
      `INSERT INTO audit_logs (action, performed_by, details, centre_id, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [
        'WhatsApp Notification Failed',
        'system',
        `Failed to send notification for service entry ${serviceEntryId}: ${err.response?.data?.error || err.message}`,
        null
      ]
    );

    console.error(`servicetracking.js: Failed to send WhatsApp notification for service ${serviceEntryId}:`, err.response?.data || err.message);
    return { success: false, error: err.response?.data?.error || err.message };
  } finally {
    client.release();
  }
};

// Middleware to verify token and role
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    console.log('servicetracking.js: No token provided');
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.error('servicetracking.js: Token verification error:', err.message);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Helper function to initialize default steps
const initializeDefaultSteps = async (client, serviceTrackingId, createdAt) => {
  const defaultSteps = [
    { name: 'Submitted', completed: true, step_order: 1, estimated_days: 1, date: createdAt || new Date() },
    { name: 'Initial Review', completed: false, step_order: 2, estimated_days: 3, date: null },
    { name: 'Document Verification', completed: false, step_order: 3, estimated_days: 5, date: null },
    { name: 'Final Approval', completed: false, step_order: 4, estimated_days: 2, date: null }
  ];

  const stepsData = [];
  for (const step of defaultSteps) {
    const stepResult = await client.query(
      `INSERT INTO service_tracking_steps (
        service_tracking_id, name, completed, date, created_at, step_order, estimated_days
      ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5, $6)
      ON CONFLICT (service_tracking_id, name) DO NOTHING
      RETURNING id, name, completed, date, created_at, step_order, estimated_days`,
      [serviceTrackingId, step.name, step.completed, step.date, step.step_order, step.estimated_days]
    );
    if (stepResult.rows.length > 0) {
      stepsData.push({
        id: stepResult.rows[0].id,
        name: stepResult.rows[0].name,
        completed: stepResult.rows[0].completed,
        date: stepResult.rows[0].date ? stepResult.rows[0].date.toISOString() : null,
        created_at: stepResult.rows[0].created_at ? stepResult.rows[0].created_at.toISOString() : null,
        step_order: stepResult.rows[0].step_order,
        estimated_days: stepResult.rows[0].estimated_days
      });
    }
  }
  return stepsData;
};

// Helper function to fetch tracking entries
const fetchTrackingEntries = async (client, req, query, values) => {
  const result = await client.query(query, values);
  const entries = [];

  for (const entry of result.rows) {
    let stepsResult = await client.query(
      `SELECT id, name, completed, date, created_at, step_order, estimated_days
       FROM service_tracking_steps
       WHERE service_tracking_id = $1
       ORDER BY step_order, created_at`,
      [entry.id]
    );
    let steps = stepsResult.rows.map(step => ({
      id: step.id,
      name: step.name,
      completed: step.completed,
      date: step.date ? step.date.toISOString() : null,
      created_at: step.created_at ? step.created_at.toISOString() : null,
      step_order: step.step_order,
      estimated_days: step.estimated_days
    }));

    if (steps.length === 0) {
      steps = await initializeDefaultSteps(client, entry.id, entry.created_at);
    }

    const serviceEntryResult = await client.query(
      `SELECT expiry_date, customer_service_id FROM service_entries WHERE id = $1`,
      [entry.service_entry_id]
    );
    const expiryDate = serviceEntryResult.rows[0]?.expiry_date
      ? serviceEntryResult.rows[0].expiry_date.toISOString()
      : null;
    const customerServiceId = serviceEntryResult.rows[0]?.customer_service_id;

    entries.push({
      id: entry.id,
      service_entry_id: entry.service_entry_id,
      customer_service_id: customerServiceId,
      application_number: entry.application_number,
      customer_name: entry.customer_name,
      phone: entry.phone,
      service_name: entry.service_name,
      subcategory_name: entry.subcategory_name,
      category_id: entry.category_id,
      subcategory_id: entry.subcategory_id,
      service_charges: parseFloat(entry.service_charges),
      department_charges: parseFloat(entry.department_charges),
      total_charges: parseFloat(entry.total_charges),
      assigned_to: entry.assigned_to,
      assigned_to_name: entry.assigned_to_name,
      status: entry.status,
      current_step: entry.current_step,
      estimated_delivery: entry.estimated_delivery ? entry.estimated_delivery.toISOString() : null,
      average_time: entry.average_time,
      notes: entry.notes,
      progress: entry.progress,
      aadhaar: entry.aadhaar,
      email: entry.email,
      priority: entry.priority || 'medium',
      expiry_date: expiryDate,
      steps,
      updated_at: entry.updated_at ? entry.updated_at.toISOString() : null
    });
  }

  return entries;
};

// ============================================
// ROUTES - Ordered from most specific to least specific
// ============================================

/**
 * GET /api/servicetracking/customer/history
 * Get all service tracking entries for a customer by aadhaar/email/phone
 */
router.get('/customer/history', authenticateToken, async (req, res) => {
  const { aadhaar, email, phone } = req.query;
  const client = await pool.connect();
  
  try {
    if (!aadhaar && !email && !phone) {
      return res.status(400).json({ 
        error: 'At least one identifier (aadhaar, email, or phone) is required' 
      });
    }
    
    // First, find customers matching the criteria
    let customerIds = [];
    
    if (aadhaar) {
      // Find customers with this aadhaar number in their documents
      const aadhaarResult = await client.query(
        `SELECT DISTINCT customer_id 
         FROM customer_documents 
         WHERE document_name ILIKE '%aadhaar%' AND document_number = $1`,
        [aadhaar]
      );
      customerIds.push(...aadhaarResult.rows.map(r => r.customer_id));
    }
    
    if (email) {
      const emailResult = await client.query(
        `SELECT id FROM customers WHERE email = $1`,
        [email]
      );
      customerIds.push(...emailResult.rows.map(r => r.id));
    }
    
    if (phone) {
      const phoneResult = await client.query(
        `SELECT id FROM customers WHERE primary_phone = $1`,
        [phone]
      );
      customerIds.push(...phoneResult.rows.map(r => r.id));
    }
    
    // Remove duplicates
    customerIds = [...new Set(customerIds)];
    
    let query = `
      SELECT 
        st.id,
        st.application_number,
        st.status,
        st.current_step,
        st.progress,
        st.estimated_delivery,
        st.updated_at,
        st.aadhaar,
        st.email,
        se.phone,
        se.customer_name,
        se.created_at AS submission_date,
        s.name AS service_name,
        sc.name AS subcategory_name,
        se.total_charges,
        se.customer_service_id,
        CASE 
          WHEN se.customer_service_id IS NOT NULL THEN 'online'
          ELSE 'offline'
        END AS source
      FROM service_tracking st
      JOIN service_entries se ON st.service_entry_id = se.id
      JOIN services s ON se.category_id = s.id
      JOIN subcategories sc ON se.subcategory_id = sc.id
      WHERE 1=1
    `;
    
    const values = [];
    let paramIndex = 1;
    
    if (aadhaar) {
      query += ` AND st.aadhaar = $${paramIndex++}`;
      values.push(aadhaar);
    }
    
    if (email) {
      query += ` AND st.email = $${paramIndex++}`;
      values.push(email);
    }
    
    if (phone) {
      query += ` AND se.phone = $${paramIndex++}`;
      values.push(phone);
    }
    
    query += ` ORDER BY st.updated_at DESC`;
    
    const result = await client.query(query, values);
    
    // Also fetch from customer_services for online bookings
    if (customerIds.length > 0) {
      let customerQuery = `
        SELECT cs.*, c.name AS customer_name,
               (SELECT document_number FROM customer_documents 
                WHERE customer_id = c.id AND document_name ILIKE '%aadhaar%' 
                LIMIT 1) AS aadhaar_number
        FROM customer_services cs
        JOIN customers c ON cs.customer_id = c.id
        WHERE cs.customer_id = ANY($1::int[])
      `;
      const customerValues = [customerIds];
      
      if (email) {
        customerQuery += ` AND c.email = $2`;
        customerValues.push(email);
      }
      
      if (phone) {
        customerQuery += ` AND c.primary_phone = $${customerValues.length + 1}`;
        customerValues.push(phone);
      }
      
      const customerResult = await client.query(customerQuery, customerValues);
      
      // Filter out online bookings that are already in processed results
      const onlineBookings = customerResult.rows.filter(cs => 
        !result.rows.some(st => st.customer_service_id === cs.id)
      );
      
      res.json({
        processed: result.rows,
        pending: onlineBookings.map(cs => ({
          id: cs.id,
          application_number: cs.application_number,
          status: cs.status,
          service_name: cs.service_data?.service_name,
          submission_date: cs.applied_at,
          estimated_completion: cs.estimated_completion,
          source: 'online',
          is_processed: false,
          aadhaar: cs.aadhaar_number
        }))
      });
    } else {
      res.json({
        processed: result.rows,
        pending: []
      });
    }
    
  } catch (err) {
    console.error('Error fetching customer history:', err);
    res.status(500).json({ error: 'Failed to fetch customer history' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/servicetracking/sync-customer-services
 * Sync existing service_tracking records with customer_services
 */
router.post('/sync-customer-services', authenticateToken, async (req, res) => {
  // Only superadmin can run this
  if (req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Only superadmin can run sync' });
  }
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Get all service_tracking entries that have aadhaar/email but no customer_service_id
    const result = await client.query(`
      SELECT st.id, st.service_entry_id, st.aadhaar, st.email, se.phone,
             se.customer_service_id
      FROM service_tracking st
      JOIN service_entries se ON st.service_entry_id = se.id
      WHERE se.customer_service_id IS NULL
        AND (st.aadhaar IS NOT NULL OR st.email IS NOT NULL OR se.phone IS NOT NULL)
    `);
    
    let synced = 0;
    let errors = [];
    
    for (const tracking of result.rows) {
      try {
        // Try to find matching customer by aadhaar/email/phone
        let customerIds = [];
        
        if (tracking.aadhaar) {
          const aadhaarResult = await client.query(
            `SELECT DISTINCT customer_id 
             FROM customer_documents 
             WHERE document_name ILIKE '%aadhaar%' AND document_number = $1`,
            [tracking.aadhaar]
          );
          customerIds.push(...aadhaarResult.rows.map(r => r.customer_id));
        }
        
        if (tracking.email) {
          const emailResult = await client.query(
            `SELECT id FROM customers WHERE email = $1`,
            [tracking.email]
          );
          customerIds.push(...emailResult.rows.map(r => r.id));
        }
        
        if (tracking.phone) {
          const phoneResult = await client.query(
            `SELECT id FROM customers WHERE primary_phone = $1`,
            [tracking.phone]
          );
          customerIds.push(...phoneResult.rows.map(r => r.id));
        }
        
        // Remove duplicates
        customerIds = [...new Set(customerIds)];
        
        if (customerIds.length > 0) {
          // Use the first matching customer
          const customerId = customerIds[0];
          
          // Get the most recent customer_service for this customer
          const csResult = await client.query(
            `SELECT id FROM customer_services 
             WHERE customer_id = $1 
             ORDER BY applied_at DESC LIMIT 1`,
            [customerId]
          );
          
          if (csResult.rows.length > 0) {
            const foundCustomerServiceId = csResult.rows[0].id;
            
            // Update service_entries
            await client.query(
              `UPDATE service_entries
               SET customer_service_id = $1
               WHERE id = $2`,
              [foundCustomerServiceId, tracking.service_entry_id]
            );
            
            // Also sync the tracking data
            const trackingData = await client.query(
              'SELECT * FROM service_tracking WHERE id = $1',
              [tracking.id]
            );
            
            if (trackingData.rows.length > 0) {
              await syncWithCustomerServices(client, trackingData.rows[0], foundCustomerServiceId);
            }
            
            synced++;
          }
        }
      } catch (err) {
        errors.push({ tracking_id: tracking.id, error: err.message });
      }
    }
    
    await client.query('COMMIT');
    
    res.json({
      message: 'Sync completed',
      synced_count: synced,
      errors: errors
    });
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error syncing customer services:', err);
    res.status(500).json({ error: 'Failed to sync customer services' });
  } finally {
    client.release();
  }
});

/**
 * GET /api/servicetracking/entries - Get service tracking entries with filters
 */
router.get('/entries', authenticateToken, async (req, res) => {
  const { centre_id, status, priority, start_date, end_date } = req.query;
  const client = await pool.connect();

  try {
    const queryConditions = [];
    const queryValues = [];

    // 🔐 Centre Filtering
    if (req.user.role !== 'superadmin') {
      queryConditions.push(`se_staff.centre_id = $${queryValues.length + 1}`);
      queryValues.push(req.user.centre_id);
    } else if (centre_id && centre_id !== 'all') {
      queryConditions.push(`se_staff.centre_id = $${queryValues.length + 1}`);
      queryValues.push(parseInt(centre_id));
    }

    // 📌 Status Filter
    if (status && status !== 'all') {
      queryConditions.push(`st.status = $${queryValues.length + 1}`);
      queryValues.push(status);
    }

    // 📌 Priority Filter
    if (priority && priority !== 'all') {
      queryConditions.push(`st.priority = $${queryValues.length + 1}`);
      queryValues.push(priority);
    }

    // 📅 Date Filters
    if (start_date) {
      queryConditions.push(`st.updated_at >= $${queryValues.length + 1}`);
      queryValues.push(start_date);
    }

    if (end_date) {
      queryConditions.push(`st.updated_at <= $${queryValues.length + 1}`);
      queryValues.push(end_date);
    }

    const query = `
      SELECT 
        st.*,

        -- Service Entry Data
        se.customer_name,
        se.phone,
        se.service_charges,
        se.department_charges,
        se.total_charges,
        se.expiry_date,
        se.category_id,
        se.subcategory_id,
        se.customer_service_id,
        se.work_source,  -- 🔥 Online / Offline

        -- Service Info
        s.name AS service_name,
        sub.name AS subcategory_name,

        -- Assigned Staff
        st2.name AS assigned_to_name,
        se_staff.centre_id,

        -- 🔥 Review Info (Only Submitted Reviews)
        sr.service_rating,
        sr.staff_rating,
        sr.review_text,
        sr.submitted_at,

        -- Steps
        COALESCE((
          SELECT json_agg(
            json_build_object(
              'id', sts.id,
              'name', sts.name,
              'completed', sts.completed,
              'date', sts.date,
              'created_at', sts.created_at,
              'step_order', sts.step_order,
              'estimated_days', sts.estimated_days
            )
          )
          FROM service_tracking_steps sts
          WHERE sts.service_tracking_id = st.id
        ), '[]'::json) AS steps

      FROM service_tracking st

      LEFT JOIN service_entries se 
        ON st.service_entry_id = se.id

      LEFT JOIN services s 
        ON se.category_id = s.id

      LEFT JOIN subcategories sub 
        ON se.subcategory_id = sub.id

      LEFT JOIN staff st2 
        ON st.assigned_to = st2.id

      LEFT JOIN staff se_staff 
        ON se.staff_id = se_staff.id

      -- 🔥 Join Review Table
      LEFT JOIN service_reviews sr 
        ON (
            sr.tracking_id = st.id
            OR sr.booking_id = se.customer_service_id
          )
        AND sr.is_submitted = true

      ${queryConditions.length > 0 ? 'WHERE ' + queryConditions.join(' AND ') : ''}

      ORDER BY st.updated_at DESC
    `;

    const result = await client.query(query, queryValues);

    console.log(
      'servicetracking.js: Fetched service tracking entries:',
      JSON.stringify(result.rows, null, 2)
    );

    res.json(result.rows);

  } catch (err) {
    console.error('servicetracking.js: Error fetching service tracking entries:', err);
    res.status(500).json({ error: 'Failed to fetch service tracking entries: ' + err.message });
  } finally {
    client.release();
  }
});

/**
 * GET /api/servicetracking/entries/:id/update-status - Update only status
 * Note: This is a PUT route, but we're listing it here for order reference
 */
// This is handled below in the PUT section

/**
 * POST /api/servicetracking/entries/:id/notify - Send notification
 */
router.post('/entries/:id/notify', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { message } = req.body;

  console.log('servicetracking.js: Received notify payload:', JSON.stringify({ id, message }, null, 2));

  const client = await pool.connect();
  try {
    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({ error: 'message is required and must be a non-empty string' });
    }

    await client.query('BEGIN');

    const entryResult = await client.query(
      'SELECT application_number, service_entry_id, status, current_step, notes, aadhaar, email, priority FROM service_tracking WHERE id = $1',
      [parseInt(id)]
    );
    if (entryResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Service tracking entry ID ${id} not found` });
    }
    const entry = entryResult.rows[0];

    const serviceEntry = await client.query(
      'SELECT staff_id, customer_name, phone, expiry_date, customer_service_id FROM service_entries WHERE id = $1',
      [entry.service_entry_id]
    );
    if (serviceEntry.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Service Entry ID ${entry.service_entry_id} not found` });
    }
    const entryStaffResult = await client.query('SELECT centre_id FROM staff WHERE id = $1', [serviceEntry.rows[0].staff_id]);
    if (entryStaffResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Staff ID ${serviceEntry.rows[0].staff_id} not found for service entry` });
    }
    const centreId = entryStaffResult.rows[0].centre_id;

    if (req.user.role === 'staff') {
      const assignedCheck = await client.query(
        'SELECT id FROM service_tracking WHERE id = $1 AND assigned_to = $2',
        [parseInt(id), parseInt(req.user.id)]
      );
      if (assignedCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Unauthorized: You can only notify for entries assigned to you' });
      }
    } else if (req.user.role === 'supervisor') {
      const supervisorCheck = await client.query(
        'SELECT se_staff.reports_to FROM service_entries se JOIN staff se_staff ON se.staff_id = se_staff.id WHERE se.id = $1',
        [entry.service_entry_id]
      );
      if (supervisorCheck.rows.length === 0 || supervisorCheck.rows[0].reports_to !== parseInt(req.user.id)) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Unauthorized: You can only notify for entries of staff reporting to you' });
      }
    } else if (req.user.role === 'admin' && centreId !== parseInt(req.user.centre_id)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Unauthorized: You can only notify for entries in your centre' });
    }

    // Send notification with the status (not current_step)
    await sendStatusNotification(entry.service_entry_id, entry.status, entry.current_step, message);

    await client.query(
      `INSERT INTO audit_logs (action, performed_by, details, centre_id, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [
        'Service Tracking Notification',
        req.user.username,
        `Sent notification for service tracking entry ${entry.application_number || 'N/A'}: ${message}`,
        centreId
      ]
    );

    io.to(`centre_${centreId}`).emit('serviceTrackingNotification', {
      application_number: entry.application_number,
      aadhaar: entry.aadhaar,
      email: entry.email,
      priority: entry.priority,
      message: `Notification sent to ${serviceEntry.rows[0].customer_name} for ${entry.application_number || 'N/A'}`
    });

    await client.query('COMMIT');

    res.json({ message: `Notification sent to ${serviceEntry.rows[0].customer_name} successfully` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('servicetracking.js: Error sending notification:', err);
    res.status(500).json({ error: 'Failed to send notification: ' + err.message });
  } finally {
    client.release();
  }
});

/**
 * GET /api/servicetracking/:id
 * Get a single service tracking entry by ID
 */
router.get('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  
  try {
    console.log('servicetracking.js: Fetching single tracking entry with ID:', id);
    
    // First, get the tracking entry with review data
    const trackingQuery = `
      SELECT 
        st.id, 
        st.service_entry_id,
        st.application_number,
        st.assigned_to, 
        st.status, 
        st.current_step,
        st.estimated_delivery,
        st.average_time,
        st.notes,
        st.progress,
        st.aadhaar,
        st.email,
        st.priority,
        st.updated_at,
        
        -- Review Info (Only Submitted Reviews)
        sr.service_rating,
        sr.staff_rating,
        sr.review_text,
        sr.submitted_at
      FROM service_tracking st
      LEFT JOIN service_reviews sr 
        ON (
            sr.tracking_id = st.id
            OR sr.booking_id = (SELECT customer_service_id FROM service_entries WHERE id = st.service_entry_id)
          )
        AND sr.is_submitted = true
      WHERE st.id = $1
    `;
    
    const trackingResult = await client.query(trackingQuery, [parseInt(id)]);
    
    if (trackingResult.rows.length === 0) {
      return res.status(404).json({ error: `Service tracking entry with ID ${id} not found` });
    }
    
    const tracking = trackingResult.rows[0];
    
    // Get the associated service entry details
    const serviceEntryQuery = `
      SELECT 
        se.id,
        se.customer_name, 
        se.phone, 
        se.category_id,
        se.subcategory_id,
        se.service_charges,
        se.department_charges,
        se.total_charges,
        se.token_id,
        se.expiry_date,
        se.created_at,
        se.customer_service_id,
        se.work_source,
        s.name AS service_name,
        sc.name AS subcategory_name,
        staff.name AS staff_name,
        staff.centre_id
      FROM service_entries se
      LEFT JOIN services s ON se.category_id = s.id
      LEFT JOIN subcategories sc ON se.subcategory_id = sc.id
      LEFT JOIN staff ON se.staff_id = staff.id
      WHERE se.id = $1
    `;
    
    const serviceEntryResult = await client.query(serviceEntryQuery, [tracking.service_entry_id]);
    
    if (serviceEntryResult.rows.length === 0) {
      return res.status(404).json({ error: `Service entry for tracking ID ${id} not found` });
    }
    
    const serviceEntry = serviceEntryResult.rows[0];
    
    // Get assigned staff name
    let assignedToName = null;
    if (tracking.assigned_to) {
      const staffResult = await client.query(
        'SELECT name FROM staff WHERE id = $1',
        [tracking.assigned_to]
      );
      assignedToName = staffResult.rows[0]?.name || null;
    }
    
    // Get steps
    const stepsResult = await client.query(
      `SELECT id, name, completed, date, created_at, step_order, estimated_days
       FROM service_tracking_steps
       WHERE service_tracking_id = $1
       ORDER BY step_order, created_at`,
      [tracking.id]
    );
    
    const steps = stepsResult.rows.map(step => ({
      id: step.id,
      name: step.name,
      completed: step.completed,
      date: step.date ? step.date.toISOString() : null,
      created_at: step.created_at ? step.created_at.toISOString() : null,
      step_order: step.step_order,
      estimated_days: step.estimated_days
    }));
    
    const response = {
      id: tracking.id,
      service_entry_id: tracking.service_entry_id,
      customer_service_id: serviceEntry.customer_service_id,
      application_number: tracking.application_number,
      customer_name: serviceEntry.customer_name,
      phone: serviceEntry.phone,
      service_name: serviceEntry.service_name,
      subcategory_name: serviceEntry.subcategory_name,
      category_id: serviceEntry.category_id,
      subcategory_id: serviceEntry.subcategory_id,
      service_charges: parseFloat(serviceEntry.service_charges),
      department_charges: parseFloat(serviceEntry.department_charges),
      total_charges: parseFloat(serviceEntry.total_charges),
      assigned_to: tracking.assigned_to,
      assigned_to_name: assignedToName,
      status: tracking.status,
      current_step: tracking.current_step,
      estimated_delivery: tracking.estimated_delivery ? tracking.estimated_delivery.toISOString() : null,
      average_time: tracking.average_time,
      notes: tracking.notes,
      progress: tracking.progress,
      aadhaar: tracking.aadhaar,
      email: tracking.email,
      priority: tracking.priority || 'medium',
      expiry_date: serviceEntry.expiry_date ? serviceEntry.expiry_date.toISOString() : null,
      steps: steps,
      updated_at: tracking.updated_at ? tracking.updated_at.toISOString() : null,
      created_at: serviceEntry.created_at ? serviceEntry.created_at.toISOString() : null,
      
      // Add work source
      work_source: serviceEntry.work_source || (serviceEntry.customer_service_id ? 'online' : 'offline'),
      
      // Add review data
      service_rating: tracking.service_rating,
      staff_rating: tracking.staff_rating,
      review_text: tracking.review_text,
      submitted_at: tracking.submitted_at
    };
    
    console.log('servicetracking.js: Fetched single tracking entry with reviews:', JSON.stringify(response, null, 2));
    res.json(response);
    
  } catch (err) {
    console.error('servicetracking.js: Error fetching single tracking entry:', err);
    res.status(500).json({ error: 'Failed to fetch tracking entry: ' + err.message });
  } finally {
    client.release();
  }
});

/**
 * POST /api/servicetracking - Create new service tracking entry
 */
router.post('/', authenticateToken, async (req, res) => {
  const {
    applicationNumber,
    serviceEntryId,
    assignedTo,
    status,
    currentStep,
    estimatedDelivery,
    averageTime,
    notes,
    aadhaar,
    email,
    priority
  } = req.body;

  console.log('servicetracking.js: Received POST payload:', JSON.stringify(req.body, null, 2));

  const client = await pool.connect();
  try {
    const errors = [];
    if (applicationNumber && typeof applicationNumber !== 'string') {
      errors.push('applicationNumber must be a string');
    }
    if (!serviceEntryId || isNaN(parseInt(serviceEntryId))) {
      errors.push('serviceEntryId is required and must be a valid integer');
    }
    if (!assignedTo || isNaN(parseInt(assignedTo))) {
      errors.push('assignedTo is required and must be a valid integer');
    }
    if (!status || !['pending', 'in_progress', 'completed', 'rejected', 'resubmit', 'paid'].includes(status)) {
      errors.push('status is required and must be one of: pending, in_progress, completed, rejected, resubmit, paid');
    }
    if (currentStep && !['Submitted', 'Initial Review', 'Document Verification', 'Final Approval'].includes(currentStep)) {
      errors.push('currentStep must be one of: Submitted, Initial Review, Document Verification, Final Approval');
    }
    if (estimatedDelivery && isNaN(Date.parse(estimatedDelivery))) {
      errors.push('estimatedDelivery must be a valid date');
    }
    if (aadhaar && !/^\d{12}$/.test(aadhaar)) {
      errors.push('aadhaar must be a 12-digit number');
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push('email must be a valid email address');
    }
    if (priority && !['low', 'medium', 'high'].includes(priority)) {
      errors.push('priority must be one of: low, medium, high');
    }

    if (errors.length > 0) {
      console.log('servicetracking.js: Validation errors:', errors);
      return res.status(400).json({ error: 'Missing or invalid fields', details: errors });
    }

    await client.query('BEGIN');

    const serviceEntryResult = await client.query(
      'SELECT id, customer_name, phone, category_id, subcategory_id, staff_id, service_charges, department_charges, total_charges, token_id, expiry_date, created_at, customer_service_id FROM service_entries WHERE id = $1',
      [parseInt(serviceEntryId)]
    );
    if (serviceEntryResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Service Entry ID ${serviceEntryId} not found` });
    }
    const serviceEntry = serviceEntryResult.rows[0];

    const serviceResult = await client.query('SELECT id FROM services WHERE id = $1', [serviceEntry.category_id]);
    if (serviceResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Service ID ${serviceEntry.category_id} not found` });
    }

    const subcategoryResult = await client.query(
      'SELECT id FROM subcategories WHERE id = $1 AND service_id = $2',
      [serviceEntry.subcategory_id, serviceEntry.category_id]
    );
    if (subcategoryResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Subcategory ID ${serviceEntry.subcategory_id} not found for service ID ${serviceEntry.category_id}` });
    }

    const staffResult = await client.query('SELECT id, centre_id, name FROM staff WHERE id = $1 AND status = $2', [parseInt(assignedTo), 'Active']);
    if (staffResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Staff ID ${assignedTo} not found or not active` });
    }
    const assignedStaffCentreId = staffResult.rows[0].centre_id;

    const entryStaffResult = await client.query('SELECT centre_id FROM staff WHERE id = $1', [serviceEntry.staff_id]);
    if (entryStaffResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Staff ID ${serviceEntry.staff_id} not found for service entry` });
    }
    const centreId = entryStaffResult.rows[0].centre_id;

    if (req.user.role !== 'superadmin') {
      if (!req.user.centre_id) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Centre ID required for non-superadmin users' });
      }
      if (assignedStaffCentreId !== parseInt(req.user.centre_id) || centreId !== parseInt(req.user.centre_id)) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: `Staff ID ${assignedTo} or Service Entry ID ${serviceEntryId} does not belong to your centre` });
      }
    }

    if (applicationNumber) {
      const existingEntry = await client.query(
        'SELECT id FROM service_tracking WHERE application_number = $1',
        [applicationNumber.trim()]
      );
      if (existingEntry.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Application number ${applicationNumber} already exists` });
      }
    }

    // Calculate progress based on current_step, not status
    const stepProgressMap = {
      'Submitted': 25,
      'Initial Review': 50,
      'Document Verification': 75,
      'Final Approval': 100
    };
    
    let progress = stepProgressMap[currentStep || 'Submitted'] || 25;
    
    // Override for completed/paid status
    if (status === 'completed' || status === 'paid') {
      progress = 100;
    }

    const result = await client.query(
      `INSERT INTO service_tracking (
        application_number, service_entry_id, assigned_to, status, current_step, 
        estimated_delivery, average_time, notes, progress, aadhaar, email, priority, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP)
      RETURNING *`,
      [
        applicationNumber ? applicationNumber.trim() : (serviceEntry.token_id ? `T${serviceEntry.token_id}` : `APP${serviceEntryId}`),
        parseInt(serviceEntryId),
        parseInt(assignedTo),
        status,
        currentStep || 'Submitted',
        estimatedDelivery || null,
        averageTime || null,
        notes || null,
        progress,
        aadhaar || null,
        email || null,
        priority || 'medium'
      ]
    );
    const newEntry = result.rows[0];

    const defaultSteps = [
      { name: 'Submitted', completed: true, step_order: 1, estimated_days: 1, date: serviceEntry.created_at || new Date() },
      { name: 'Initial Review', completed: status !== 'pending', step_order: 2, estimated_days: 3, date: status !== 'pending' ? new Date() : null },
      { name: 'Document Verification', completed: status === 'completed' || currentStep === 'Document Verification', step_order: 3, estimated_days: 5, date: (status === 'completed' || currentStep === 'Document Verification') ? new Date() : null },
      { name: 'Final Approval', completed: status === 'completed', step_order: 4, estimated_days: 2, date: status === 'completed' ? new Date() : null }
    ];

    const stepsData = [];
    for (const step of defaultSteps) {
      const stepResult = await client.query(
        `INSERT INTO service_tracking_steps (
          service_tracking_id, name, completed, date, created_at, step_order, estimated_days
        ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5, $6)
        RETURNING id, name, completed, date, created_at, step_order, estimated_days`,
        [newEntry.id, step.name, step.completed, step.date, step.step_order, step.estimated_days]
      );
      stepsData.push({
        id: stepResult.rows[0].id,
        name: stepResult.rows[0].name,
        completed: stepResult.rows[0].completed,
        date: stepResult.rows[0].date ? stepResult.rows[0].date.toISOString() : null,
        created_at: stepResult.rows[0].created_at ? stepResult.rows[0].created_at.toISOString() : null,
        step_order: stepResult.rows[0].step_order,
        estimated_days: stepResult.rows[0].estimated_days
      });
    }

    await client.query(
      `INSERT INTO audit_logs (action, performed_by, details, centre_id, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [
        'Service Tracking Created',
        req.user.username,
        `Created service tracking entry ${newEntry.application_number || 'N/A'} for service entry ${serviceEntryId} by ${req.user.role} with aadhaar ${aadhaar || 'N/A'}, priority ${priority || 'Medium'}`,
        centreId
      ]
    );

    // ========== ACTIVITY LOGGING ==========
    // Log task creation activity
    const serviceName = (await client.query('SELECT name FROM services WHERE id = $1', [serviceEntry.category_id])).rows[0].name;
    await logActivity({
      centre_id: centreId,
      related_type: 'service_tracking',
      related_id: newEntry.id,
      action: 'Task Created',
      description: `New task created for ${serviceEntry.customer_name} - ${serviceName} (Application: ${newEntry.application_number || 'N/A'})`,
      performed_by: req.user.id,
      performed_by_role: req.user.role
    });
    // ======================================

    // Send notification with status (not currentStep)
    await sendStatusNotification(serviceEntryId, status, currentStep || 'Submitted', notes);

    io.to(`centre_${centreId}`).emit('serviceTrackingUpdate', {
      application_number: newEntry.application_number,
      status: newEntry.status,
      aadhaar: newEntry.aadhaar,
      email: newEntry.email,
      priority: newEntry.priority,
      message: `New service tracking entry ${newEntry.application_number || 'N/A'} created`
    });

    // 🔄 Sync with customer_services if this service entry is linked to one
    if (serviceEntry.customer_service_id) {
      await syncWithCustomerServices(client, newEntry, serviceEntry.customer_service_id);
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Service tracking entry created successfully',
      entry: {
        id: newEntry.id,
        service_entry_id: newEntry.service_entry_id,
        customer_service_id: serviceEntry.customer_service_id,
        application_number: newEntry.application_number,
        customer_name: serviceEntry.customer_name,
        phone: serviceEntry.phone,
        service_name: (await client.query('SELECT name FROM services WHERE id = $1', [serviceEntry.category_id])).rows[0].name,
        subcategory_name: (await client.query('SELECT name FROM subcategories WHERE id = $1', [serviceEntry.subcategory_id])).rows[0].name,
        category_id: serviceEntry.category_id,
        subcategory_id: serviceEntry.subcategory_id,
        service_charges: parseFloat(serviceEntry.service_charges),
        department_charges: parseFloat(serviceEntry.department_charges),
        total_charges: parseFloat(serviceEntry.total_charges),
        assigned_to: newEntry.assigned_to,
        assigned_to_name: staffResult.rows[0].name,
        status: newEntry.status,
        current_step: newEntry.current_step,
        estimated_delivery: newEntry.estimated_delivery ? newEntry.estimated_delivery.toISOString() : null,
        average_time: newEntry.average_time,
        notes: newEntry.notes,
        progress: newEntry.progress,
        aadhaar: newEntry.aadhaar,
        email: newEntry.email,
        priority: newEntry.priority,
        expiry_date: serviceEntry.expiry_date ? serviceEntry.expiry_date.toISOString() : null,
        steps: stepsData,
        updated_at: newEntry.updated_at ? newEntry.updated_at.toISOString() : null
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('servicetracking.js: Error creating service tracking entry:', err);
    res.status(500).json({ error: 'Failed to create service tracking entry: ' + err.message });
  } finally {
    client.release();
  }
});

// Helper function to sync service_tracking with customer_services
const syncWithCustomerServices = async (client, trackingEntry, customerServiceId) => {
  if (!customerServiceId) return;

  console.log('servicetracking.js: Syncing tracking entry to customer_services:', {
    trackingId: trackingEntry.id,
    customerServiceId,
    applicationNumber: trackingEntry.application_number,
    status: trackingEntry.status,
    currentStep: trackingEntry.current_step,
    progress: trackingEntry.progress,
    estimatedDelivery: trackingEntry.estimated_delivery,
    assignedTo: trackingEntry.assigned_to
  });

  // First, get the current service_data to preserve existing structure
  const currentData = await client.query(
    'SELECT service_data FROM customer_services WHERE id = $1',
    [customerServiceId]
  );
  
  const currentServiceData = currentData.rows[0]?.service_data || {};
  
  // Determine payment status based on tracking status
  let paymentStatus = 'pending';
  if (trackingEntry.status === 'completed') {
    paymentStatus = 'completed';
  } else if (trackingEntry.status === 'paid') {
    paymentStatus = 'paid';
  } else {
    // Preserve existing payment status if available
    paymentStatus = currentServiceData.payment?.payment_status || 'pending';
  }

  // Get assigned staff name
  let assignedStaffName = null;
  if (trackingEntry.assigned_to) {
    const staffResult = await client.query(
      'SELECT name FROM staff WHERE id = $1',
      [trackingEntry.assigned_to]
    );
    assignedStaffName = staffResult.rows[0]?.name || null;
  }

  // Calculate progress based on current_step if not provided
  const stepProgressMap = {
    'Submitted': 25,
    'Initial Review': 50,
    'Document Verification': 75,
    'Final Approval': 100,
    'Documents Submitted': 40,
    'Under Review': 50,
    'In Progress': 60,
    'Completed': 100
  };
  
  // Use the progress from tracking entry, or calculate from current_step
  const progress = trackingEntry.progress || 
                   stepProgressMap[trackingEntry.current_step || 'Submitted'] || 
                   25;

  // Get estimated delivery as string in YYYY-MM-DD format
  let estimatedDeliveryStr = null;
  if (trackingEntry.estimated_delivery) {
    if (trackingEntry.estimated_delivery instanceof Date) {
      estimatedDeliveryStr = trackingEntry.estimated_delivery.toISOString().split('T')[0];
    } else {
      estimatedDeliveryStr = trackingEntry.estimated_delivery;
    }
  }

  // Update customer_services with tracking information
  await client.query(
    `UPDATE customer_services
     SET 
       status = $1,
       application_number = COALESCE($2, application_number),
       estimated_completion = $3,
       remarks = $4,
       last_updated = NOW(),
       service_data = jsonb_set(
         jsonb_set(
           jsonb_set(
             jsonb_set(
               COALESCE(service_data, '{}'::jsonb),
               '{tracking}',
               $5::jsonb
             ),
             '{payment,payment_status}',
             $6::jsonb
           ),
           '{assigned_staff}',
           $7::jsonb
         ),
         '{progress}',
         $8::jsonb
       )
     WHERE id = $9
     RETURNING *`,
    [
      trackingEntry.status,                          // $1 - text
      trackingEntry.application_number,              // $2 - text
      estimatedDeliveryStr,                          // $3 - text or null
      trackingEntry.notes || 'Status updated',       // $4 - text
      JSON.stringify({                                // $5 - jsonb
        current_step: trackingEntry.current_step,
        progress: progress,
        updated_at: new Date().toISOString(),
        assigned_staff_id: trackingEntry.assigned_to,
        assigned_staff_name: assignedStaffName,
        estimated_delivery: estimatedDeliveryStr,
        application_number: trackingEntry.application_number
      }),
      JSON.stringify(paymentStatus),                  // $6 - jsonb
      JSON.stringify({                                // $7 - jsonb
        id: trackingEntry.assigned_to,
        name: assignedStaffName
      }),
      JSON.stringify(progress),                       // $8 - jsonb
      customerServiceId                               // $9 - integer
    ]
  );

  console.log(`servicetracking.js: Synced customer_service ${customerServiceId} with progress ${progress}%`);

  // If we have aadhaar, update the customer_documents table
  if (trackingEntry.aadhaar) {
    // First get the customer_id
    const customerResult = await client.query(
      `SELECT customer_id FROM customer_services WHERE id = $1`,
      [customerServiceId]
    );
    
    if (customerResult.rows.length > 0) {
      const customerId = customerResult.rows[0].customer_id;
      
      // Check if Aadhaar document already exists for this customer
      const aadhaarDocResult = await client.query(
        `SELECT id FROM customer_documents 
         WHERE customer_id = $1 AND document_name ILIKE '%aadhaar%' AND is_latest = true`,
        [customerId]
      );
      
      if (aadhaarDocResult.rows.length > 0) {
        // Update existing Aadhaar document
        await client.query(
          `UPDATE customer_documents 
           SET document_number = $1, updated_at = NOW()
           WHERE id = $2`,
          [trackingEntry.aadhaar, aadhaarDocResult.rows[0].id]
        );
      } else {
        // Insert new Aadhaar document
        await client.query(
          `INSERT INTO customer_documents 
           (customer_id, document_name, document_number, status, is_latest, version, created_at, updated_at)
           VALUES ($1, $2, $3, 'approved', true, 1, NOW(), NOW())`,
          [customerId, 'Aadhaar Card', trackingEntry.aadhaar]
        );
      }
    }
  }

  // Update email in customers table if provided
  if (trackingEntry.email) {
    const customerResult = await client.query(
      `SELECT customer_id FROM customer_services WHERE id = $1`,
      [customerServiceId]
    );
    
    if (customerResult.rows.length > 0) {
      const customerId = customerResult.rows[0].customer_id;
      
      await client.query(
        `UPDATE customers
         SET email = COALESCE($1, email), updated_at = NOW()
         WHERE id = $2`,
        [trackingEntry.email, customerId]
      );
    }
  }

  // Update phone in customers table if provided
  if (trackingEntry.phone) {
    const customerResult = await client.query(
      `SELECT customer_id FROM customer_services WHERE id = $1`,
      [customerServiceId]
    );
    
    if (customerResult.rows.length > 0) {
      const customerId = customerResult.rows[0].customer_id;
      
      await client.query(
        `UPDATE customers
         SET primary_phone = COALESCE($1, primary_phone), updated_at = NOW()
         WHERE id = $2`,
        [trackingEntry.phone, customerId]
      );
    }
  }
};

/**
 * PUT /api/servicetracking/:id - Update service tracking entry
 */
router.put('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { applicationNumber, status, assignedTo, currentStep, estimatedDelivery, averageTime, notes, aadhaar, email, priority } = req.body;

  console.log('servicetracking.js: Received update payload:', JSON.stringify({ id, applicationNumber, status, assignedTo, currentStep, estimatedDelivery, averageTime, notes, aadhaar, email, priority }, null, 2));

  const client = await pool.connect();
  try {
    const errors = [];
    if (applicationNumber && typeof applicationNumber !== 'string') {
      errors.push('applicationNumber must be a string');
    }
    if (status && !['pending', 'in_progress', 'completed', 'rejected', 'resubmit', 'paid'].includes(status)) {
      errors.push('status must be one of: pending, in_progress, completed, rejected, resubmit, paid');
    }
    if (assignedTo && isNaN(parseInt(assignedTo))) {
      errors.push('assignedTo must be a valid integer');
    }
    if (currentStep && !['Submitted', 'Initial Review', 'Document Verification', 'Final Approval'].includes(currentStep)) {
      errors.push('currentStep must be one of: Submitted, Initial Review, Document Verification, Final Approval');
    }
    if (estimatedDelivery && isNaN(Date.parse(estimatedDelivery))) {
      errors.push('estimatedDelivery must be a valid date');
    }
    if (aadhaar && !/^\d{12}$/.test(aadhaar)) {
      errors.push('aadhaar must be a 12-digit number');
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push('email must be a valid email address');
    }
    if (priority && !['low', 'medium', 'high'].includes(priority)) {
      errors.push('priority must be one of: low, medium, high');
    }

    if (errors.length > 0) {
      console.log('servicetracking.js: Validation errors:', errors);
      return res.status(400).json({ error: 'Invalid fields', details: errors });
    }

    await client.query('BEGIN');

    const entryResult = await client.query(
      'SELECT application_number, service_entry_id, status, current_step, progress, aadhaar, email, priority FROM service_tracking WHERE id = $1',
      [parseInt(id)]
    );
    if (entryResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Service tracking entry ID ${id} not found` });
    }
    const existingEntry = entryResult.rows[0];

    const serviceEntry = await client.query(
      'SELECT staff_id, category_id, subcategory_id, customer_name, phone, service_charges, department_charges, total_charges, token_id, expiry_date, customer_service_id FROM service_entries WHERE id = $1',
      [existingEntry.service_entry_id]
    );
    if (serviceEntry.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Service Entry ID ${existingEntry.service_entry_id} not found` });
    }
    const entryStaffResult = await client.query('SELECT centre_id FROM staff WHERE id = $1', [serviceEntry.rows[0].staff_id]);
    if (entryStaffResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Staff ID ${serviceEntry.rows[0].staff_id} not found for service entry` });
    }
    const centreId = entryStaffResult.rows[0].centre_id;
    const customerServiceId = serviceEntry.rows[0].customer_service_id;

    if (req.user.role === 'staff') {
      const assignedCheck = await client.query(
        'SELECT id FROM service_tracking WHERE id = $1 AND assigned_to = $2',
        [parseInt(id), parseInt(req.user.id)]
      );
      if (assignedCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Unauthorized: You can only update entries assigned to you' });
      }
    } else if (req.user.role === 'supervisor') {
      const supervisorCheck = await client.query(
        'SELECT se_staff.reports_to FROM service_entries se JOIN staff se_staff ON se.staff_id = se_staff.id WHERE se.id = $1',
        [existingEntry.service_entry_id]
      );
      if (supervisorCheck.rows.length === 0 || supervisorCheck.rows[0].reports_to !== parseInt(req.user.id)) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Unauthorized: You can only update entries for staff reporting to you' });
      }
    } else if (req.user.role === 'admin' && centreId !== parseInt(req.user.centre_id)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Unauthorized: You can only update entries in your centre' });
    }

    let assignedToName = null;
    if (assignedTo) {
      const staffResult = await client.query('SELECT id, centre_id, name FROM staff WHERE id = $1 AND status = $2', [parseInt(assignedTo), 'Active']);
      if (staffResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Staff ID ${assignedTo} not found or not active` });
      }
      if (req.user.role !== 'superadmin' && staffResult.rows[0].centre_id !== parseInt(req.user.centre_id)) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: `Staff ID ${assignedTo} does not belong to your centre` });
      }
      assignedToName = staffResult.rows[0].name;
    }

    if (applicationNumber && applicationNumber !== existingEntry.application_number) {
      const existingEntryCheck = await client.query(
        'SELECT id FROM service_tracking WHERE application_number = $1 AND id != $2',
        [applicationNumber.trim(), parseInt(id)]
      );
      if (existingEntryCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Application number ${applicationNumber} already exists` });
      }
    }

    // Calculate progress based on current_step if provided, otherwise keep existing
    const stepProgressMap = {
      'Submitted': 25,
      'Initial Review': 50,
      'Document Verification': 75,
      'Final Approval': 100
    };
    
    let progress = existingEntry.progress;
    
    // If current_step is being updated, base progress on that
    if (currentStep !== undefined) {
      progress = stepProgressMap[currentStep] || 25;
    }
    
    // Override for completed/paid status
    if (status === 'completed' || status === 'paid') {
      progress = 100;
    }

    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    if (applicationNumber !== undefined) {
      updateFields.push(`application_number = $${paramIndex++}`);
      updateValues.push(applicationNumber ? applicationNumber.trim() : (serviceEntry.rows[0].token_id ? `T${serviceEntry.rows[0].token_id}` : `APP${existingEntry.service_entry_id}`));
    }
    if (status) {
      updateFields.push(`status = $${paramIndex++}`);
      updateValues.push(status);
    }
    if (assignedTo) {
      updateFields.push(`assigned_to = $${paramIndex++}`);
      updateValues.push(parseInt(assignedTo));
    }
    if (currentStep !== undefined) {
      updateFields.push(`current_step = $${paramIndex++}`);
      updateValues.push(currentStep || null);
    }
    if (estimatedDelivery !== undefined) {
      updateFields.push(`estimated_delivery = $${paramIndex++}`);
      updateValues.push(estimatedDelivery || null);
    }
    if (averageTime !== undefined) {
      updateFields.push(`average_time = $${paramIndex++}`);
      updateValues.push(averageTime || null);
    }
    if (notes !== undefined) {
      updateFields.push(`notes = $${paramIndex++}`);
      updateValues.push(notes || null);
    }
    if (aadhaar !== undefined) {
      updateFields.push(`aadhaar = $${paramIndex++}`);
      updateValues.push(aadhaar || null);
    }
    if (email !== undefined) {
      updateFields.push(`email = $${paramIndex++}`);
      updateValues.push(email || null);
    }
    if (priority !== undefined) {
      updateFields.push(`priority = $${paramIndex++}`);
      updateValues.push(priority || 'medium');
    }
    updateFields.push(`progress = $${paramIndex++}`);
    updateValues.push(progress);
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    updateValues.push(parseInt(id));

    if (updateFields.length === 1) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No fields to update' });
    }

    const updateQuery = `
      UPDATE service_tracking
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    const result = await client.query(updateQuery, updateValues);
    const updatedEntry = result.rows[0];

    // Update steps for currentStep
    if (currentStep) {
      const stepOrderMap = {
        'Submitted': 1,
        'Initial Review': 2,
        'Document Verification': 3,
        'Final Approval': 4
      };
      const estimatedDaysMap = {
        'Submitted': 1,
        'Initial Review': 3,
        'Document Verification': 5,
        'Final Approval': 2
      };

      const currentStepOrder = stepOrderMap[currentStep] || 1;

      // Update only the current step
      await client.query(
        `INSERT INTO service_tracking_steps (
          service_tracking_id, name, completed, date, created_at, step_order, estimated_days
        ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5, $6)
        ON CONFLICT (service_tracking_id, name)
        DO UPDATE SET
          completed = EXCLUDED.completed,
          date = CASE 
            WHEN service_tracking_steps.completed = false AND EXCLUDED.completed = true 
            THEN EXCLUDED.date 
            ELSE service_tracking_steps.date 
          END,
          step_order = EXCLUDED.step_order,
          estimated_days = EXCLUDED.estimated_days
        RETURNING id, name, completed, date, created_at, step_order, estimated_days`,
        [
          parseInt(id),
          currentStep,
          true,
          new Date(),
          currentStepOrder,
          estimatedDaysMap[currentStep]
        ]
      );

      // Ensure previous steps are completed but preserve their original dates
      const previousSteps = Object.entries(stepOrderMap)
        .filter(([_, order]) => order < currentStepOrder)
        .map(([name]) => name);

      for (const stepName of previousSteps) {
        await client.query(
          `INSERT INTO service_tracking_steps (
            service_tracking_id, name, completed, date, created_at, step_order, estimated_days
          ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5, $6)
          ON CONFLICT (service_tracking_id, name)
          DO UPDATE SET
            completed = EXCLUDED.completed,
            date = CASE 
              WHEN service_tracking_steps.completed = false AND EXCLUDED.completed = true 
              THEN EXCLUDED.date 
              ELSE service_tracking_steps.date 
            END,
            step_order = EXCLUDED.step_order,
            estimated_days = EXCLUDED.estimated_days
          RETURNING id, name, completed, date, created_at, step_order, estimated_days`,
          [
            parseInt(id),
            stepName,
            true,
            null,
            stepOrderMap[stepName],
            estimatedDaysMap[stepName]
          ]
        );
      }

      // Ensure future steps are not completed
      const futureSteps = Object.entries(stepOrderMap)
        .filter(([_, order]) => order > currentStepOrder)
        .map(([name]) => name);

      for (const stepName of futureSteps) {
        await client.query(
          `INSERT INTO service_tracking_steps (
            service_tracking_id, name, completed, date, created_at, step_order, estimated_days
          ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5, $6)
          ON CONFLICT (service_tracking_id, name)
          DO UPDATE SET
            completed = EXCLUDED.completed,
            date = EXCLUDED.date,
            step_order = EXCLUDED.step_order,
            estimated_days = EXCLUDED.estimated_days
          RETURNING id, name, completed, date, created_at, step_order, estimated_days`,
          [
            parseInt(id),
            stepName,
            false,
            null,
            stepOrderMap[stepName],
            estimatedDaysMap[stepName]
          ]
        );
      }
    }

    // Update steps for completed status
    if (status === 'completed') {
      await client.query(
        `UPDATE service_tracking_steps
         SET completed = true,
             date = CASE WHEN completed = false THEN CURRENT_TIMESTAMP ELSE date END
         WHERE service_tracking_id = $1`,
        [parseInt(id)]
      );
    }

    // Fetch updated steps
    const stepsResult = await client.query(
      `SELECT id, name, completed, date, created_at, step_order, estimated_days
       FROM service_tracking_steps
       WHERE service_tracking_id = $1
       ORDER BY step_order, created_at`,
      [updatedEntry.id]
    );
    const stepsData = stepsResult.rows.map(step => ({
      id: step.id,
      name: step.name,
      completed: step.completed,
      date: step.date ? step.date.toISOString() : null,
      created_at: step.created_at ? step.created_at.toISOString() : null,
      step_order: step.step_order,
      estimated_days: step.estimated_days
    }));

    console.log('servicetracking.js: Updated steps for service tracking ID:', id, JSON.stringify(stepsData, null, 2));

    const serviceName = (await client.query('SELECT name FROM services WHERE id = $1', [serviceEntry.rows[0].category_id])).rows[0].name;
    const subcategoryName = (await client.query('SELECT name FROM subcategories WHERE id = $1', [serviceEntry.rows[0].subcategory_id])).rows[0].name;

    await client.query(
      `INSERT INTO audit_logs (action, performed_by, details, centre_id, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [
        'Service Tracking Updated',
        req.user.username,
        `Updated service tracking entry ${updatedEntry.application_number || 'N/A'} by ${req.user.role} with aadhaar ${updatedEntry.aadhaar || 'N/A'}, priority ${updatedEntry.priority || 'Medium'}`,
        centreId
      ]
    );

    // ========== ACTIVITY LOGGING ==========
    // Log task completion on update if status changed to completed
    if (status === 'completed' && existingEntry.status !== 'completed') {
      await logActivity({
        centre_id: centreId,
        related_type: 'service_tracking',
        related_id: id,
        action: 'Task Completed',
        description: `Task completed for ${serviceEntry.rows[0].customer_name} - ${serviceName} (Application: ${updatedEntry.application_number || 'N/A'})`,
        performed_by: req.user.id,
        performed_by_role: req.user.role
      });
    }
    // ======================================

    // Send notification with the appropriate status
    const notificationStatus = status || updatedEntry.status;
    if (notificationStatus || currentStep) {
      await sendStatusNotification(
        updatedEntry.service_entry_id, 
        notificationStatus, 
        currentStep || updatedEntry.current_step, 
        notes || updatedEntry.notes
      );
    }

    io.to(`centre_${centreId}`).emit('serviceTrackingUpdate', {
      application_number: updatedEntry.application_number,
      status: updatedEntry.status,
      assigned_to: updatedEntry.assigned_to,
      aadhaar: updatedEntry.aadhaar,
      email: updatedEntry.email,
      priority: updatedEntry.priority,
      message: `Service tracking entry ${updatedEntry.application_number || 'N/A'} updated`
    });

    // 🔄 Sync with customer_services if linked
    if (customerServiceId) {
      await syncWithCustomerServices(client, updatedEntry, customerServiceId);
    }

    await client.query('COMMIT');

    res.json({
      message: 'Service tracking entry updated successfully',
      entry: {
        id: updatedEntry.id,
        service_entry_id: updatedEntry.service_entry_id,
        customer_service_id: customerServiceId,
        application_number: updatedEntry.application_number,
        customer_name: serviceEntry.rows[0].customer_name,
        phone: serviceEntry.rows[0].phone,
        service_name: serviceName,
        subcategory_name: subcategoryName,
        category_id: serviceEntry.rows[0].category_id,
        subcategory_id: serviceEntry.rows[0].subcategory_id,
        service_charges: parseFloat(serviceEntry.rows[0].service_charges),
        department_charges: parseFloat(serviceEntry.rows[0].department_charges),
        total_charges: parseFloat(serviceEntry.rows[0].total_charges),
        assigned_to: updatedEntry.assigned_to,
        assigned_to_name: assignedToName || (await client.query('SELECT name FROM staff WHERE id = $1', [updatedEntry.assigned_to])).rows[0]?.name,
        status: updatedEntry.status,
        current_step: updatedEntry.current_step,
        estimated_delivery: updatedEntry.estimated_delivery ? updatedEntry.estimated_delivery.toISOString() : null,
        average_time: updatedEntry.average_time,
        notes: updatedEntry.notes,
        progress: updatedEntry.progress,
        aadhaar: updatedEntry.aadhaar,
        email: updatedEntry.email,
        priority: updatedEntry.priority,
        expiry_date: serviceEntry.rows[0].expiry_date ? serviceEntry.rows[0].expiry_date.toISOString() : null,
        steps: stepsData,
        updated_at: updatedEntry.updated_at ? updatedEntry.updated_at.toISOString() : null
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('servicetracking.js: Error updating service tracking entry:', err);
    res.status(500).json({ error: 'Failed to update service tracking entry: ' + err.message });
  } finally {
    client.release();
  }
});

/**
 * PUT /api/servicetracking/entries/:id/update-status - Update only status
 */
router.put('/entries/:id/update-status', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  console.log('servicetracking.js: Received status update payload:', JSON.stringify({ id, status }, null, 2));

  const client = await pool.connect();
  try {
    if (!status || !['pending', 'in_progress', 'completed', 'rejected', 'resubmit', 'paid'].includes(status)) {
      return res.status(400).json({ error: 'status is required and must be one of: pending, in_progress, completed, rejected, resubmit, paid' });
    }

    await client.query('BEGIN');

    const entryResult = await client.query(
      'SELECT application_number, service_entry_id, status, current_step, progress, notes, aadhaar, email, priority FROM service_tracking WHERE id = $1',
      [parseInt(id)]
    );
    if (entryResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Service tracking entry ID ${id} not found` });
    }
    const existingEntry = entryResult.rows[0];

    const serviceEntry = await client.query(
      'SELECT staff_id, category_id, subcategory_id, customer_name, phone, service_charges, department_charges, total_charges, token_id, expiry_date, customer_service_id FROM service_entries WHERE id = $1',
      [existingEntry.service_entry_id]
    );
    if (serviceEntry.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Service Entry ID ${existingEntry.service_entry_id} not found` });
    }
    const entryStaffResult = await client.query('SELECT centre_id FROM staff WHERE id = $1', [serviceEntry.rows[0].staff_id]);
    if (entryStaffResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Staff ID ${serviceEntry.rows[0].staff_id} not found for service entry` });
    }
    const centreId = entryStaffResult.rows[0].centre_id;
    const customerServiceId = serviceEntry.rows[0].customer_service_id;

    if (req.user.role === 'staff') {
      const assignedCheck = await client.query(
        'SELECT id FROM service_tracking WHERE id = $1 AND assigned_to = $2',
        [parseInt(id), parseInt(req.user.id)]
      );
      if (assignedCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Unauthorized: You can only update entries assigned to you' });
      }
    } else if (req.user.role === 'supervisor') {
      const supervisorCheck = await client.query(
        'SELECT se_staff.reports_to FROM service_entries se JOIN staff se_staff ON se.staff_id = se_staff.id WHERE se.id = $1',
        [existingEntry.service_entry_id]
      );
      if (supervisorCheck.rows.length === 0 || supervisorCheck.rows[0].reports_to !== parseInt(req.user.id)) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Unauthorized: You can only update entries for staff reporting to you' });
      }
    } else if (req.user.role === 'admin' && centreId !== parseInt(req.user.centre_id)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Unauthorized: You can only update entries in your centre' });
    }

    // Calculate progress based on current_step, not status
    const stepProgressMap = {
      'Submitted': 25,
      'Initial Review': 50,
      'Document Verification': 75,
      'Final Approval': 100
    };
    
    // Always base progress on current_step
    let progress = stepProgressMap[existingEntry.current_step] || 25;
    
    // Only override for completed/paid status
    if (status === 'completed' || status === 'paid') {
      progress = 100;
    }

    // IMPORTANT: Keep current_step unchanged - don't automatically update it based on status
    const result = await client.query(
      `UPDATE service_tracking
       SET status = $1, progress = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [status, progress, parseInt(id)]
    );
    const updatedEntry = result.rows[0];

    // 🔹 DEBUG: Check if status is 'completed'
    console.log("🔥 STATUS COMPLETED CHECK - Status value:", status);
    console.log("🔥 STATUS COMPLETED BLOCK ENTERED:", status === 'completed');
    
    // 🔹 AUTO CREATE REVIEW ONLY FOR NON-REGISTERED CUSTOMERS
    if (status === 'completed') {

      console.log("🔥 STATUS COMPLETED BLOCK ENTERED");
      const entryData = serviceEntry.rows[0];
      
      console.log("🔥 customer_service_id value:", entryData.customer_service_id);
      console.log("🔥 Condition check (!entryData.customer_service_id):", !entryData.customer_service_id);

      // Only create token review if NOT booked through portal
      if (!entryData.customer_service_id) {

        console.log("🔥 INSIDE NON-PORTAL BLOCK - About to create review");
        
        try {
          const existingReview = await client.query(
            'SELECT id FROM service_reviews WHERE tracking_id = $1',
            [updatedEntry.id]
          );

          console.log("🔥 Existing review check result:", existingReview.rows.length);

          if (existingReview.rows.length === 0) {
            console.log("🔥 CALLING createReviewRequest NOW...");
            
            console.log("🔥 Review params:", {
              centreId: centreId,
              trackingId: updatedEntry.id,
              serviceId: null,
              staffId: entryData.staff_id,
              customerName: entryData.customer_name,
              customerPhone: entryData.phone,
              centreName: "Your Centre Name"
            });
            
            createReviewRequest({
              centreId: centreId,
              trackingId: updatedEntry.id,
              serviceId: null,
              staffId: entryData.staff_id,
              customerName: entryData.customer_name,
              customerPhone: entryData.phone,
              centreName: "Your Centre Name"
            }).catch(err =>
              console.error("Review auto-send failed:", err)
            );
            
            console.log("🔥 createReviewRequest CALLED - function executed");
          } else {
            console.log("🔥 Review already exists - skipping");
          }

        } catch (err) {
          console.error("Review trigger error:", err);
        }

      } else {
        console.log("Portal booking detected → No token review created");
      }
    }

    // REMOVED: All the step update logic that was automatically changing steps based on status
    // We only update steps when current_step is explicitly changed in the main update endpoint

    // Fetch current steps (unchanged)
    const stepsResult = await client.query(
      `SELECT id, name, completed, date, created_at, step_order, estimated_days
       FROM service_tracking_steps
       WHERE service_tracking_id = $1
       ORDER BY step_order, created_at`,
      [updatedEntry.id]
    );
    const stepsData = stepsResult.rows.map(step => ({
      id: step.id,
      name: step.name,
      completed: step.completed,
      date: step.date ? step.date.toISOString() : null,
      created_at: step.created_at ? step.created_at.toISOString() : null,
      step_order: step.step_order,
      estimated_days: step.estimated_days
    }));

    console.log('servicetracking.js: Status updated, steps unchanged for service tracking ID:', id);

    const serviceName = (await client.query('SELECT name FROM services WHERE id = $1', [serviceEntry.rows[0].category_id])).rows[0].name;
    const subcategoryName = (await client.query('SELECT name FROM subcategories WHERE id = $1', [serviceEntry.rows[0].subcategory_id])).rows[0].name;

    await client.query(
      `INSERT INTO audit_logs (action, performed_by, details, centre_id, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [
        'Service Tracking Status Updated',
        req.user.username,
        `Updated service tracking entry ${updatedEntry.application_number || 'N/A'} status to ${status} by ${req.user.role} (current_step unchanged: ${existingEntry.current_step})`,
        centreId
      ]
    );

    // ========== ACTIVITY LOGGING ==========
    // Log task completion if status changed to completed
    if (status === 'completed' && existingEntry.status !== 'completed') {
      await logActivity({
        centre_id: centreId,
        related_type: 'service_tracking',
        related_id: id,
        action: 'Task Completed',
        description: `Task completed for ${serviceEntry.rows[0].customer_name} - ${serviceName} (Application: ${updatedEntry.application_number || 'N/A'})`,
        performed_by: req.user.id,
        performed_by_role: req.user.role
      });
    }
    // ======================================

    // Send notification with the status (not current_step)
    await sendStatusNotification(
      updatedEntry.service_entry_id, 
      status, // Pass the actual status, not current_step
      existingEntry.current_step, // Keep current_step for reference but not used in notification
      updatedEntry.notes
    );

    io.to(`centre_${centreId}`).emit('serviceTrackingUpdate', {
      application_number: updatedEntry.application_number,
      status: updatedEntry.status,
      aadhaar: updatedEntry.aadhaar,
      email: updatedEntry.email,
      priority: updatedEntry.priority,
      message: `Service tracking entry ${updatedEntry.application_number || 'N/A'} status updated to ${status}`
    });

    // Sync with customer_services if linked
    if (customerServiceId) {
      await syncWithCustomerServices(client, updatedEntry, customerServiceId);
    }

    await client.query('COMMIT');

    res.json({
      message: 'Service tracking status updated successfully',
      entry: {
        id: updatedEntry.id,
        service_entry_id: updatedEntry.service_entry_id,
        customer_service_id: customerServiceId,
        application_number: updatedEntry.application_number,
        customer_name: serviceEntry.rows[0].customer_name,
        phone: serviceEntry.rows[0].phone,
        service_name: serviceName,
        subcategory_name: subcategoryName,
        category_id: serviceEntry.rows[0].category_id,
        subcategory_id: serviceEntry.rows[0].subcategory_id,
        service_charges: parseFloat(serviceEntry.rows[0].service_charges),
        department_charges: parseFloat(serviceEntry.rows[0].department_charges),
        total_charges: parseFloat(serviceEntry.rows[0].total_charges),
        assigned_to: updatedEntry.assigned_to,
        assigned_to_name: (await client.query('SELECT name FROM staff WHERE id = $1', [updatedEntry.assigned_to])).rows[0]?.name,
        status: updatedEntry.status,
        current_step: existingEntry.current_step, // Return the original current_step, not changed
        estimated_delivery: updatedEntry.estimated_delivery ? updatedEntry.estimated_delivery.toISOString() : null,
        average_time: updatedEntry.average_time,
        notes: updatedEntry.notes,
        progress: updatedEntry.progress, // This will be based on current_step
        aadhaar: updatedEntry.aadhaar,
        email: updatedEntry.email,
        priority: updatedEntry.priority,
        expiry_date: serviceEntry.rows[0].expiry_date ? serviceEntry.rows[0].expiry_date.toISOString() : null,
        steps: stepsData,
        updated_at: updatedEntry.updated_at ? updatedEntry.updated_at.toISOString() : null
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('servicetracking.js: Error updating service tracking status:', err);
    res.status(500).json({ error: 'Failed to update service tracking status: ' + err.message });
  } finally {
    client.release();
  }
});

/**
 * GET /api/servicetracking - Get all service tracking entries
 */
router.get('/', authenticateToken, async (req, res) => {
  const { today, centre_id } = req.query;
  const client = await pool.connect();
  try {
    let query = `
      SELECT 
        st.id, 
        st.service_entry_id,
        st.application_number,
        se.customer_name, 
        se.phone, 
        s.name AS service_name, 
        sc.name AS subcategory_name, 
        se.category_id,
        se.subcategory_id,
        se.service_charges,
        se.department_charges,
        se.total_charges,
        st.assigned_to, 
        staff.name AS assigned_to_name, 
        st.status, 
        st.current_step,
        st.estimated_delivery,
        st.average_time,
        st.notes,
        st.progress,
        st.aadhaar,
        st.email,
        st.priority,
        se.expiry_date,
        st.updated_at,
        se.customer_service_id
      FROM service_tracking st
      JOIN service_entries se ON st.service_entry_id = se.id
      JOIN services s ON se.category_id = s.id
      JOIN subcategories sc ON se.subcategory_id = sc.id
      LEFT JOIN staff ON st.assigned_to = staff.id
      JOIN staff se_staff ON se.staff_id = se_staff.id
    `;
    let values = [];
    let conditions = [];

    if (today === 'true') {
      conditions.push(`st.updated_at::date = CURRENT_DATE`);
    }

    if (req.user.role === 'staff') {
      conditions.push(`st.assigned_to = $${values.length + 1}`);
      values.push(parseInt(req.user.id));
    } else if (req.user.role === 'supervisor') {
      conditions.push(`se_staff.centre_id = $${values.length + 1} AND se_staff.reports_to = $${values.length + 2}`);
      values.push(parseInt(req.user.centre_id), parseInt(req.user.id));
    } else if (req.user.role === 'admin') {
      conditions.push(`se_staff.centre_id = $${values.length + 1}`);
      values.push(parseInt(req.user.centre_id));
    } else if (req.user.role === 'superadmin' && centre_id) {
      conditions.push(`se_staff.centre_id = $${values.length + 1}`);
      values.push(parseInt(centre_id));
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY st.updated_at DESC`;

    console.log('servicetracking.js: Fetching service tracking entries with query:', query, 'values:', values);

    const entries = await fetchTrackingEntries(client, req, query, values);
    console.log('servicetracking.js: Service tracking entries fetched:', JSON.stringify(entries, null, 2));
    res.json(entries);
  } catch (err) {
    console.error('servicetracking.js: Error fetching service tracking entries:', err);
    res.status(500).json({ error: 'Failed to fetch service tracking entries: ' + err.message });
  } finally {
    client.release();
  }
});

export default router;
