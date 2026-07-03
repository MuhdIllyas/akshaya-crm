import express from 'express';
import pool from '../../db.js';

const router = express.Router();

// Middleware: Authenticate and Attach User
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = user;
    next();
  });
};

router.use(authenticateToken);

// ==========================================
// 1. GET ALL SCHEDULES
// ==========================================
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM report_schedules 
            ORDER BY created_at DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching schedules:', error);
        res.status(500).json({ error: 'Failed to fetch schedules' });
    }
});

// ==========================================
// 2. CREATE A NEW SCHEDULE
// ==========================================
router.post('/', async (req, res) => {
    const { name, report_ids, frequency, run_time, recipient_roles, centre_id } = req.body;

    try {
        const result = await pool.query(`
            INSERT INTO report_schedules 
            (name, report_ids, frequency, run_time, recipient_roles, centre_id) 
            VALUES ($1, $2, $3, $4, $5, $6) 
            RETURNING *
        `, [
            name, 
            report_ids, 
            frequency, 
            run_time, 
            recipient_roles, 
            centre_id || null // null means it applies globally
        ]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating schedule:', error);
        res.status(500).json({ error: 'Failed to create schedule' });
    }
});

// ==========================================
// 3. TOGGLE ACTIVE STATUS
// ==========================================
router.put('/:id/toggle', async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query(`
            UPDATE report_schedules 
            SET is_active = NOT is_active 
            WHERE id = $1 
            RETURNING *
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Schedule not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error toggling schedule:', error);
        res.status(500).json({ error: 'Failed to toggle schedule' });
    }
});

// ==========================================
// 4. DELETE A SCHEDULE
// ==========================================
router.delete('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query(`
            DELETE FROM report_schedules 
            WHERE id = $1 
            RETURNING id
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Schedule not found' });
        }

        res.json({ message: 'Schedule deleted successfully' });
    } catch (error) {
        console.error('Error deleting schedule:', error);
        res.status(500).json({ error: 'Failed to delete schedule' });
    }
});

export default router;