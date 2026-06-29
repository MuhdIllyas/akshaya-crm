// adminAnalytics.js
import express from "express";
import jwt from "jsonwebtoken";
// Updated import based on unified engine
import { getDashboardAnalytics } from "./analyticsService.js"; 

const router = express.Router();

const requireAdmin = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    
    if (!['admin', 'superadmin'].includes(user.role)) {
      return res.status(403).json({ error: "Admin access required" });
    }
    
    req.user = user;
    next();
  });
};

router.use(requireAdmin);

// GET /api/analytics/admin/dashboard
router.get("/dashboard", async (req, res) => {
  try {
    const centreId = req.user.centre_id;
    if (!centreId) return res.status(400).json({ error: "No centre assigned to this user" });

    const data = await getDashboardAnalytics(centreId);
    res.json(data);
  } catch (err) {
    console.error("Admin Analytics Error:", err);
    res.status(500).json({ error: "Failed to fetch admin dashboard data" });
  }
});

// GET /api/analytics/admin/my-centre
router.get("/my-centre", async (req, res) => {
  try {
    const centreId = req.user.centre_id;
    if (!centreId) return res.status(400).json({ error: "No centre assigned to this user" });

    const data = await getDashboardAnalytics(centreId);
    res.json(data);
  } catch (err) {
    console.error("Admin Analytics Error:", err);
    res.status(500).json({ error: "Failed to fetch admin analytics" });
  }
});

export default router;