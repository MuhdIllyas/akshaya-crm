import express from 'express';
import pool from '../db.js';
import { authMiddleware } from './staff.js';
import { logActivity } from "../utils/activityLogger.js"; // Add this import

const router = express.Router();

// Middleware - Restrict to admin, superadmin, or staff roles
router.use(authMiddleware(['admin', 'superadmin', 'staff']));

// GET /api/salary/staff - Get staff list with schedules (staff sees only their own data)
router.get('/staff', async (req, res) => {
  const client = await pool.connect();
  try {
    if (req.user.role === 'staff') {
      const result = await client.query(
        `SELECT id, username, name, role, department, email, phone, status,
         join_date AS "joinDate", photo, employee_id AS "employeeId",
         employment_type AS "employmentType", reports_to AS "reportsTo",
         COALESCE(CAST(salary AS NUMERIC), 0) AS salary, dob AS "dateOfBirth", gender,
         emergency_contact AS "emergencyContact",
         emergency_relationship AS "emergencyRelationship", centre_id AS "centreId",
         created_at AS "lastActive"
         FROM staff WHERE id = $1`,
        [req.user.id]
      );

      const schedulesResult = await client.query(
        `SELECT start_time, end_time, standard_hours, effective_from, effective_to
         FROM staff_schedules 
         WHERE staff_id = $1 
         ORDER BY effective_from DESC`,
        [req.user.id]
      );

      const staffWithSchedules = result.rows.map(staff => ({
        ...staff,
        schedules: schedulesResult.rows
      }));

      res.json(staffWithSchedules);
    } else {
      const centreId = req.user.role === 'admin' ? req.user.centre_id : req.query.centre_id;
      if (!centreId) return res.status(400).json({ error: 'Centre ID is required' });

      const centreCheck = await client.query('SELECT id FROM centres WHERE id = $1', [centreId]);
      if (centreCheck.rows.length === 0) return res.status(400).json({ error: `Centre ID ${centreId} does not exist` });

      const result = await client.query(
        `SELECT id, username, name, role, department, email, phone, status,
         join_date AS "joinDate", photo, employee_id AS "employeeId",
         employment_type AS "employmentType", reports_to AS "reportsTo",
         COALESCE(CAST(salary AS NUMERIC), 0) AS salary, dob AS "dateOfBirth", gender,
         emergency_contact AS "emergencyContact",
         emergency_relationship AS "emergencyRelationship", centre_id AS "centreId",
         created_at AS "lastActive"
         FROM staff WHERE centre_id = $1`,
        [centreId]
      );

      const staffIds = result.rows.map(staff => staff.id);
      let schedulesByStaff = {};
      if (staffIds.length > 0) {
        const schedulesResult = await client.query(
          `SELECT ss.staff_id, ss.start_time, ss.end_time, ss.standard_hours, 
                  ss.effective_from, ss.effective_to
           FROM staff_schedules ss
           WHERE ss.staff_id = ANY($1)
           ORDER BY ss.staff_id, ss.effective_from DESC`,
          [staffIds]
        );

        schedulesByStaff = schedulesResult.rows.reduce((acc, sch) => {
          if (!acc[sch.staff_id]) acc[sch.staff_id] = [];
          acc[sch.staff_id].push({
            start_time: sch.start_time,
            end_time: sch.end_time,
            standard_hours: sch.standard_hours,
            effective_from: sch.effective_from,
            effective_to: sch.effective_to
          });
          return acc;
        }, {});
      }

      const staffWithSchedules = result.rows.map(staff => ({
        ...staff,
        schedules: schedulesByStaff[staff.id] || []
      }));

      res.json(staffWithSchedules);
    }
  } catch (err) {
    console.error('Error fetching staff:', err);
    res.status(500).json({ error: 'Failed to fetch staff', details: err.message });
  } finally {
    client.release();
  }
});

// GET /api/salary/staff/:id/schedules - Get all schedules for a staff member
router.get('/staff/:id/schedules', authMiddleware(['admin', 'superadmin', 'staff']), async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    if (req.user.role === 'staff' && req.user.id != id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    if (req.user.role === 'admin') {
      const staffCheck = await client.query('SELECT centre_id FROM staff WHERE id = $1', [id]);
      if (staffCheck.rows.length === 0) return res.status(404).json({ error: 'Staff not found' });
      if (staffCheck.rows[0].centre_id !== req.user.centre_id) return res.status(403).json({ error: 'Unauthorized' });
    }

    const result = await client.query(
      `SELECT start_time, end_time, standard_hours, effective_from, effective_to
       FROM staff_schedules 
       WHERE staff_id = $1 
       ORDER BY effective_from DESC`,
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching schedules:', err);
    res.status(500).json({ error: 'Failed to fetch schedules' });
  } finally {
    client.release();
  }
});

// GET /api/salary/attendance - Get attendance for month (staff sees only their own)
router.get('/attendance', async (req, res) => {
  const { month } = req.query;
  const client = await pool.connect();
  try {
    if (!month) return res.status(400).json({ error: 'Month parameter is required' });

    if (req.user.role === 'staff') {
      const result = await client.query(
        `SELECT a.id, a.staff_id, TO_CHAR(a.date, 'YYYY-MM-DD') AS date, a.punch_in, a.punch_out, 
                a.breaks, a.hours, a.status, a.late_minutes, a.extra_minutes, s.name AS staff_name
         FROM attendance a
         JOIN staff s ON a.staff_id = s.id
         WHERE a.staff_id = $1 AND TO_CHAR(a.date, 'YYYY-MM') = $2
         ORDER BY a.date DESC`,
        [req.user.id, month]
      );
      res.json(result.rows);
    } else {
      const centreId = req.user.role === 'admin' ? req.user.centre_id : req.query.centre_id;
      if (!centreId) return res.status(400).json({ error: 'Centre ID is required' });

      const centreCheck = await client.query('SELECT id FROM centres WHERE id = $1', [centreId]);
      if (centreCheck.rows.length === 0) return res.status(400).json({ error: `Centre ID ${centreId} does not exist` });

      const result = await client.query(
        `SELECT a.id, a.staff_id, TO_CHAR(a.date, 'YYYY-MM-DD') AS date, a.punch_in, a.punch_out, 
                a.breaks, a.hours, a.status, a.late_minutes, a.extra_minutes, s.name AS staff_name
         FROM attendance a
         JOIN staff s ON a.staff_id = s.id
         WHERE s.centre_id = $1 AND TO_CHAR(a.date, 'YYYY-MM') = $2
         ORDER BY a.date DESC`,
        [centreId, month]
      );
      res.json(result.rows);
    }
  } catch (err) {
    console.error('Error fetching attendance:', err);
    res.status(500).json({ error: 'Failed to fetch attendance' });
  } finally {
    client.release();
  }
});

// POST /api/salary/attendance - Record punch in/out (staff only)
router.post('/attendance', authMiddleware(['staff']), async (req, res) => {
  const { punch_type, timestamp, breaks } = req.body;
  const client = await pool.connect();
  try {
    if (!punch_type || !timestamp) return res.status(400).json({ error: 'Punch type and timestamp required' });
    if (!['in', 'out'].includes(punch_type)) return res.status(400).json({ error: 'Invalid punch type' });

    await client.query('BEGIN');

    // Parse the timestamp (should be ISO 8601, e.g., 2025-03-28T09:00:00.000Z)
    const punchDateTime = new Date(timestamp);
    if (isNaN(punchDateTime.getTime())) return res.status(400).json({ error: 'Invalid timestamp' });

    // Extract date and time in UTC (since timestamp is UTC)
    const date = punchDateTime.toISOString().slice(0, 10); // YYYY-MM-DD
    const time = punchDateTime.toTimeString().slice(0, 5); // HH:MM

    // Validate that the timestamp is within 15 minutes of the server's current time
    const now = new Date();
    const diffMs = Math.abs(now - punchDateTime);
    if (diffMs > 15 * 60 * 1000) {
      return res.status(400).json({ error: 'Punch time must be within 15 minutes of current server time' });
    }

    const existing = await client.query(
      `SELECT id, punch_in, punch_out FROM attendance 
       WHERE staff_id = $1 AND date = $2 AND punch_out IS NULL`,
      [req.user.id, date]
    );

    if (punch_type === 'in') {
      if (existing.rows.length > 0) {
        return res.status(400).json({ error: 'Already punched in. Punch out first.' });
      }
      const result = await client.query(
        `INSERT INTO attendance (staff_id, date, punch_in, status, created_at)
         VALUES ($1, $2, $3, 'present', NOW()) 
         RETURNING *, TO_CHAR(date, 'YYYY-MM-DD') AS date`,
        [req.user.id, date, time]
      );
      await client.query('COMMIT');
      res.status(201).json(result.rows[0]);
    } else {
      if (existing.rows.length === 0) return res.status(404).json({ error: 'No open punch-in' });
      const { id, punch_in } = existing.rows[0];
      const newBreaks = breaks || null;
      const hours = calculateHours(punch_in, time, newBreaks);

      const result = await client.query(
        `UPDATE attendance 
         SET punch_out = $1, breaks = $2, hours = $3, updated_at = NOW()
         WHERE id = $4 
         RETURNING *, TO_CHAR(date, 'YYYY-MM-DD') AS date`,
        [time, newBreaks, hours, id]
      );

      // Recalculate late/extra - ONLY RECALCULATE ON PUNCH-OUT (final exit)
      if (punch_type === 'out') {
        await recalculateDayDeviation(client, req.user.id, date);
      }

      await client.query('COMMIT');
      const final = await client.query('SELECT * FROM attendance WHERE id = $1', [id]);
      res.json(final.rows[0]);
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Punch error:', err);
    res.status(500).json({ error: 'Failed to record punch' });
  } finally {
    client.release();
  }
});

// Recalculate late/extra for the ENTIRE DAY (first in, last out)
const recalculateDayDeviation = async (client, staffId, date) => {
  try {
    // 1. Get ALL punches for this staff on this date
    const dayPunches = await client.query(
      `SELECT punch_in, punch_out 
       FROM attendance 
       WHERE staff_id = $1 AND date = $2 
       ORDER BY punch_in ASC`,
      [staffId, date]
    );

    if (dayPunches.rows.length === 0) return;

    // 2. Find FIRST punch-in and LAST punch-out
    let firstIn = null;
    let lastOut = null;

    dayPunches.rows.forEach(row => {
      if (row.punch_in && (!firstIn || row.punch_in < firstIn)) {
        firstIn = row.punch_in;
      }
      if (row.punch_out && (!lastOut || row.punch_out > lastOut)) {
        lastOut = row.punch_out;
      }
    });

    if (!firstIn || !lastOut) return; // incomplete day

    // 3. Get effective schedule
    const scheduleRes = await client.query(
      `SELECT start_time, end_time
       FROM staff_schedules
       WHERE staff_id = $1
         AND effective_from <= $2
         AND (effective_to IS NULL OR effective_to >= $2)
       ORDER BY effective_from DESC
       LIMIT 1`,
      [staffId, date]
    );

    if (scheduleRes.rows.length === 0) return;

    const { start_time, end_time } = scheduleRes.rows[0];
    const inM = timeToMinutes(firstIn);
    const outM = timeToMinutes(lastOut);
    const startM = timeToMinutes(start_time);
    const endM = timeToMinutes(end_time);

    const lateM = Math.max(0, inM - startM);
    const extraM = Math.max(0, outM - endM);

    // 4. Update ALL attendance records of the day with same late/extra
    await client.query(
      `UPDATE attendance 
       SET late_minutes = $1, extra_minutes = $2, updated_at = NOW()
       WHERE staff_id = $3 AND date = $4`,
      [lateM, extraM, staffId, date]
    );
  } catch (err) {
    console.error('Error in recalculateDayDeviation:', err);
  }
};

// Helper function: time to minutes
const timeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

// Calculate hours, accounting for breaks
const calculateHours = (punchIn, punchOut, breaks) => {
  if (!punchIn || !punchOut) return 0;
  const [inHour, inMinute] = punchIn.split(':').map(Number);
  const [outHour, outMinute] = punchOut.split(':').map(Number);
  let hours = outHour - inHour;
  let minutes = outMinute - inMinute;
  if (minutes < 0) {
    hours -= 1;
    minutes += 60;
  }
  let totalHours = hours + minutes / 60;

  // Subtract break durations
  if (breaks) {
    const breakTimes = breaks.split(', ').map(b => b.trim());
    for (const breakTime of breakTimes) {
      if (/^\d{2}:\d{2}-\d{2}:\d{2}$/.test(breakTime)) {
        const [start, end] = breakTime.split('-');
        const [startHour, startMinute] = start.split(':').map(Number);
        const [endHour, endMinute] = end.split(':').map(Number);
        let breakHours = endHour - startHour;
        let breakMinutes = endMinute - startMinute;
        if (breakMinutes < 0) {
          breakHours -= 1;
          breakMinutes += 60;
        }
        totalHours -= breakHours + breakMinutes / 60;
      }
    }
  }

  return parseFloat(totalHours.toFixed(2));
};

// PUT /api/salary/attendance/:id - Update attendance (admin/superadmin only)
router.put('/attendance/:id', authMiddleware(['admin', 'superadmin']), async (req, res) => {
  const { id } = req.params;
  const { punch_in, punch_out, breaks, status, hours } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE attendance 
       SET punch_in = $1, punch_out = $2, breaks = $3, status = $4, hours = $5, updated_at = NOW()
       WHERE id = $6 AND EXISTS (SELECT 1 FROM staff s WHERE s.id = attendance.staff_id AND s.centre_id = $7)
       RETURNING *, TO_CHAR(date, 'YYYY-MM-DD') AS date, staff_id`,
      [punch_in, punch_out, breaks, status, hours, id, req.user.centre_id]
    );
    if (result.rows.length === 0) return res.status(400).json({ error: 'Not found or unauthorized' });

    const { staff_id, date } = result.rows[0];
    await recalculateDayDeviation(client, staff_id, date);

    await client.query('COMMIT');
    const final = await client.query('SELECT * FROM attendance WHERE id = $1', [id]);
    res.json(final.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Update attendance error:', err);
    res.status(500).json({ error: 'Failed to update' });
  } finally {
    client.release();
  }
});

// POST /api/salary/attendance/break - Record a break (staff only)
router.post('/attendance/break', authMiddleware(['staff']), async (req, res) => {
  const { attendance_id, break_time } = req.body;
  const client = await pool.connect();
  try {
    if (!attendance_id || !break_time) return res.status(400).json({ error: 'Required fields missing' });
    if (!/^\d{2}:\d{2}-\d{2}:\d{2}$/.test(break_time)) return res.status(400).json({ error: 'Invalid format' });

    await client.query('BEGIN');
    const rec = await client.query(
      `SELECT breaks, punch_in, punch_out FROM attendance WHERE id = $1 AND staff_id = $2 AND punch_out IS NULL`,
      [attendance_id, req.user.id]
    );
    if (rec.rows.length === 0) return res.status(404).json({ error: 'No open record' });

    const { breaks, punch_in, punch_out } = rec.rows[0];
    const newBreaks = breaks ? `${breaks}, ${break_time}` : break_time;
    const hours = punch_out ? calculateHours(punch_in, punch_out, newBreaks) : null;

    await client.query(
      `UPDATE attendance SET breaks = $1, hours = $2 WHERE id = $3`,
      [newBreaks, hours, attendance_id]
    );
    await client.query('COMMIT');
    const final = await client.query('SELECT * FROM attendance WHERE id = $1', [attendance_id]);
    res.json(final.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to add break' });
  } finally {
    client.release();
  }
});

// SALARY: Aggregate late/extra from attendance
const getMonthlyDeviation = async (client, staffId, month) => {
  const res = await client.query(`
    SELECT COALESCE(SUM(late_minutes), 0) as total_late,
           COALESCE(SUM(extra_minutes), 0) as total_extra
    FROM attendance
    WHERE staff_id = $1 AND status = 'present' AND TO_CHAR(date, 'YYYY-MM') = $2
  `, [staffId, month]);
  return res.rows[0];
};

// GET /api/salary/leaves/pending - Get pending leaves (admin/superadmin only)
router.get('/leaves/pending', authMiddleware(['admin', 'superadmin']), async (req, res) => {
  const client = await pool.connect();
  try {
    const centreId = req.user.role === 'admin' ? req.user.centre_id : req.query.centre_id;
    if (!centreId) {
      return res.status(400).json({ error: 'Centre ID is required' });
    }
    const centreCheck = await client.query('SELECT id FROM centres WHERE id = $1', [centreId]);
    if (centreCheck.rows.length === 0) {
      return res.status(400).json({ error: `Centre ID ${centreId} does not exist` });
    }
    const result = await client.query(
      `SELECT l.*, s.name AS staff_name, s.department
       FROM leaves l
       JOIN staff s ON l.staff_id = s.id
       WHERE s.centre_id = $1 AND l.status = 'pending'
       ORDER BY l.applied_date DESC`,
      [centreId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching pending leaves:', {
      message: err.message,
      stack: err.stack,
      query: 'SELECT ... FROM leaves WHERE centre_id = $1 AND status = pending ...',
      params: { centreId: req.user.role === 'admin' ? req.user.centre_id : req.query.centre_id },
    });
    res.status(500).json({ error: 'Failed to fetch leaves', details: err.message });
  } finally {
    client.release();
  }
});

// GET /api/salary/leaves - Get staff's own leave applications
router.get('/leaves', async (req, res) => {
  const { month } = req.query; 
  const client = await pool.connect();
  
  try {
    let query;
    let params = [];
    let paramIndex = 1;

    // --- Dynamic WHERE Clause Logic ---
    let whereClause = '';
    
    if (req.user.role === 'staff') {
      whereClause = `l.staff_id = $${paramIndex++}`;
      params.push(req.user.id);
    } else {
      // Admin/Superadmin logic
      const centreId = req.user.role === 'admin' ? req.user.centre_id : req.query.centre_id;
      if (!centreId) {
        return res.status(400).json({ error: 'Centre ID is required' });
      }
      const centreCheck = await client.query('SELECT id FROM centres WHERE id = $1', [centreId]);
      if (centreCheck.rows.length === 0) {
        return res.status(400).json({ error: `Centre ID ${centreId} does not exist` });
      }
      
      whereClause = `s.centre_id = $${paramIndex++}`;
      params.push(centreId);
    }

    // --- Date Filtering (Overlap Logic) ---
    if (month) {
      // month is YYYY-MM, we need YYYY-MM-01 for PostgreSQL DATE_TRUNC
      const monthStart = `${month}-01`;
      
      // SQL Overlap Logic: (Leave_From <= Month_End) AND (Leave_To >= Month_Start)
      // Month_End calculation: DATE_TRUNC('month', $N::date) + interval '1 month' - interval '1 day'
      // This reliably finds the last day of the given month.
      whereClause += ` 
        AND l.from_date <= DATE_TRUNC('month', $${paramIndex}::date) + interval '1 month' - interval '1 day'
        AND l.to_date >= DATE_TRUNC('month', $${paramIndex}::date)
      `;
      params.push(monthStart);
      paramIndex++;
    }
    
    // --- Build Final Query ---
    query = `
      SELECT l.*, s.name AS staff_name, s.department
      FROM leaves l
      JOIN staff s ON l.staff_id = s.id
      WHERE ${whereClause}
      ORDER BY l.applied_date DESC
    `;

    const result = await client.query(query, params);
    res.json(result.rows);

  } catch (err) {
    console.error('Error fetching leaves:', {
      message: err.message,
      stack: err.stack,
      query: query,
      params: params,
    });
    res.status(500).json({ error: 'Failed to fetch leaves', details: err.message });
  } finally {
    client.release();
  }
});

// POST /api/salary/leaves - Submit a leave application (staff only)
router.post('/leaves', authMiddleware(['staff']), async (req, res) => {
  const { type, from_date, to_date, reason } = req.body;
  const client = await pool.connect();
  try {
    if (!type || !from_date || !to_date || !reason) {
      return res.status(400).json({ error: 'Type, from_date, to_date, and reason are required' });
    }
    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO leaves (staff_id, type, from_date, to_date, reason, status, applied_date, created_at)
       VALUES ($1, $2, $3, $4, $5, 'pending', CURRENT_DATE, NOW()) RETURNING *, TO_CHAR(applied_date, 'YYYY-MM-DD') AS applied_date`,
      [req.user.id, type, from_date, to_date, reason]
    );
    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error submitting leave:', {
      message: err.message,
      stack: err.stack,
      params: { staff_id: req.user.id, type, from_date, to_date, reason },
    });
    res.status(500).json({ error: 'Failed to submit leave', details: err.message });
  } finally {
    client.release();
  }
});

// PUT /api/salary/leaves/:id - Update leave status (admin/superadmin only)
router.put('/leaves/:id', authMiddleware(['admin', 'superadmin']), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Get leave details before update for logging
    const leaveDetails = await client.query(
      `SELECT l.*, s.name AS staff_name, s.centre_id 
       FROM leaves l 
       JOIN staff s ON l.staff_id = s.id 
       WHERE l.id = $1`,
      [id]
    );
    
    const result = await client.query(
      `UPDATE leaves SET status = $1, updated_at = NOW()
       WHERE id = $2 AND EXISTS (
         SELECT 1 FROM staff s WHERE s.id = leaves.staff_id AND s.centre_id = $3
       ) RETURNING *, TO_CHAR(applied_date, 'YYYY-MM-DD') AS applied_date`,
      [status, id, req.user.centre_id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Leave not found or unauthorized' });
    }
    
    await client.query('COMMIT');

    // ========== ACTIVITY LOGGING ==========
    // Log leave approval/rejection activity
    if (leaveDetails.rows.length > 0) {
      const leave = leaveDetails.rows[0];
      await logActivity({
        centre_id: leave.centre_id,
        related_type: 'leave',
        related_id: leave.id,
        action: status === 'approved' ? 'Leave Approved' : 'Leave Rejected',
        description: `${status === 'approved' ? 'Approved' : 'Rejected'} leave request for ${leave.staff_name} (${leave.type}) from ${new Date(leave.from_date).toLocaleDateString()} to ${new Date(leave.to_date).toLocaleDateString()}`,
        performed_by: req.user.id,
        performed_by_role: req.user.role
      });
    }
    // ======================================

    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating leave:', {
      message: err.message,
      stack: err.stack,
      query: 'UPDATE leaves SET ... WHERE id = $2 AND EXISTS ...',
      params: { id, status, centreId: req.user.centre_id },
    });
    res.status(500).json({ error: 'Failed to update leave', details: err.message });
  } finally {
    client.release();
  }
});

// GET /api/salary/salaries - Get salaries for month or all salaries (staff sees only their own)
router.get('/salaries', async (req, res) => {
  const { month } = req.query;
  const client = await pool.connect();
  try {
    if (req.user.role === 'staff') {
      let query = `
        SELECT s.*, st.name AS staff_name
        FROM salaries s
        JOIN staff st ON s.staff_id = st.id
        WHERE s.staff_id = $1
      `;
      const params = [req.user.id];
      if (month) {
        query += ` AND s.month = $2`;
        params.push(month);
      }
      query += ` ORDER BY s.created_at DESC`;
      const result = await client.query(query, params);
      res.json(result.rows);
    } else {
      const centreId = req.user.role === 'admin' ? req.user.centre_id : req.query.centre_id;
      if (!centreId) {
        return res.status(400).json({ error: 'Centre ID is required' });
      }
      const centreCheck = await client.query('SELECT id FROM centres WHERE id = $1', [centreId]);
      if (centreCheck.rows.length === 0) {
        return res.status(400).json({ error: `Centre ID ${centreId} does not exist` });
      }
      let query = `
        SELECT s.*, st.name AS staff_name
        FROM salaries s
        JOIN staff st ON s.staff_id = st.id
        WHERE st.centre_id = $1
      `;
      const params = [centreId];
      if (month) {
        query += ` AND s.month = $2`;
        params.push(month);
      }
      query += ` ORDER BY s.created_at DESC`;
      const result = await client.query(query, params);
      res.json(result.rows);
    }
  } catch (err) {
    console.error('Error fetching salaries:', {
      message: err.message,
      stack: err.stack,
      query: req.user.role === 'staff' ? 'SELECT s.*, st.name AS staff_name FROM salaries s JOIN staff st ON s.staff_id = st.id WHERE s.staff_id = $1 ...' : 'SELECT s.*, st.name AS staff_name FROM salaries s JOIN staff st ON s.staff_id = st.id WHERE st.centre_id = $1 ...',
      params: req.user.role === 'staff' ? { staffId: req.user.id, month } : { centreId: req.user.role === 'admin' ? req.user.centre_id : req.query.centre_id, month },
    });
    res.status(500).json({ error: 'Failed to fetch salaries', details: err.message });
  } finally {
    client.release();
  }
});

const calculateWithOperations = (base, components = []) => {
  let result = Number(base) || 0;
  components.forEach(comp => {
    const amt = Number(comp.amount) || 0;
    const baseVal = comp.base === 'basic' ? Number(comp.basic || base) : result;
    switch (comp.operation) {
      case 'addition': result += amt; break;
      case 'subtraction': result -= amt; break;
      case 'multiplication': result = baseVal * amt; break;
      case 'division': result = amt !== 0 ? baseVal / amt : result; break;
      case 'percentage': result += (baseVal * amt) / 100; break;
    }
  });
  return Number(result.toFixed(2));
};

// POST /api/salary/salaries - Create a new salary record (admin/superadmin only)
router.post('/salaries', authMiddleware(['admin', 'superadmin']), async (req, res) => {
  const {
    staff_id,
    month,
    basic,
    hra = 0,
    ta = 0,
    other_allowances = 0,
    deductions = 0,
    additional_components = []  // optional array
  } = req.body;

  const client = await pool.connect();

  try {
    // Validation
    if (!staff_id || !month || basic === undefined) {
      return res.status(400).json({ error: 'staff_id, month, and basic are required' });
    }

    await client.query('BEGIN');

    // Get centre_id from staff
    const staffRes = await client.query(
      'SELECT centre_id, name FROM staff WHERE id = $1',
      [staff_id]
    );
    if (staffRes.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid staff_id' });
    }

    const centreId = req.user.role === 'admin' ? req.user.centre_id : staffRes.rows[0].centre_id;

    // Admin can only manage their centre
    if (req.user.role === 'admin' && centreId !== req.user.centre_id) {
      return res.status(403).json({ error: 'Unauthorized: Not your centre' });
    }

    // Prevent duplicate salary for same staff + month
    const exists = await client.query(
      'SELECT id FROM salaries WHERE staff_id = $1 AND month = $2',
      [staff_id, month]
    );
    if (exists.rows.length > 0) {
      return res.status(400).json({ error: `Salary already exists for ${month}` });
    }

    // Auto-calculate from attendance
    const autoCalc = await client.query(
      `SELECT 
         COUNT(*) FILTER (WHERE status = 'present') AS present_days,
         COALESCE(SUM(hours), 0) AS total_hours
       FROM attendance 
       WHERE staff_id = $1 
         AND TO_CHAR(date, 'YYYY-MM') = $2`,
      [staff_id, month]
    );

    const { present_days, total_hours } = autoCalc.rows[0];
    const working_days = await client.query(
      `SELECT COUNT(*) AS cnt
       FROM calendar_events 
       WHERE centre_id = $1 
         AND TO_CHAR(date, 'YYYY-MM') = $2 
         AND type = 'working'`,
      [centreId, month]
    );

    const workingDaysCount = parseInt(working_days.rows[0].cnt || 0);

    // Calculate net salary in backend (trusted source)
    const baseSalary = Number(basic) + Number(hra) + Number(ta) + Number(other_allowances);
    let netSalary = baseSalary;

    // Apply additional components
    additional_components.forEach(comp => {
      const amt = Number(comp.amount) || 0;
      const baseVal = comp.base === 'basic' ? Number(basic) : netSalary;
      switch (comp.operation) {
        case 'addition': netSalary += amt; break;
        case 'subtraction': netSalary -= amt; break;
        case 'multiplication': netSalary = baseVal * amt; break;
        case 'division': netSalary = amt !== 0 ? baseVal / amt : netSalary; break;
        case 'percentage': netSalary += (baseVal * amt) / 100; break;
      }
    });

    netSalary = Number((netSalary - Number(deductions || 0)).toFixed(2));

    // Insert salary
    const result = await client.query(
      `INSERT INTO salaries (
        staff_id, month, basic, hra, ta, other_allowances, deductions,
        net_salary, working_days, present_days, total_hours,
        additional_components, status, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
        $12::jsonb, 'pending', NOW()
      ) RETURNING *,
        (SELECT name FROM staff WHERE id = $1) AS staff_name`,
      [
        staff_id,
        month,
        Number(basic),
        Number(hra),
        Number(ta),
        Number(other_allowances),
        Number(deductions),
        netSalary,
        workingDaysCount,
        Number(present_days || 0),
        Number(total_hours || 0),
        JSON.stringify(additional_components)
      ]
    );

    await client.query('COMMIT');

    // ========== ACTIVITY LOGGING ==========
    // Log salary creation
    await logActivity({
      centre_id: centreId,
      related_type: 'salary',
      related_id: result.rows[0].id,
      action: 'Salary Created',
      description: `Created salary for ${staffRes.rows[0].name} for month ${month} - Net: ₹${netSalary}`,
      performed_by: req.user.id,
      performed_by_role: req.user.role
    });
    // ======================================

    res.status(201).json(result.rows[0]);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create salary error:', err);
    res.status(500).json({
      error: 'Failed to create salary',
      details: err.message,
      code: err.code
    });
  } finally {
    client.release();
  }
});

// PUT /api/salary/salaries/:id - Update salary (admin/superadmin only)
router.put('/salaries/:id', authMiddleware(['admin', 'superadmin']), async (req, res) => {
  const { id } = req.params;
  const { basic, hra, ta, other_allowances, deductions, net_salary, working_days, present_days, total_hours, additional_components } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE salaries SET basic = $1, hra = $2, ta = $3, other_allowances = $4, deductions = $5, net_salary = $6,
       working_days = $7, present_days = $8, total_hours = $9, additional_components = $10, updated_at = NOW()
       WHERE id = $11 AND EXISTS (
         SELECT 1 FROM staff s WHERE s.id = salaries.staff_id AND s.centre_id = $12
       ) RETURNING *, (SELECT name FROM staff WHERE id = salaries.staff_id) AS staff_name`,
      [basic, hra, ta, other_allowances, deductions, net_salary, working_days, present_days, total_hours, additional_components ? JSON.stringify(additional_components) : '[]', id, req.user.centre_id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Salary not found or unauthorized' });
    }
    await client.query('COMMIT');

    // ========== ACTIVITY LOGGING ==========
    // Log salary update
    await logActivity({
      centre_id: req.user.centre_id,
      related_type: 'salary',
      related_id: id,
      action: 'Salary Updated',
      description: `Updated salary record for ${result.rows[0].staff_name}`,
      performed_by: req.user.id,
      performed_by_role: req.user.role
    });
    // ======================================

    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating salary:', {
      message: err.message,
      stack: err.stack,
      query: 'UPDATE salaries SET ... WHERE id = $11 AND EXISTS ...',
      params: { id, basic, hra, ta, other_allowances, deductions, net_salary, working_days, present_days, total_hours, additional_components, centreId: req.user.centre_id },
    });
    res.status(500).json({ error: 'Failed to update salary', details: err.message });
  } finally {
    client.release();
  }
});

// POST /api/salary/salaries/:id/send - Send individual salary (admin/superadmin only)
router.post('/salaries/:id/send', authMiddleware(['admin', 'superadmin']), async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE salaries SET status = 'sent', sent_date = NOW()
       WHERE id = $1 AND EXISTS (
         SELECT 1 FROM staff s WHERE s.id = salaries.staff_id AND s.centre_id = $2
       ) RETURNING *, (SELECT name FROM staff WHERE id = salaries.staff_id) AS staff_name`,
      [id, req.user.centre_id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Salary not found or unauthorized' });
    }
    // TODO: Integrate WhatsApp/email notification (e.g., using Libromi API from servicetracking.js)
    await client.query('COMMIT');

    // ========== ACTIVITY LOGGING ==========
    // Log salary sent
    await logActivity({
      centre_id: req.user.centre_id,
      related_type: 'salary',
      related_id: id,
      action: 'Salary Sent',
      description: `Sent salary to ${result.rows[0].staff_name} for month ${result.rows[0].month}`,
      performed_by: req.user.id,
      performed_by_role: req.user.role
    });
    // ======================================

    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error sending salary:', {
      message: err.message,
      stack: err.stack,
      query: 'UPDATE salaries SET ... WHERE id = $1 AND EXISTS ...',
      params: { id, centreId: req.user.centre_id },
    });
    res.status(500).json({ error: 'Failed to send salary', details: err.message });
  } finally {
    client.release();
  }
});

// POST /api/salary/salaries/bulk-send - Bulk send for month (admin/superadmin only)
router.post('/salaries/bulk-send', authMiddleware(['admin', 'superadmin']), async (req, res) => {
  const { month } = req.body;
  const centreId = req.user.role === 'admin' ? req.user.centre_id : req.body.centre_id;
  const client = await pool.connect();
  try {
    if (!month) {
      return res.status(400).json({ error: 'Month is required' });
    }
    if (!centreId) {
      return res.status(400).json({ error: 'Centre ID is required' });
    }
    await client.query('BEGIN');
    const centreCheck = await client.query('SELECT id FROM centres WHERE id = $1', [centreId]);
    if (centreCheck.rows.length === 0) {
      return res.status(400).json({ error: `Centre ID ${centreId} does not exist` });
    }
    const result = await client.query(
      `UPDATE salaries s SET status = 'sent', sent_date = NOW()
       FROM staff st
       WHERE s.staff_id = st.id AND st.centre_id = $1 AND s.month = $2 AND s.status = 'pending'
       RETURNING s.*, (SELECT name FROM staff WHERE id = s.staff_id) AS staff_name`,
      [centreId, month]
    );
    // TODO: Bulk notifications
    await client.query('COMMIT');

    // ========== ACTIVITY LOGGING ==========
    // Log bulk salary send
    await logActivity({
      centre_id: centreId,
      related_type: 'salary',
      related_id: null,
      action: 'Bulk Salaries Sent',
      description: `Sent ${result.rows.length} salaries for month ${month}`,
      performed_by: req.user.id,
      performed_by_role: req.user.role
    });
    // ======================================

    res.json(result.rows);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error bulk sending salaries:', {
      message: err.message,
      stack: err.stack,
      query: 'UPDATE salaries s SET ... FROM staff st WHERE ...',
      params: { centreId: centreId || 'undefined', month },
    });
    res.status(500).json({ error: 'Failed to bulk send salaries', details: err.message });
  } finally {
    client.release();
  }
});

// GET /api/salary/calendar - Get calendar events (staff sees their centre's events)
router.get('/calendar', async (req, res) => {
  const centreId = req.user.role === 'staff' ? req.user.centre_id : (req.user.role === 'admin' ? req.user.centre_id : req.query.centre_id);
  const client = await pool.connect();
  try {
    if (!centreId) {
      return res.status(400).json({ error: 'Centre ID is required' });
    }
    const centreCheck = await client.query('SELECT id FROM centres WHERE id = $1', [centreId]);
    if (centreCheck.rows.length === 0) {
      return res.status(400).json({ error: `Centre ID ${centreId} does not exist` });
    }
    const result = await client.query(
      `SELECT *, TO_CHAR(date, 'YYYY-MM-DD') AS formatted_date FROM calendar_events WHERE centre_id = $1 ORDER BY calendar_events.date ASC`,
      [centreId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching calendar:', {
      message: err.message,
      stack: err.stack,
      query: 'SELECT *, TO_CHAR(date, \'YYYY-MM-DD\') AS formatted_date FROM calendar_events WHERE centre_id = $1 ORDER BY calendar_events.date ASC',
      params: { centreId: centreId || 'undefined' },
    });
    res.status(500).json({ error: 'Failed to fetch calendar', details: err.message });
  } finally {
    client.release();
  }
});

// POST /api/salary/calendar - Add calendar event (admin/superadmin only)
router.post('/calendar', authMiddleware(['admin', 'superadmin']), async (req, res) => {
  const { date, type, description } = req.body;
  const centreId = req.user.role === 'admin' ? req.user.centre_id : req.body.centre_id;
  const client = await pool.connect();
  try {
    if (!date || !type) {
      return res.status(400).json({ error: 'Date and type are required' });
    }
    if (!centreId) {
      return res.status(400).json({ error: 'Centre ID is required' });
    }
    await client.query('BEGIN');
    const centreCheck = await client.query('SELECT id FROM centres WHERE id = $1', [centreId]);
    if (centreCheck.rows.length === 0) {
      return res.status(400).json({ error: `Centre ID ${centreId} does not exist` });
    }
    const result = await client.query(
      `INSERT INTO calendar_events (date, type, description, centre_id, created_at)
       VALUES ($1, $2, $3, $4, NOW()) RETURNING *, TO_CHAR(date, 'YYYY-MM-DD') AS formatted_date`,
      [date, type, description, centreId]
    );
    await client.query('COMMIT');

    // ========== ACTIVITY LOGGING ==========
    // Log calendar event creation
    await logActivity({
      centre_id: centreId,
      related_type: 'calendar',
      related_id: result.rows[0].id,
      action: 'Calendar Event Created',
      description: `Created ${type} event for ${new Date(date).toLocaleDateString()}${description ? `: ${description}` : ''}`,
      performed_by: req.user.id,
      performed_by_role: req.user.role
    });
    // ======================================

    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error adding calendar event:', {
      message: err.message,
      stack: err.stack,
      query: 'INSERT INTO calendar_events ...',
      params: { date, type, description, centreId: centreId || 'undefined' },
    });
    res.status(500).json({ error: 'Failed to add calendar event', details: err.message });
  } finally {
    client.release();
  }
});

// PUT /api/salary/calendar/:id - Update calendar event (admin/superadmin only)
router.put('/calendar/:id', authMiddleware(['admin', 'superadmin']), async (req, res) => {
  const { id } = req.params;
  const { date, type, description } = req.body;
  const centreId = req.user.role === 'admin' ? req.user.centre_id : req.body.centre_id;
  const client = await pool.connect();
  try {
    if (!date || !type) {
      return res.status(400).json({ error: 'Date and type are required' });
    }
    if (!centreId) {
      return res.status(400).json({ error: 'Centre ID is required' });
    }
    await client.query('BEGIN');
    const centreCheck = await client.query('SELECT id FROM centres WHERE id = $1', [centreId]);
    if (centreCheck.rows.length === 0) {
      return res.status(400).json({ error: `Centre ID ${centreId} does not exist` });
    }
    const result = await client.query(
      `UPDATE calendar_events SET date = $1, type = $2, description = $3
       WHERE id = $4 AND centre_id = $5
       RETURNING *, TO_CHAR(date, 'YYYY-MM-DD') AS formatted_date`,
      [date, type, description, id, centreId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Calendar event not found or unauthorized' });
    }
    await client.query('COMMIT');

    // ========== ACTIVITY LOGGING ==========
    // Log calendar event update
    await logActivity({
      centre_id: centreId,
      related_type: 'calendar',
      related_id: id,
      action: 'Calendar Event Updated',
      description: `Updated ${type} event for ${new Date(date).toLocaleDateString()}`,
      performed_by: req.user.id,
      performed_by_role: req.user.role
    });
    // ======================================

    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating calendar event:', {
      message: err.message,
      stack: err.stack,
      query: 'UPDATE calendar_events ...',
      params: { id, date, type, description, centreId: centreId || 'undefined' },
    });
    res.status(500).json({ error: 'Failed to update calendar event', details: err.message });
  } finally {
    client.release();
  }
});

// DELETE /api/salary/calendar/:id - Delete calendar event (admin/superadmin only)
router.delete('/calendar/:id', authMiddleware(['admin', 'superadmin']), async (req, res) => {
  const { id } = req.params;
  const centreId = req.user.role === 'admin' ? req.user.centre_id : req.query.centre_id;
  const client = await pool.connect();
  try {
    if (!centreId) {
      return res.status(400).json({ error: 'Centre ID is required' });
    }
    await client.query('BEGIN');
    const centreCheck = await client.query('SELECT id FROM centres WHERE id = $1', [centreId]);
    if (centreCheck.rows.length === 0) {
      return res.status(400).json({ error: `Centre ID ${centreId} does not exist` });
    }
    
    // Get event details before deletion for logging
    const eventDetails = await client.query(
      'SELECT date, type, description FROM calendar_events WHERE id = $1 AND centre_id = $2',
      [id, centreId]
    );
    
    const result = await client.query(
      `DELETE FROM calendar_events WHERE id = $1 AND centre_id = $2 RETURNING *`,
      [id, centreId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Calendar event not found or unauthorized' });
    }
    await client.query('COMMIT');

    // ========== ACTIVITY LOGGING ==========
    // Log calendar event deletion
    if (eventDetails.rows.length > 0) {
      const event = eventDetails.rows[0];
      await logActivity({
        centre_id: centreId,
        related_type: 'calendar',
        related_id: id,
        action: 'Calendar Event Deleted',
        description: `Deleted ${event.type} event for ${new Date(event.date).toLocaleDateString()}`,
        performed_by: req.user.id,
        performed_by_role: req.user.role
      });
    }
    // ======================================

    res.json({ message: 'Calendar event deleted successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error deleting calendar event:', {
      message: err.message,
      stack: err.stack,
      query: 'DELETE FROM calendar_events ...',
      params: { id, centreId: centreId || 'undefined' },
    });
    res.status(500).json({ error: 'Failed to delete calendar event', details: err.message });
  } finally {
    client.release();
  }
});

// Schedule based routes
router.get("/schedule/:id", authMiddleware(["admin", "superadmin", "staff"]), async (req, res) => {
  const { id } = req.params;
  const { date } = req.query;
  const targetDate = date || new Date().toISOString().split("T")[0];

  const client = await pool.connect();
  try {
    // Authorization check
    if (req.user.role === 'staff' && req.user.id != id) {
      return res.status(403).json({ error: 'Unauthorized to access this staff member' });
    }
    
    if (req.user.role === 'admin') {
      const staffRes = await client.query(
        "SELECT centre_id FROM staff WHERE id = $1",
        [id]
      );
      if (staffRes.rows.length === 0) {
        return res.status(404).json({ error: "Staff not found" });
      }
      if (staffRes.rows[0].centre_id !== req.user.centre_id) {
        return res.status(403).json({ error: "Unauthorized" });
      }
    }

    const staffRes = await client.query(
      "SELECT role FROM staff WHERE id = $1",
      [id]
    );
    if (staffRes.rows.length === 0) return res.status(404).json({ error: "Staff not found" });

    const { role } = staffRes.rows[0];
    if (role === "superadmin") return res.json({});   // no schedule

    const schRes = await client.query(
      `
      SELECT start_time, end_time, standard_hours, effective_from::text
      FROM staff_schedules
      WHERE staff_id = $1
        AND effective_from <= $2
        AND (effective_to IS NULL OR effective_to >= $2)
      ORDER BY effective_from DESC
      LIMIT 1
      `,
      [id, targetDate]
    );

    res.json(schRes.rows[0] || {});
  } catch (err) {
    console.error("GET /schedule/:id error:", err);
    res.status(500).json({ error: "Failed to fetch schedule" });
  } finally {
    client.release();
  }
});

// ---------------------------------------------------------------
// GET /api/salary/auto-calc?staff_id=45&month=2025-10
// Returns: { working_days, present_days, total_hours }
// ---------------------------------------------------------------
// ---- WORKING DAYS FROM CALENDAR ----
const getWorkingDaysCount = async (client, staffId, month) => {
  const [year, mon] = month.split('-');
  const first = `${year}-${mon}-01`;
  const last  = new Date(year, mon, 0).toISOString().slice(0,10);

  const cal = await client.query(`
    SELECT COUNT(*) as cnt
    FROM calendar_events
    WHERE date BETWEEN $1 AND $2
      AND type = 'working'
  `, [first, last]);

  return parseInt(cal.rows[0].cnt, 10);
};

// ---- PRESENT DAYS ----
const getPresentDaysCount = async (client, staffId, month) => {
  const res = await client.query(`
    SELECT COUNT(*) as cnt
    FROM attendance
    WHERE staff_id = $1
      AND TO_CHAR(date,'YYYY-MM') = $2
      AND status = 'present'
  `, [staffId, month]);
  return parseInt(res.rows[0].cnt, 10);
};

// ---- TOTAL HOURS ----
const getTotalHours = async (client, staffId, month) => {
  const res = await client.query(`
    SELECT COALESCE(SUM(hours),0) as total
    FROM attendance
    WHERE staff_id = $1
      AND TO_CHAR(date,'YYYY-MM') = $2
      AND status = 'present'
  `, [staffId, month]);
  return Number(res.rows[0].total).toFixed(2);
};

router.get('/auto-calc', authMiddleware(["admin", "superadmin", "staff"]), async (req, res) => {
  const { staff_id, month } = req.query;
  if (!staff_id || !month) {
    return res.status(400).json({ error: 'staff_id and month required' });
  }

  const client = await pool.connect();
  try {
    const [wd, pd, th] = await Promise.all([
      getWorkingDaysCount(client, staff_id, month),
      getPresentDaysCount(client, staff_id, month),
      getTotalHours(client, staff_id, month),
    ]);

    res.json({ working_days: wd, present_days: pd, total_hours: th });
  } catch (err) {
    console.error('Auto-calc error:', err);
    res.status(500).json({ error: 'Failed to calculate' });
  } finally {
    client.release();
  }
});

// GET /api/centres - SuperAdmin only
router.get('/centres', authMiddleware(["superadmin"]), async (req, res) => {
  try {
    const result = await req.db.query('SELECT * FROM centres ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching centres:', err);
    res.status(500).json({ error: 'Failed to fetch centres' });
  }
});

// =====================================================================
// SUPER ADMIN ROUTES
// =====================================================================

// Helper function to check if center exists
const checkCenterExists = async (client, centerId) => {
  const result = await client.query('SELECT id, name FROM centres WHERE id = $1', [centerId]);
  return result.rows[0];
};

// GET /api/salary/centers - Get all centers (superadmin only)
router.get('/centers', authMiddleware(['superadmin']), async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT 
        c.id,
        c.name,
        c.created_by AS "createdBy",
        c.admin_id AS "adminId",
        c.created_at AS "createdAt",
        COUNT(DISTINCT s.id) AS "staffCount",
        COUNT(DISTINCT CASE WHEN s.status = 'Active' THEN s.id END) AS "activeStaff",
        COALESCE(SUM(sal.net_salary), 0) AS "totalSalary"
       FROM centres c
       LEFT JOIN staff s ON c.id = s.centre_id
       LEFT JOIN (
         SELECT staff_id, net_salary 
         FROM salaries 
         WHERE month = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
       ) sal ON s.id = sal.staff_id
       GROUP BY c.id, c.name, c.created_by, c.admin_id, c.created_at
       ORDER BY c.name`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching centers:', err);
    res.status(500).json({ error: 'Failed to fetch centers', details: err.message });
  } finally {
    client.release();
  }
});

// GET /api/salary/centers/:centerId/staff - Get staff by center (superadmin only)
router.get('/centers/:centerId/staff', authMiddleware(['superadmin']), async (req, res) => {
  const { centerId } = req.params;
  const client = await pool.connect();
  try {
    // Check if center exists
    const center = await checkCenterExists(client, centerId);
    if (!center) {
      return res.status(404).json({ error: 'Center not found' });
    }

    // Get staff
    const result = await client.query(
      `SELECT 
        s.id,
        s.username,
        s.name,
        s.role,
        s.department,
        s.email,
        s.phone,
        s.status,
        s.join_date AS "joinDate",
        s.photo,
        s.employee_id AS "employeeId",
        s.employment_type AS "employmentType",
        s.reports_to AS "reportsTo",
        COALESCE(CAST(s.salary AS NUMERIC), 0) AS salary,
        s.dob AS "dateOfBirth",
        s.gender,
        s.emergency_contact AS "emergencyContact",
        s.emergency_relationship AS "emergencyRelationship",
        s.centre_id AS "centreId",
        s.last_login AS "lastLogin",
        s.permissions,
        s.created_at AS "createdAt"
       FROM staff s
       WHERE s.centre_id = $1
       ORDER BY s.name`,
      [centerId]
    );
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching staff by center:', err);
    res.status(500).json({ error: 'Failed to fetch staff', details: err.message });
  } finally {
    client.release();
  }
});

// GET /api/salary/centers/:centerId/attendance - Get attendance by center (superadmin only)
router.get('/centers/:centerId/attendance', authMiddleware(['superadmin']), async (req, res) => {
  const { centerId } = req.params;
  const { month } = req.query;
  const client = await pool.connect();
  try {
    if (!month) {
      return res.status(400).json({ error: 'Month parameter is required' });
    }

    // Check if center exists
    const center = await checkCenterExists(client, centerId);
    if (!center) {
      return res.status(404).json({ error: 'Center not found' });
    }

    const result = await client.query(
      `SELECT 
        a.id,
        a.staff_id,
        TO_CHAR(a.date, 'YYYY-MM-DD') AS date,
        a.punch_in,
        a.punch_out,
        a.breaks,
        a.hours,
        a.status,
        a.late_minutes,
        a.extra_minutes,
        s.name AS staff_name,
        s.employee_id AS "employeeId"
       FROM attendance a
       JOIN staff s ON a.staff_id = s.id
       WHERE s.centre_id = $1 AND TO_CHAR(a.date, 'YYYY-MM') = $2
       ORDER BY a.date DESC, s.name`,
      [centerId, month]
    );
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching attendance by center:', err);
    res.status(500).json({ error: 'Failed to fetch attendance', details: err.message });
  } finally {
    client.release();
  }
});

// GET /api/salary/centers/:centerId/leaves - Get leaves by center (superadmin only)
router.get('/centers/:centerId/leaves', authMiddleware(['superadmin']), async (req, res) => {
  const { centerId } = req.params;
  const { month } = req.query;
  const client = await pool.connect();
  
  try {
    // Check if center exists
    const center = await checkCenterExists(client, centerId);
    if (!center) {
      return res.status(404).json({ error: 'Center not found' });
    }

    let query = `
      SELECT 
        l.*,
        s.name AS staff_name,
        s.department,
        s.employee_id AS "employeeId",
        TO_CHAR(l.applied_date, 'YYYY-MM-DD') AS applied_date
      FROM leaves l
      JOIN staff s ON l.staff_id = s.id
      WHERE s.centre_id = $1
    `;
    const params = [centerId];
    let paramIndex = 2;

    // Add month filter if provided
    if (month) {
      const monthStart = `${month}-01`;
      query += ` 
        AND l.from_date <= DATE_TRUNC('month', $${paramIndex}::date) + interval '1 month' - interval '1 day'
        AND l.to_date >= DATE_TRUNC('month', $${paramIndex}::date)`;
      params.push(monthStart);
      paramIndex++;
    }

    query += ` ORDER BY l.applied_date DESC`;

    const result = await client.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching leaves by center:', err);
    res.status(500).json({ error: 'Failed to fetch leaves', details: err.message });
  } finally {
    client.release();
  }
});

// GET /api/salary/centers/:centerId/leaves/pending - Get pending leaves by center (superadmin only)
router.get('/centers/:centerId/leaves/pending', authMiddleware(['superadmin']), async (req, res) => {
  const { centerId } = req.params;
  const client = await pool.connect();
  
  try {
    // Check if center exists
    const center = await checkCenterExists(client, centerId);
    if (!center) {
      return res.status(404).json({ error: 'Center not found' });
    }

    const result = await client.query(
      `SELECT 
        l.*,
        s.name AS staff_name,
        s.department,
        s.employee_id AS "employeeId"
      FROM leaves l
      JOIN staff s ON l.staff_id = s.id
      WHERE s.centre_id = $1 AND l.status = 'pending'
      ORDER BY l.applied_date DESC`,
      [centerId]
    );
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching pending leaves by center:', err);
    res.status(500).json({ error: 'Failed to fetch pending leaves', details: err.message });
  } finally {
    client.release();
  }
});

// GET /api/salary/centers/:centerId/salaries - Get salaries by center (superadmin only)
router.get('/centers/:centerId/salaries', authMiddleware(['superadmin']), async (req, res) => {
  const { centerId } = req.params;
  const { month } = req.query;
  const client = await pool.connect();
  try {
    // Check if center exists
    const center = await checkCenterExists(client, centerId);
    if (!center) {
      return res.status(404).json({ error: 'Center not found' });
    }

    let query = `
      SELECT 
        s.*,
        st.name AS staff_name,
        st.employee_id AS "employeeId",
        TO_CHAR(s.sent_date, 'YYYY-MM-DD') AS sent_date
      FROM salaries s
      JOIN staff st ON s.staff_id = st.id
      WHERE st.centre_id = $1
    `;
    const params = [centerId];
    
    if (month) {
      query += ` AND s.month = $2`;
      params.push(month);
    }
    
    query += ` ORDER BY s.month DESC, st.name`;
    
    const result = await client.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching salaries by center:', err);
    res.status(500).json({ error: 'Failed to fetch salaries', details: err.message });
  } finally {
    client.release();
  }
});

// GET /api/salary/centers/:centerId/calendar - Get calendar by center (superadmin only)
router.get('/centers/:centerId/calendar', authMiddleware(['superadmin']), async (req, res) => {
  const { centerId } = req.params;
  const client = await pool.connect();
  try {
    // Check if center exists
    const center = await checkCenterExists(client, centerId);
    if (!center) {
      return res.status(404).json({ error: 'Center not found' });
    }

    const result = await client.query(
      `SELECT 
        *,
        TO_CHAR(date, 'YYYY-MM-DD') AS formatted_date 
       FROM calendar_events 
       WHERE centre_id = $1 
       ORDER BY date ASC`,
      [centerId]
    );
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching calendar by center:', err);
    res.status(500).json({ error: 'Failed to fetch calendar', details: err.message });
  } finally {
    client.release();
  }
});

// GET /api/salary/super-admin/stats - Get overall statistics (superadmin only)
router.get('/super-admin/stats', authMiddleware(['superadmin']), async (req, res) => {
  const client = await pool.connect();
  try {
    // Get total centers
    const centersResult = await client.query(
      `SELECT COUNT(*) as total_centers FROM centres`
    );
    
    // Get total staff
    const staffResult = await client.query(
      `SELECT 
        COUNT(*) as total_staff,
        COUNT(CASE WHEN status = 'Active' THEN 1 END) as active_staff
       FROM staff`
    );
    
    // Get total payroll for current month
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const salaryResult = await client.query(
      `SELECT COALESCE(SUM(net_salary), 0) as total_salary
       FROM salaries 
       WHERE month = $1`,
      [currentMonth]
    );
    
    // Get today's attendance rate
    const today = new Date().toISOString().split('T')[0];
    const todayAttendanceResult = await client.query(
      `SELECT 
        COUNT(DISTINCT a.staff_id) as present_today,
        (SELECT COUNT(*) FROM staff WHERE status = 'Active') as total_active
       FROM attendance a
       JOIN staff s ON a.staff_id = s.id
       WHERE a.date = $1 AND a.status = 'present'`,
      [today]
    );
    
    // Get pending leaves
    const pendingLeavesResult = await client.query(
      `SELECT COUNT(*) as pending_leaves
       FROM leaves l
       JOIN staff s ON l.staff_id = s.id
       WHERE l.status = 'pending'`
    );
    
    const stats = {
      totalCenters: parseInt(centersResult.rows[0].total_centers),
      totalStaff: parseInt(staffResult.rows[0].total_staff),
      activeStaff: parseInt(staffResult.rows[0].active_staff),
      totalSalary: parseFloat(salaryResult.rows[0].total_salary),
      attendanceRate: todayAttendanceResult.rows[0].total_active > 0 
        ? Math.round((todayAttendanceResult.rows[0].present_today / todayAttendanceResult.rows[0].total_active) * 100)
        : 0,
      pendingLeaves: parseInt(pendingLeavesResult.rows[0].pending_leaves)
    };
    
    res.json(stats);
  } catch (err) {
    console.error('Error fetching overall stats:', err);
    res.status(500).json({ error: 'Failed to fetch statistics', details: err.message });
  } finally {
    client.release();
  }
});

// GET /api/salary/super-admin/centers-summary - Get center-wise summary (superadmin only)
router.get('/super-admin/centers-summary', authMiddleware(['superadmin']), async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT 
        c.id AS "centerId",
        c.name AS "centerName",
        COUNT(DISTINCT s.id) AS "staffCount",
        COUNT(DISTINCT CASE WHEN s.status = 'Active' THEN s.id END) AS "activeStaff",
        COALESCE(SUM(sal.net_salary), 0) AS "totalSalary",
        COALESCE(ROUND(AVG(CASE 
          WHEN a.status = 'present' AND a.date = CURRENT_DATE THEN 1 
          ELSE 0 
        END) * 100, 0), 0) AS "attendanceRate"
       FROM centres c
       LEFT JOIN staff s ON c.id = s.centre_id
       LEFT JOIN (
         SELECT staff_id, month, net_salary 
         FROM salaries 
         WHERE month = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
       ) sal ON s.id = sal.staff_id
       LEFT JOIN attendance a ON s.id = a.staff_id
       GROUP BY c.id, c.name
       ORDER BY c.name`
    );
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching centers summary:', err);
    res.status(500).json({ error: 'Failed to fetch centers summary', details: err.message });
  } finally {
    client.release();
  }
});

// PUT /api/salary/centers/:centerId/attendance/:id - Update attendance for specific center (superadmin only)
router.put('/centers/:centerId/attendance/:id', authMiddleware(['superadmin']), async (req, res) => {
  const { centerId, id } = req.params;
  const { punch_in, punch_out, breaks, status, hours } = req.body;
  const client = await pool.connect();
  try {
    // Check if center exists
    const center = await checkCenterExists(client, centerId);
    if (!center) {
      return res.status(404).json({ error: 'Center not found' });
    }

    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE attendance 
       SET punch_in = $1, punch_out = $2, breaks = $3, status = $4, hours = $5, updated_at = NOW()
       WHERE id = $6 AND EXISTS (
         SELECT 1 FROM staff s WHERE s.id = attendance.staff_id AND s.centre_id = $7
       )
       RETURNING *, TO_CHAR(date, 'YYYY-MM-DD') AS date, staff_id`,
      [punch_in, punch_out, breaks, status, hours, id, centerId]
    );
    
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Attendance not found or unauthorized' });
    }

    const { staff_id, date } = result.rows[0];
    await recalculateDayDeviation(client, staff_id, date);

    await client.query('COMMIT');
    const final = await client.query('SELECT * FROM attendance WHERE id = $1', [id]);
    res.json(final.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Update attendance error for center:', err);
    res.status(500).json({ error: 'Failed to update attendance', details: err.message });
  } finally {
    client.release();
  }
});

// PUT /api/salary/centers/:centerId/leaves/:id - Update leave status for specific center (superadmin only)
router.put('/centers/:centerId/leaves/:id',authMiddleware(['superadmin']), async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const result = await req.db.query(
      `
      UPDATE leaves
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
      `,
      [status, id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Leave not found' });
    }

    // ========== ACTIVITY LOGGING ==========
    // Log leave approval/rejection for superadmin
    await logActivity({
      centre_id: centerId,
      related_type: 'leave',
      related_id: id,
      action: status === 'approved' ? 'Leave Approved' : 'Leave Rejected',
      description: `Superadmin ${status === 'approved' ? 'approved' : 'rejected'} leave request`,
      performed_by: req.user.id,
      performed_by_role: req.user.role
    });
    // ======================================

    res.json(result.rows[0]);
  }
);

// POST /api/salary/centers/:centerId/salaries - Create salary for specific center (superadmin only)
router.post('/centers/:centerId/salaries', authMiddleware(['superadmin']), async (req, res) => {
  const { centerId } = req.params;
  const {
    staff_id,
    month,
    basic,
    hra = 0,
    ta = 0,
    other_allowances = 0,
    deductions = 0,
    additional_components = []
  } = req.body;

  const client = await pool.connect();

  try {
    // Validation
    if (!staff_id || !month || basic === undefined) {
      return res.status(400).json({ error: 'staff_id, month, and basic are required' });
    }

    // Check if center exists
    const center = await checkCenterExists(client, centerId);
    if (!center) {
      return res.status(404).json({ error: 'Center not found' });
    }

    await client.query('BEGIN');

    // Get staff info
    const staffRes = await client.query(
      'SELECT centre_id, name FROM staff WHERE id = $1',
      [staff_id]
    );
    if (staffRes.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid staff_id' });
    }

    // Check if staff belongs to the specified center
    if (staffRes.rows[0].centre_id !== parseInt(centerId)) {
      return res.status(400).json({ error: 'Staff does not belong to this center' });
    }

    // Prevent duplicate salary for same staff + month
    const exists = await client.query(
      'SELECT id FROM salaries WHERE staff_id = $1 AND month = $2',
      [staff_id, month]
    );
    if (exists.rows.length > 0) {
      return res.status(400).json({ error: `Salary already exists for ${month}` });
    }

    // Auto-calculate from attendance
    const autoCalc = await client.query(
      `SELECT 
         COUNT(*) FILTER (WHERE status = 'present') AS present_days,
         COALESCE(SUM(hours), 0) AS total_hours
       FROM attendance 
       WHERE staff_id = $1 
         AND TO_CHAR(date, 'YYYY-MM') = $2`,
      [staff_id, month]
    );

    const { present_days, total_hours } = autoCalc.rows[0];
    const working_days = await client.query(
      `SELECT COUNT(*) AS cnt
       FROM calendar_events 
       WHERE centre_id = $1 
         AND TO_CHAR(date, 'YYYY-MM') = $2 
         AND type = 'working'`,
      [centerId, month]
    );

    const workingDaysCount = parseInt(working_days.rows[0].cnt || 0);

    // Calculate net salary in backend (trusted source)
    const baseSalary = Number(basic) + Number(hra) + Number(ta) + Number(other_allowances);
    let netSalary = baseSalary;

    // Apply additional components
    additional_components.forEach(comp => {
      const amt = Number(comp.amount) || 0;
      const baseVal = comp.base === 'basic' ? Number(basic) : netSalary;
      switch (comp.operation) {
        case 'addition': netSalary += amt; break;
        case 'subtraction': netSalary -= amt; break;
        case 'multiplication': netSalary = baseVal * amt; break;
        case 'division': netSalary = amt !== 0 ? baseVal / amt : netSalary; break;
        case 'percentage': netSalary += (baseVal * amt) / 100; break;
      }
    });

    netSalary = Number((netSalary - Number(deductions || 0)).toFixed(2));

    // Insert salary
    const result = await client.query(
      `INSERT INTO salaries (
        staff_id, month, basic, hra, ta, other_allowances, deductions,
        net_salary, working_days, present_days, total_hours,
        additional_components, status, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
        $12::jsonb, 'pending', NOW()
      ) RETURNING *,
        (SELECT name FROM staff WHERE id = $1) AS staff_name`,
      [
        staff_id,
        month,
        Number(basic),
        Number(hra),
        Number(ta),
        Number(other_allowances),
        Number(deductions),
        netSalary,
        workingDaysCount,
        Number(present_days || 0),
        Number(total_hours || 0),
        JSON.stringify(additional_components)
      ]
    );

    await client.query('COMMIT');

    // ========== ACTIVITY LOGGING ==========
    // Log salary creation for superadmin
    await logActivity({
      centre_id: parseInt(centerId),
      related_type: 'salary',
      related_id: result.rows[0].id,
      action: 'Salary Created',
      description: `Superadmin created salary for ${staffRes.rows[0].name} for month ${month} - Net: ₹${netSalary}`,
      performed_by: req.user.id,
      performed_by_role: req.user.role
    });
    // ======================================

    res.status(201).json(result.rows[0]);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create salary error for center:', err);
    res.status(500).json({
      error: 'Failed to create salary',
      details: err.message,
      code: err.code
    });
  } finally {
    client.release();
  }
});

// PUT /api/salary/centers/:centerId/salaries/:id - Update salary for specific center (superadmin only)
router.put('/centers/:centerId/salaries/:id', authMiddleware(['superadmin']), async (req, res) => {
  const { centerId, id } = req.params;
  const { basic, hra, ta, other_allowances, deductions, net_salary, working_days, present_days, total_hours, additional_components } = req.body;
  const client = await pool.connect();
  try {
    // Check if center exists
    const center = await checkCenterExists(client, centerId);
    if (!center) {
      return res.status(404).json({ error: 'Center not found' });
    }

    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE salaries SET basic = $1, hra = $2, ta = $3, other_allowances = $4, deductions = $5, net_salary = $6,
       working_days = $7, present_days = $8, total_hours = $9, additional_components = $10, updated_at = NOW()
       WHERE id = $11 AND EXISTS (
         SELECT 1 FROM staff s WHERE s.id = salaries.staff_id AND s.centre_id = $12
       )
       RETURNING *, (SELECT name FROM staff WHERE id = salaries.staff_id) AS staff_name`,
      [basic, hra, ta, other_allowances, deductions, net_salary, working_days, present_days, total_hours, additional_components ? JSON.stringify(additional_components) : '[]', id, centerId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Salary not found or unauthorized' });
    }
    
    await client.query('COMMIT');

    // ========== ACTIVITY LOGGING ==========
    // Log salary update for superadmin
    await logActivity({
      centre_id: parseInt(centerId),
      related_type: 'salary',
      related_id: id,
      action: 'Salary Updated',
      description: `Superadmin updated salary record for ${result.rows[0].staff_name}`,
      performed_by: req.user.id,
      performed_by_role: req.user.role
    });
    // ======================================

    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating salary for center:', err);
    res.status(500).json({ error: 'Failed to update salary', details: err.message });
  } finally {
    client.release();
  }
});

// POST /api/salary/centers/:centerId/salaries/:id/send - Send salary for specific center (superadmin only)
router.post('/centers/:centerId/salaries/:id/send', authMiddleware(['superadmin']), async (req, res) => {
  const { centerId, id } = req.params;
  const client = await pool.connect();
  try {
    // Check if center exists
    const center = await checkCenterExists(client, centerId);
    if (!center) {
      return res.status(404).json({ error: 'Center not found' });
    }

    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE salaries SET status = 'sent', sent_date = NOW()
       WHERE id = $1 AND EXISTS (
         SELECT 1 FROM staff s WHERE s.id = salaries.staff_id AND s.centre_id = $2
       )
       RETURNING *, (SELECT name FROM staff WHERE id = salaries.staff_id) AS staff_name`,
      [id, centerId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Salary not found or unauthorized' });
    }
    
    await client.query('COMMIT');

    // ========== ACTIVITY LOGGING ==========
    // Log salary sent for superadmin
    await logActivity({
      centre_id: parseInt(centerId),
      related_type: 'salary',
      related_id: id,
      action: 'Salary Sent',
      description: `Superadmin sent salary to ${result.rows[0].staff_name} for month ${result.rows[0].month}`,
      performed_by: req.user.id,
      performed_by_role: req.user.role
    });
    // ======================================

    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error sending salary for center:', err);
    res.status(500).json({ error: 'Failed to send salary', details: err.message });
  } finally {
    client.release();
  }
});

// POST /api/salary/centers/:centerId/salaries/bulk-send - Bulk send salaries for specific center (superadmin only)
router.post('/centers/:centerId/salaries/bulk-send', authMiddleware(['superadmin']), async (req, res) => {
  const { centerId } = req.params;
  const { month } = req.body;
  const client = await pool.connect();
  try {
    if (!month) {
      return res.status(400).json({ error: 'Month is required' });
    }

    // Check if center exists
    const center = await checkCenterExists(client, centerId);
    if (!center) {
      return res.status(404).json({ error: 'Center not found' });
    }

    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE salaries s SET status = 'sent', sent_date = NOW()
       FROM staff st
       WHERE s.staff_id = st.id AND st.centre_id = $1 AND s.month = $2 AND s.status = 'pending'
       RETURNING s.*, (SELECT name FROM staff WHERE id = s.staff_id) AS staff_name`,
      [centerId, month]
    );
    
    await client.query('COMMIT');

    // ========== ACTIVITY LOGGING ==========
    // Log bulk salary send for superadmin
    await logActivity({
      centre_id: parseInt(centerId),
      related_type: 'salary',
      related_id: null,
      action: 'Bulk Salaries Sent',
      description: `Superadmin sent ${result.rows.length} salaries for month ${month}`,
      performed_by: req.user.id,
      performed_by_role: req.user.role
    });
    // ======================================

    res.json(result.rows);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error bulk sending salaries for center:', err);
    res.status(500).json({ error: 'Failed to bulk send salaries', details: err.message });
  } finally {
    client.release();
  }
});

// SUPER ADMIN – delete calendar event (centre-aware)
router.delete('/centers/:centerId/calendar/:id',authMiddleware(['superadmin']), async (req, res) => {
    const { id } = req.params;

    const result = await req.db.query(
      'DELETE FROM calendar_events WHERE id = $1 RETURNING *',
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Calendar event not found' });
    }

    // ========== ACTIVITY LOGGING ==========
    // Log calendar event deletion for superadmin
    await logActivity({
      centre_id: result.rows[0].centre_id,
      related_type: 'calendar',
      related_id: id,
      action: 'Calendar Event Deleted',
      description: `Superadmin deleted calendar event`,
      performed_by: req.user.id,
      performed_by_role: req.user.role
    });
    // ======================================

    res.json({ success: true });
  }
);

export default router;
