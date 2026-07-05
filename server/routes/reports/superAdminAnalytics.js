// superAdminAnalytics.js
import express from "express";
import jwt from "jsonwebtoken";
// Import the unified engine
import { getDashboardAnalytics } from "./analyticsService.js"; 
import {
    getSuperAdminDashboard
} from "./superAdminAnalyticsService.js";

const router = express.Router();

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    if (user.role !== 'superadmin') return res.status(403).json({ error: "SuperAdmin access required" });
    req.user = user;
    next();
  });
};

router.use(authenticateToken);

router.get("/centre/:centreId", async (req, res) => {
  const { centreId } = req.params;

  try {
    // Both SuperAdmin and Admin now use the same underlying financial metrics Engine
    const analyticsData = await getDashboardAnalytics(centreId);
    
    // We send back the exact same payload payload. The SuperAdmin frontend 
    // can map this data (stats, charts, lists, etc.) however it chooses.
    res.json(analyticsData);

  } catch (err) {
    console.error("SuperAdmin Analytics Error:", err);
    res.status(500).json({ error: "Failed to fetch centre analytics" });
  }
});

/**
 * SuperAdmin Executive Dashboard
 *
 * GET /api/superadmin/dashboard
 */

router.get("/dashboard", async (req, res) => {

    try {
        const {
            period = "monthly",
            fromDate,
            toDate,
            modules
        } = req.query;

        const analytics = await getSuperAdminDashboard({
            period,
            fromDate,
            toDate,
            modules
        });
        res.json(analytics);
    }
    catch (err) {
        console.error("SuperAdmin Dashboard:", err);
        res.status(500).json({
            error: "Failed to load dashboard"
        });
    }
});

export default router;