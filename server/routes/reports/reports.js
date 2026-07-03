import express from "express";
import jwt from "jsonwebtoken";
import { getReportData , getQuickMetrics } from "./analyticsService.js";
import { buildPDF, buildExcel, buildCSV } from '../../utils/exportBuilder.js';

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

/**
 * GET /api/reports/quick-metrics - favourites - /toggle
 * Handles requests from ReportsSection.jsx
 */
router.get('/quick-metrics', authenticateToken, async (req, res) => {
    const userRole = req.user.role;           // e.g., 'admin' or 'superadmin'
    const userCentreId = req.user.centre_id;  // The centre the logged-in user belongs to
    
    let requestedCentreId = req.query.centre_id;

    // 🛡️ SECURITY OVERRIDE: 
    if (userRole !== 'superadmin') {
        requestedCentreId = userCentreId;
    }

    try {
        const data = await getQuickMetrics(requestedCentreId);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch quick metrics' });
    }
});

// GET /api/reports/favourites
router.get('/favourites', authenticateToken, async (req, res) => {
    // Only allow Admin or Superadmin
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
        return res.status(403).json({ error: "Access denied" });
    }
    
    try {
        const result = await pool.query('SELECT favourite_report_ids FROM staff WHERE id = $1', [req.user.id]);
        res.json(result.rows[0]?.favourite_report_ids || []);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch favourites' });
    }
});

// POST /api/reports/favourites/toggle
router.post('/favourites/toggle', authenticateToken, async (req, res) => {
    // Only allow Admin or Superadmin
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
        return res.status(403).json({ error: "Access denied" });
    }

    const { reportId } = req.body;
    try {
        const result = await pool.query('SELECT favourite_report_ids FROM staff WHERE id = $1', [req.user.id]);
        let favs = result.rows[0]?.favourite_report_ids || [];

        if (favs.includes(reportId)) {
            favs = favs.filter(id => id !== reportId);
        } else {
            favs.push(reportId);
        }

        await pool.query('UPDATE staff SET favourite_report_ids = $1 WHERE id = $2', [favs, req.user.id]);
        res.json(favs);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update' });
    }
});

/**
 * POST /api/reports/generate
 * Handles requests from ReportsSection.jsx
 */
router.post("/generate", async (req, res) => {
  try {
    const { 
      period, 
      fromDate, 
      toDate, 
      centreId, 
      staffId, 
      format, 
      reportIds 
    } = req.body;

    // 1. Security Check: Admin/Staff can only request their own centre
    const targetCentreId = req.user.role === 'superadmin' && centreId !== 'all' 
      ? centreId 
      : req.user.centre_id;

    // 2. Fetch Data from the Master Orchestrator (analyticsService.js)
    // We pass the raw parameters. The service will figure out the SQL.
    const reportData = await getReportData({
      reportIds,
      targetCentreId,
      staffId,
      period,
      fromDate,
      toDate
    });

    // 3. Handle 'Preview' format (Returns raw JSON to frontend)
    if (format === 'preview') {
      return res.json(reportData);
    }

    // 4. Handle File Exports (Passes JSON to builder utilities)
    let fileBuffer;
    let contentType;
    let fileExtension;

    switch (format) {
      case 'pdf':
        fileBuffer = await buildPDF(reportData, reportIds);
        contentType = 'application/pdf';
        fileExtension = 'pdf';
        break;
      case 'excel':
        fileBuffer = await buildExcel(reportData, reportIds);
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        fileExtension = 'xlsx';
        break;
      case 'csv':
        fileBuffer = await buildCSV(reportData, reportIds);
        contentType = 'text/csv';
        fileExtension = 'csv';
        break;
      default:
        return res.status(400).json({ error: "Unsupported export format" });
    }

    // 5. Send File to Frontend
    const filename = `Akshaya_Report_${new Date().toISOString().split('T')[0]}.${fileExtension}`;
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(fileBuffer);

  } catch (error) {
    console.error("Report Generation Error:", error);
    res.status(500).json({ error: "Failed to generate report" });
  }
});

export default router;