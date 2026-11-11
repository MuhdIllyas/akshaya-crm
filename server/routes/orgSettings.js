// Organization-wide options set by the superadmin.
//   GET /api/org-settings              (any staff)  { org_slug, booking_mode }
//   PUT /api/org-settings/booking-mode (superadmin) { booking_mode: "shared" | "strict" }

import express from "express";
import { authMiddleware } from "./staff.js";
import { BOOKING_MODES, getBookingMode, setSetting } from "../utils/orgSettings.js";

const router = express.Router();

router.get("/", authMiddleware(["staff", "supervisor", "admin", "superadmin"]), async (req, res) => {
  try {
    res.json({ org_slug: req.tenant.slug, booking_mode: await getBookingMode() });
  } catch (err) {
    console.error("org settings error:", err.message);
    res.status(500).json({ error: "Failed to load settings" });
  }
});

router.put("/booking-mode", authMiddleware(["superadmin"]), async (req, res) => {
  const mode = req.body?.booking_mode;
  if (!Object.values(BOOKING_MODES).includes(mode)) {
    return res.status(400).json({ error: "booking_mode must be 'shared' or 'strict'" });
  }
  try {
    await setSetting("booking_mode", mode, req.user.id);
    res.json({ booking_mode: mode });
  } catch (err) {
    console.error("save booking mode error:", err.message);
    res.status(500).json({ error: err.code === "42P01" ? "Run the centre-bookings migration first" : "Failed to save" });
  }
});

export default router;
