// superAdminAnalytics.js
import express from "express";
import jwt from "jsonwebtoken";
// Import the unified engine
import { getDashboardAnalytics } from "./analyticsService.js"; 
import { getSuperAdminDashboard } from "./superAdminAnalyticsService.js";

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
    const analyticsData = await getDashboardAnalytics(centreId);
    res.json(analyticsData);
  } catch (err) {
    console.error("SuperAdmin Analytics Error:", err);
    res.status(500).json({ error: "Failed to fetch centre analytics" });
  }
});

/**
 * SuperAdmin Executive Dashboard
 * GET /api/superadmin/dashboard
 */
router.get("/dashboard", async (req, res) => {
    try {
        // Fetch the super admin dashboard analytics
        const analytics = await getSuperAdminDashboard(req.query);
        res.json(analytics);
    }
    catch (err) {
        console.error("SuperAdmin Dashboard:", err);
        res.status(500).json({ error: "Failed to load dashboard" });
    }
});

export default router;
