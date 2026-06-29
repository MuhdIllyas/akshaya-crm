import express from "express";
import jwt from "jsonwebtoken";
import { getReportData } from "./analyticsService.js";
import { buildPDF, buildExcel, buildCSV } from "@/utils/exportBuilder.js";

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