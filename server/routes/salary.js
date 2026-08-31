import express from 'express';
import pool from '../db.js';
import { authMiddleware } from './staff.js';
import { logActivity } from "../utils/activityLogger.js";

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
  const { punch_type, time, date, breaks } = req.body;
  const client = await pool.connect();
  
  try {
    if (!punch_type || !date) return res.status(400).json({ error: 'Punch type and date required' });
    if (!['in', 'out'].includes(punch_type)) return res.status(400).json({ error: 'Invalid punch type' });

    await client.query('BEGIN');

    // 1. Get Current Time in HH:mm format for server-side validation
    const now = new Date();
    const serverHHmm = now.toTimeString().split(' ')[0].substring(0, 5); 
    
    let punchTime = time;

    // 2. Strict Validation for Punch In
    if (punch_type === 'in') {
        if (!time) return res.status(400).json({ error: 'Time required for punch-in' });
    
        const serverNow = new Date();
        const serverHHmm = serverNow.toLocaleTimeString('en-GB', { 
            hour: '2-digit', 
            minute: '2-digit', 
            hour12: false, 
            timeZone: 'Asia/Kolkata' 
        });
    
        const [pHT, pMT] = time.split(':').map(Number);
        const [sHT, sMT] = serverHHmm.split(':').map(Number);
        
        const punchMinutes = pHT * 60 + pMT;
        const serverMinutes = sHT * 60 + sMT;
        const diff = Math.abs(serverMinutes - punchMinutes);
    
        if (diff > 30) {
            return res.status(400).json({ 
                error: `Validation Error: Punch time (${time}) differs too much from Server time (${serverHHmm}).` 
            });
        }
    } else {
        const serverNow = new Date();
        punchTime = serverNow.toLocaleTimeString('en-GB', { 
            hour: '2-digit', 
            minute: '2-digit', 
            hour12: false, 
            timeZone: 'Asia/Kolkata' 
        });
    }

    // 3. Check for ANY existing record for today
    const existingAll = await client.query(
      `SELECT id, punch_in, punch_out, status FROM attendance 
       WHERE staff_id = $1 AND date = $2`,
      [req.user.id, date]
    );

    if (punch_type === 'in') {
      if (existingAll.rows.length > 0) {
        const record = existingAll.rows[0];
        
        // OVERRIDE: If previously marked absent/half-day from a leave, convert to present
        if ((record.status === 'absent' || record.status === 'half-day') && record.punch_in === null) {
          const result = await client.query(
            `UPDATE attendance 
             SET punch_in = $1, status = 'present', updated_at = NOW() 
             WHERE id = $2 
             RETURNING *, TO_CHAR(date, 'YYYY-MM-DD') AS date`,
            [punchTime, record.id]
          );
          await client.query('COMMIT');
          return res.status(201).json(result.rows[0]);
        } 
        
        // standard validation for duplicates
        if (record.punch_out === null) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Already punched in. Please punch out first.' });
        } else {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Attendance already completed for today.' });
        }
      }
      
      // If no record exists at all, normal INSERT
      const result = await client.query(
        `INSERT INTO attendance (staff_id, date, punch_in, status, created_at)
         VALUES ($1, $2, $3, 'present', NOW()) 
         RETURNING *, TO_CHAR(date, 'YYYY-MM-DD') AS date`,
        [req.user.id, date, punchTime]
      );
      
      await client.query('COMMIT');
      return res.status(201).json(result.rows[0]);

    } else {
      // PUNCH OUT Logic
      const openRecord = existingAll.rows.find(r => r.punch_out === null && r.punch_in !== null);
      if (!openRecord) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'No active punch-in record found for today.' });
      }

      const { id, punch_in } = openRecord;
      const newBreaks = breaks || null;
      const hours = calculateHours(punch_in, punchTime, newBreaks);

      const result = await client.query(
        `UPDATE attendance 
         SET punch_out = $1, breaks = $2, hours = $3, updated_at = NOW()
         WHERE id = $4 
         RETURNING *, TO_CHAR(date, 'YYYY-MM-DD') AS date`,
        [punchTime, newBreaks, hours, id]
      );

      // Recalculate late/extra deviation for the day
      await recalculateDayDeviation(client, req.user.id, date);

      await client.query('COMMIT');
      
      // Fetch fresh data to ensure all calculated fields are included
      const final = await client.query(
        `SELECT *, TO_CHAR(date, 'YYYY-MM-DD') AS date FROM attendance WHERE id = $1`, 
        [id]
      );
      return res.json(final.rows[0]);
    }
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    console.error('Punch error details:', err);
    res.status(500).json({ error: 'Internal server error while recording punch.' });
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
      const monthStart = `${month}-01`;
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
  const { type, from_date, to_date, reason, leave_duration = 'full', leave_time = null } = req.body;
  const client = await pool.connect();
  try {
    if (!type || !from_date || !to_date || !reason) {
      return res.status(400).json({ error: 'Type, from_date, to_date, and reason are required' });
    }
    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO leaves (staff_id, type, from_date, to_date, reason, leave_duration, leave_time, status, applied_date, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', CURRENT_DATE, NOW()) RETURNING *, TO_CHAR(applied_date, 'YYYY-MM-DD') AS applied_date`,
      [req.user.id, type, from_date, to_date, reason, leave_duration, leave_time]
    );
    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error submitting leave:', {
      message: err.message,
      stack: err.stack,
      params: { staff_id: req.user.id, type, from_date, to_date, reason, leave_duration, leave_time },
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

    // NEW BLOCK: Automatically mark attendance based on the approved leave
    if (status === 'approved') {
      const leave = result.rows[0];
      const startDate = new Date(leave.from_date);
      const endDate = new Date(leave.to_date);
      
      const attStatus = leave.leave_duration === 'half' ? 'half-day' : 'absent';

      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        
        const existingAtt = await client.query(
          `SELECT id FROM attendance WHERE staff_id = $1 AND date = $2`,
          [leave.staff_id, dateStr]
        );

        if (existingAtt.rows.length > 0) {
          await client.query(
            `UPDATE attendance SET status = $1, updated_at = NOW() WHERE id = $2`,
            [attStatus, existingAtt.rows[0].id]
          );
        } else {
          await client.query(
            `INSERT INTO attendance (staff_id, date, status, created_at)
             VALUES ($1, $2, $3, NOW())`,
            [leave.staff_id, dateStr, attStatus]
          );
        }
      }
    }

    await client.query('COMMIT');

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

// =====================================================================
// 🔥 PAYROLL ENGINE & DATA AGGREGATORS
// =====================================================================
// Helper: Exact Month Attendance
const getPayrollAttendance = async (client, staffId, payrollMonthDate) => {
  const result = await client.query(`
      SELECT 
          COALESCE(SUM(hours), 0) AS worked_hours,
          COUNT(*) FILTER (WHERE status = 'present') AS present_days,
          COALESCE(SUM(late_minutes), 0) AS late_minutes,
          COUNT(*) FILTER (WHERE status ILIKE '%leave%') AS leave_days
      FROM attendance
      WHERE staff_id = $1 
        AND DATE_TRUNC('month', date) = DATE_TRUNC('month', $2::DATE)
  `, [staffId, payrollMonthDate]);
  return result.rows[0];
};

// Helper: Exact Month Service Charges (NO OFFSETS)
const getPayrollCollection = async (client, staffId, payrollMonthDate) => {
  const result = await client.query(`
      WITH target_month AS (
          SELECT DATE_TRUNC('month', $2::DATE)::date as start_date,
                 (DATE_TRUNC('month', $2::DATE) + INTERVAL '1 month' - INTERVAL '1 day')::date as end_date
      )
      SELECT COALESCE(SUM(se.service_charges), 0) AS achieved_revenue
      FROM service_entries se
      CROSS JOIN target_month tm
      WHERE se.staff_id = $1
        -- Matches exactly July 1st to July 31st if July is selected
        AND se.created_at::date BETWEEN tm.start_date AND tm.end_date
  `, [staffId, payrollMonthDate]);
  
  return result.rows[0];
};

// Helper: Schedule active during the exact month
const getPayrollSchedule = async (client, staffId, payrollMonthDate) => {
  const result = await client.query(`
      SELECT standard_hours 
      FROM staff_schedules 
      WHERE staff_id = $1 
        AND effective_from <= (DATE_TRUNC('month', $2::DATE) + INTERVAL '1 month' - INTERVAL '1 day')
        AND (effective_to IS NULL OR effective_to >= DATE_TRUNC('month', $2::DATE))
      ORDER BY effective_from DESC 
      LIMIT 1
  `, [staffId, payrollMonthDate]);
  return result.rows[0] ? parseFloat(result.rows[0].standard_hours) : 9.0;
};

const calculateSalaryRecord = (structure, run, workedHoursRaw, achievedRevenueRaw, bonusSlabs, standardHoursRaw) => {
  const workedHours = Number(workedHoursRaw) || 0;
  const achievedRevenue = Number(achievedRevenueRaw) || 0;
  const standardHours = Number(standardHoursRaw) || 9.0;
  
  const offdays = Number(run.sundays) + Number(run.dl_days) + Number(run.other_offdays);
  const daysTargeted = Number(run.calendar_days) - offdays;
  
  const targetHours = daysTargeted * standardHours;
  const targetRevenue = targetHours * Number(structure.hourly_service_revenue_target || 0); 
  
  const workingHoursPercent = targetHours > 0 ? (workedHours / targetHours) * 100 : 0;
  const revenuePercent = targetRevenue > 0 ? (achievedRevenue / targetRevenue) * 100 : 0;
  
  let bonusPercent = 0;
  for (const slab of bonusSlabs) {
      if (
          workingHoursPercent >= Number(slab.min_working_hours_pct) &&
          (slab.max_working_hours_pct === null || workingHoursPercent < Number(slab.max_working_hours_pct)) &&
          revenuePercent >= Number(slab.min_collection_pct) &&
          (slab.max_collection_pct === null || revenuePercent < Number(slab.max_collection_pct))
      ) {
          bonusPercent = Number(slab.bonus_pct);
          break;
      }
  }

  // 🔥 FIXED: Pass Basic, TA, and FA exactly as configured in the Payroll Config. No prorating!
  const basicPay = Number(structure.basic_salary) || 0;
  const taPay = Number(structure.ta) || 0;
  const faPay = Number(structure.fa) || 0;
  
  // Calculate Bonus only on the surplus revenue above their target
  const surplusRevenue = Math.max(0, achievedRevenue - targetRevenue);
  const bonus = (bonusPercent / 100) * surplusRevenue;
  
  // Total Gross Pay
  const fullPay = basicPay + bonus + taPay + faPay;

  return {
      calculation_version: 'v3_fixed_base',
      snapshot_basic_salary: basicPay,
      snapshot_daily_hours: standardHours,
      snapshot_hourly_target: Number(structure.hourly_service_revenue_target || 0),
      monthly_work_days: daysTargeted,
      total_targeted_hours: targetHours,
      total_monthly_target: targetRevenue,
      total_worked_hours: workedHours,
      working_hours_percent: workingHoursPercent,
      achieved_service_revenue: achievedRevenue,
      revenue_percent: revenuePercent,
      bonus_percent: bonusPercent,
      basic_pay: basicPay,
      bonus: bonus,
      paid_offdays: 0, // No longer needed since Basic is fixed
      ta_pay: taPay,
      fa_pay: faPay,
      full_pay: fullPay,
      deductions: 0,
      net_pay: fullPay
  };
};

// =====================================================================
// 🔥 PAYROLL LIFECYCLE API ROUTES
// =====================================================================

// 1. Get Runs for a Centre 
router.get('/runs', authMiddleware(['admin', 'superadmin']), async (req, res) => {
  const centreId = req.user.role === 'admin' ? req.user.centre_id : req.query.centre_id;
  const client = await pool.connect();
  try {
      let query = `SELECT * FROM salary_runs`;
      let params = [];
      
      // Only filter by centre if a centreId is actually provided
      if (centreId) {
          query += ` WHERE centre_id = $1`;
          params.push(centreId);
      }
      
      query += ` ORDER BY payroll_month DESC`;
      
      const result = await client.query(query, params);
      res.json(result.rows);
  } catch (err) {
      console.error("GET /runs error:", err.message);
      res.status(500).json({ error: err.message });
  } finally {
      client.release();
  }
});;

// 1.a Fetch Calendar Preview for an EXACT Payroll Month
router.get('/run-preview', authMiddleware(['admin', 'superadmin']), async (req, res) => {
  const { month } = req.query; // YYYY-MM format
  const centreId = req.user.role === 'admin' ? req.user.centre_id : req.query.centre_id;
  
  if (!centreId || !month) return res.status(400).json({ error: "Centre ID and month required" });

  const client = await pool.connect();
  try {
      // 1. Total Calendar Days for the Exact Selected Month
      const [year, monthNum] = month.split('-');
      const calendar_days = new Date(year, monthNum, 0).getDate();

      // 2. Mathematically Calculate Exact Sundays
      let sundays = 0;
      for (let i = 1; i <= calendar_days; i++) {
          const date = new Date(year, parseInt(monthNum) - 1, i);
          if (date.getDay() === 0) sundays++; // 0 represents Sunday
      }

      // 3. Fixed Duty Leave
      const dl_days = 1;

      // 4. Fetch EXPLICIT Holidays from the Calendar
      const holidaysRes = await client.query(`
          SELECT COUNT(*) as count 
          FROM calendar_events 
          WHERE centre_id = $1 AND TO_CHAR(date, 'YYYY-MM') = $2 AND type = 'holiday'
      `, [centreId, month]);
      
      const other_offdays = parseInt(holidaysRes.rows[0].count);

      // 5. Calculate Expected Target Working Days
      const working_days = calendar_days - (sundays + dl_days + other_offdays);

      res.json({
          calendar_days,
          working_days,
          sundays,
          dl_days,
          other_offdays
      });
  } catch (err) {
      res.status(500).json({ error: err.message });
  } finally {
      client.release();
  }
});

// 2. Create a Draft Run (Accepts User Overrides)
router.post('/runs', authMiddleware(['admin', 'superadmin']), async (req, res) => {
  const { payroll_month, calendar_days, sundays, dl_days, other_offdays } = req.body;
  const centreId = req.user.role === 'admin' ? req.user.centre_id : req.body.centre_id;
  
  if (!centreId) return res.status(400).json({ error: "Centre ID is required." });

  const days_targeted = Number(calendar_days) - (Number(sundays) + Number(dl_days) + Number(other_offdays));
  const client = await pool.connect();
  
  try {
      const result = await client.query(`
          INSERT INTO salary_runs (
              centre_id, payroll_month, calendar_days, sundays, dl_days, 
              other_offdays, days_targeted, status, created_by, created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', $8, NOW()) RETURNING *
      `, [centreId, `${payroll_month}-01`, calendar_days, sundays, dl_days, other_offdays, days_targeted, req.user.id]);
      
      res.status(201).json(result.rows[0]);
  } catch (err) {
      if (err.code === '23505') res.status(400).json({ error: 'A payroll run already exists for this month.' });
      else res.status(500).json({ error: err.message });
  } finally {
      client.release();
  }
});

// 3. Generate/Regenerate Records for a Run
router.post('/runs/:id/generate', authMiddleware(['admin', 'superadmin']), async (req, res) => {
  const client = await pool.connect();
  try {
      await client.query('BEGIN');
      const runRes = await client.query(`SELECT * FROM salary_runs WHERE id = $1`, [req.params.id]);
      if (runRes.rows.length === 0) throw new Error('Run not found');
      const run = runRes.rows[0];

      if (run.status === 'finalized') throw new Error('Cannot regenerate a finalized payroll run.');

      const slabs = (await client.query(`SELECT * FROM bonus_slabs WHERE active = true`)).rows;
      
      const structures = (await client.query(`
          SELECT ss.* FROM salary_structures ss
          JOIN staff s ON ss.staff_id = s.id
          WHERE s.centre_id = $1 AND ss.status = 'active'
      `, [run.centre_id])).rows;

      await client.query(`DELETE FROM salary_records WHERE salary_run_id = $1`, [run.id]);

      for (const struct of structures) {
          const att = await getPayrollAttendance(client, struct.staff_id, run.payroll_month);
          const coll = await getPayrollCollection(client, struct.staff_id, run.payroll_month);
          const standardHours = await getPayrollSchedule(client, struct.staff_id, run.payroll_month);
          
          const calc = calculateSalaryRecord(struct, run, att.worked_hours, coll.achieved_revenue, slabs, standardHours);
          
          await client.query(`
              INSERT INTO salary_records (
                  salary_run_id, staff_id, calculation_version, snapshot_basic_salary, snapshot_daily_hours, snapshot_hourly_target,
                  monthly_work_days, total_targeted_hours, total_monthly_target, total_worked_hours, working_hours_percent,
                  achieved_service_revenue, revenue_percent, bonus_percent, basic_pay, bonus, paid_offdays, ta_pay, fa_pay,
                  full_pay, deductions, net_pay
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
          `, [
              run.id, struct.staff_id, calc.calculation_version, calc.snapshot_basic_salary, calc.snapshot_daily_hours, calc.snapshot_hourly_target,
              calc.monthly_work_days, calc.total_targeted_hours, calc.total_monthly_target, calc.total_worked_hours, calc.working_hours_percent,
              calc.achieved_service_revenue, calc.revenue_percent, calc.bonus_percent, calc.basic_pay, calc.bonus, calc.paid_offdays, calc.ta_pay, calc.fa_pay,
              calc.full_pay, calc.deductions, calc.net_pay
          ]);
      }
      
      await client.query(`UPDATE salary_runs SET status = 'generated' WHERE id = $1`, [run.id]);
      await client.query('COMMIT');
      res.json({ message: 'Payroll generated successfully' });
  } catch (err) {
      await client.query('ROLLBACK');
      res.status(500).json({ error: err.message });
  } finally {
      client.release();
  }
});

// 3.a Delete a Draft or Generated Run
router.delete('/runs/:id', authMiddleware(['admin', 'superadmin']), async (req, res) => {
  const client = await pool.connect();
  try {
      await client.query('BEGIN');
      
      const runRes = await client.query(`SELECT * FROM salary_runs WHERE id = $1`, [req.params.id]);
      if (runRes.rows.length === 0) throw new Error('Run not found');
      
      const run = runRes.rows[0];
      
      // Security Check: Only admins from that centre can delete, and they cannot delete finalized runs
      if (req.user.role === 'admin' && run.centre_id !== req.user.centre_id) {
          throw new Error('Unauthorized');
      }
      if (run.status === 'finalized') {
          throw new Error('Cannot delete a finalized payroll run. It must be retained for auditing.');
      }

      // Delete the generated records first, then the run itself
      await client.query(`DELETE FROM salary_records WHERE salary_run_id = $1`, [run.id]);
      await client.query(`DELETE FROM salary_runs WHERE id = $1`, [run.id]);

      await client.query('COMMIT');
      res.json({ message: 'Payroll run deleted successfully' });
  } catch (err) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: err.message });
  } finally {
      client.release();
  }
});

// 4. Get Records for Admin Review
router.get('/runs/:id/records', authMiddleware(['admin', 'superadmin']), async (req, res) => {
  try {
      const result = await pool.query(`
          SELECT sr.*, s.name as staff_name, s.employee_id 
          FROM salary_records sr
          JOIN staff s ON sr.staff_id = s.id
          WHERE sr.salary_run_id = $1
          ORDER BY s.name ASC
      `, [req.params.id]);
      res.json(result.rows);
  } catch (err) {
      res.status(500).json({ error: 'Failed to fetch records' });
  }
});

// 5. Manual Deduction Update (Before Finalizing)
router.put('/records/:id', authMiddleware(['admin', 'superadmin']), async (req, res) => {
  const client = await pool.connect();
  try {
      await client.query('BEGIN');
      const record = (await client.query(`SELECT full_pay, salary_run_id FROM salary_records WHERE id = $1`, [req.params.id])).rows[0];
      
      const runCheck = await client.query(`SELECT status FROM salary_runs WHERE id = $1`, [record.salary_run_id]);
      if (runCheck.rows[0].status === 'finalized') throw new Error('Cannot edit finalized records.');

      const newNetPay = Number(record.full_pay) - Number(req.body.deductions);
      const result = await client.query(`
          UPDATE salary_records 
          SET deductions = $1, net_pay = $2
          WHERE id = $3 RETURNING *
      `, [req.body.deductions, newNetPay, req.params.id]);

      await client.query('COMMIT');
      res.json(result.rows[0]);
  } catch (err) {
      await client.query('ROLLBACK');
      res.status(500).json({ error: err.message });
  } finally {
      client.release();
  }
});

// 6. Finalize Run
router.post('/runs/:id/finalize', authMiddleware(['admin', 'superadmin']), async (req, res) => {
  try {
      await pool.query(`UPDATE salary_runs SET status = 'finalized', finalized_at = NOW() WHERE id = $1`, [req.params.id]);
      res.json({ message: 'Payroll Run Finalized' });
  } catch (err) {
      res.status(500).json({ error: err.message });
  }
});

// 7. Pay Record (Debit Wallet)
router.post('/records/:id/pay', authMiddleware(['admin', 'superadmin']), async (req, res) => {
  const client = await pool.connect();
  try {
      const { wallet_id } = req.body;
      await client.query('BEGIN');
      
      const recordResult = await client.query(`
          SELECT sr.*, r.payroll_month, s.name as staff_name 
          FROM salary_records sr
          JOIN salary_runs r ON sr.salary_run_id = r.id
          JOIN staff s ON sr.staff_id = s.id
          WHERE sr.id = $1
      `, [req.params.id]);
      const record = recordResult.rows[0];

      if (record.payment_status === 'paid') throw new Error('Already paid');

      // Update Wallet
      await client.query('UPDATE wallets SET balance = balance - $1 WHERE id = $2', [record.net_pay, wallet_id]);
      
      // Update Record
      await client.query(`UPDATE salary_records SET payment_status = 'paid', paid_amount = $1, total_paid_amount = $1 WHERE id = $2`, [record.net_pay, req.params.id]);

      await client.query('COMMIT');
      res.json({ message: 'Paid successfully' });
  } catch (err) {
      await client.query('ROLLBACK');
      res.status(500).json({ error: err.message });
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

    await logActivity({
      centre_id: centreId,
      related_type: 'calendar',
      related_id: result.rows[0].id,
      action: 'Calendar Event Created',
      description: `Created ${type} event for ${new Date(date).toLocaleDateString()}${description ? `: ${description}` : ''}`,
      performed_by: req.user.id,
      performed_by_role: req.user.role
    });

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

    await logActivity({
      centre_id: centreId,
      related_type: 'calendar',
      related_id: id,
      action: 'Calendar Event Updated',
      description: `Updated ${type} event for ${new Date(date).toLocaleDateString()}`,
      performed_by: req.user.id,
      performed_by_role: req.user.role
    });

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
        c.id, c.name, c.created_by AS "createdBy", c.admin_id AS "adminId", c.created_at AS "createdAt",
        COUNT(DISTINCT s.id) AS "staffCount",
        COUNT(DISTINCT CASE WHEN s.status = 'Active' THEN s.id END) AS "activeStaff",
        COALESCE(SUM(sal.net_pay), 0) AS "totalSalary"
       FROM centres c
       LEFT JOIN staff s ON c.id = s.centre_id
       LEFT JOIN (
         SELECT sr.staff_id, sr.net_pay 
         FROM salary_records sr
         JOIN salary_runs r ON sr.salary_run_id = r.id
         WHERE TO_CHAR(r.payroll_month, 'YYYY-MM') = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
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
    const center = await checkCenterExists(client, centerId);
    if (!center) {
      return res.status(404).json({ error: 'Center not found' });
    }

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

// GET /api/salary/centers/:centerId/calendar - Get calendar by center (superadmin only)
router.get('/centers/:centerId/calendar', authMiddleware(['superadmin']), async (req, res) => {
  const { centerId } = req.params;
  const client = await pool.connect();
  try {
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
    const centersResult = await client.query(
      `SELECT COUNT(*) as total_centers FROM centres`
    );
    
    const staffResult = await client.query(
      `SELECT 
        COUNT(*) as total_staff,
        COUNT(CASE WHEN status = 'Active' THEN 1 END) as active_staff
       FROM staff`
    );
    
    const currentMonth = new Date().toISOString().slice(0, 7);
    const salaryResult = await client.query(
      `SELECT COALESCE(SUM(sr.net_pay), 0) as total_salary
       FROM salary_records sr
       JOIN salary_runs r ON sr.salary_run_id = r.id
       WHERE TO_CHAR(r.payroll_month, 'YYYY-MM') = $1`,
      [currentMonth]
    );
    
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
        c.id AS "centerId", c.name AS "centerName",
        COUNT(DISTINCT s.id) AS "staffCount",
        COUNT(DISTINCT CASE WHEN s.status = 'Active' THEN s.id END) AS "activeStaff",
        COALESCE(SUM(sal.net_pay), 0) AS "totalSalary",
        COALESCE(ROUND(AVG(CASE 
          WHEN a.status = 'present' AND a.date = CURRENT_DATE THEN 1 
          ELSE 0 
        END) * 100, 0), 0) AS "attendanceRate"
       FROM centres c
       LEFT JOIN staff s ON c.id = s.centre_id
       LEFT JOIN (
         SELECT sr.staff_id, sr.net_pay 
         FROM salary_records sr
         JOIN salary_runs r ON sr.salary_run_id = r.id
         WHERE TO_CHAR(r.payroll_month, 'YYYY-MM') = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
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
router.put('/centers/:centerId/leaves/:id', authMiddleware(['superadmin']), async (req, res) => {
  const { centerId, id } = req.params;
  const { status } = req.body;

  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const center = await checkCenterExists(client, centerId);
    if (!center) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Center not found' });
    }

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
      [status, id, centerId]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Leave not found or unauthorized' });
    }

    if (status === 'approved') {
      const leave = result.rows[0];
      const startDate = new Date(leave.from_date);
      const endDate = new Date(leave.to_date);
      
      const attStatus = leave.leave_duration === 'half' ? 'half-day' : 'absent';

      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        
        const existingAtt = await client.query(
          `SELECT id FROM attendance WHERE staff_id = $1 AND date = $2`,
          [leave.staff_id, dateStr]
        );

        if (existingAtt.rows.length > 0) {
          await client.query(
            `UPDATE attendance SET status = $1, updated_at = NOW() WHERE id = $2`,
            [attStatus, existingAtt.rows[0].id]
          );
        } else {
          await client.query(
            `INSERT INTO attendance (staff_id, date, status, created_at)
             VALUES ($1, $2, $3, NOW())`,
            [leave.staff_id, dateStr, attStatus]
          );
        }
      }
    }

    await client.query('COMMIT');

    if (leaveDetails.rows.length > 0) {
      const leave = leaveDetails.rows[0];
      await logActivity({
        centre_id: leave.centre_id,
        related_type: 'leave',
        related_id: id,
        action: status === 'approved' ? 'Leave Approved' : 'Leave Rejected',
        description: `Superadmin ${status === 'approved' ? 'approved' : 'rejected'} leave request for ${leave.staff_name} (${leave.type}) from ${new Date(leave.from_date).toLocaleDateString()} to ${new Date(leave.to_date).toLocaleDateString()}`,
        performed_by: req.user.id,
        performed_by_role: req.user.role
      });
    }

    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating leave for center:', err);
    res.status(500).json({ error: 'Failed to update leave', details: err.message });
  } finally {
    client.release();
  }
});

// SUPER ADMIN – delete calendar event (centre-aware)
router.delete('/centers/:centerId/calendar/:id', authMiddleware(['superadmin']), async (req, res) => {
  const { id } = req.params;

  const result = await req.db.query(
    'DELETE FROM calendar_events WHERE id = $1 RETURNING *',
    [id]
  );

  if (!result.rows.length) {
    return res.status(404).json({ error: 'Calendar event not found' });
  }

  await logActivity({
    centre_id: result.rows[0].centre_id,
    related_type: 'calendar',
    related_id: id,
    action: 'Calendar Event Deleted',
    description: `Superadmin deleted calendar event`,
    performed_by: req.user.id,
    performed_by_role: req.user.role
  });

  res.json({ success: true });
});

// =====================================================================
// 🔥 STAFF PAYROLL CONFIGURATION (SALARY STRUCTURES)
// =====================================================================

// 8. Get all active salary structures for the centre
router.get('/structures', authMiddleware(['admin', 'superadmin']), async (req, res) => {
  const centreId = req.user.role === 'admin' ? req.user.centre_id : req.query.centre_id;
  const client = await pool.connect();
  try {
      const result = await client.query(`
          SELECT ss.id, ss.staff_id, ss.basic_salary, ss.hourly_service_revenue_target, ss.ta, ss.fa, s.name as staff_name 
          FROM salary_structures ss
          JOIN staff s ON ss.staff_id = s.id
          WHERE s.centre_id = $1 AND ss.status = 'active'
          ORDER BY s.name ASC
      `, [centreId]);
      res.json(result.rows);
  } catch (err) {
      res.status(500).json({ error: err.message });
  } finally {
      client.release();
  }
});

// 9. Update a staff member's salary structure
router.put('/structures/:staff_id', authMiddleware(['admin', 'superadmin']), async (req, res) => {
  const staffId = req.params.staff_id;
  const { basic_salary, hourly_service_revenue_target, ta, fa } = req.body;
  const client = await pool.connect();
  
  try {
      await client.query('BEGIN');
      
      // 1. Archive the old structure
      await client.query(`
          UPDATE salary_structures 
          SET effective_to = CURRENT_DATE - INTERVAL '1 day', status = 'archived'
          WHERE staff_id = $1 AND status = 'active'
      `, [staffId]);
      
      // 2. Create the new effective structure
      const result = await client.query(`
          INSERT INTO salary_structures (
              staff_id, basic_salary, hourly_service_revenue_target, ta, fa, effective_from, created_by
          ) VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, $6) RETURNING *
      `, [staffId, basic_salary || 0, hourly_service_revenue_target || 0, ta || 0, fa || 0, req.user.id]);
      
      // 3. Sync the 'salary' column back to the generic staff profile table
      await client.query(`UPDATE staff SET salary = $1 WHERE id = $2`, [basic_salary || 0, staffId]);

      await client.query('COMMIT');
      res.json(result.rows[0]);
  } catch (err) {
      await client.query('ROLLBACK');
      res.status(500).json({ error: err.message });
  } finally {
      client.release();
  }
});

export default router;