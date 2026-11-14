// Organization-wide options set by the superadmin.
//   GET /api/org-settings                 (any staff)  { org_slug, booking_mode, saved_booking_mode, customer_portal }
//   PUT /api/org-settings/booking-mode    (superadmin) { booking_mode: "shared" | "strict" }
//   PUT /api/org-settings/customer-portal (superadmin) { customer_portal: "shared" | "per_centre" }

import express from "express";
import { authMiddleware } from "./staff.js";
import { BOOKING_MODES, CUSTOMER_PORTAL, getBookingMode, getCustomerPortalMode, getSetting, setSetting } from "../utils/orgSettings.js";

const router = express.Router();

router.get("/", authMiddleware(["staff", "supervisor", "admin", "superadmin"]), async (req, res) => {
  try {
    res.json({
      org_slug: req.tenant.slug,
      booking_mode: await getBookingMode(), // in effect (strict while the portal is per-centre)
      saved_booking_mode: (await getSetting("booking_mode")) === BOOKING_MODES.STRICT ? BOOKING_MODES.STRICT : BOOKING_MODES.SHARED,
      customer_portal: await getCustomerPortalMode(),
    });
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

router.put("/customer-portal", authMiddleware(["superadmin"]), async (req, res) => {
  const mode = req.body?.customer_portal;
  if (!Object.values(CUSTOMER_PORTAL).includes(mode)) {
    return res.status(400).json({ error: "customer_portal must be 'shared' or 'per_centre'" });
  }
  try {
    await setSetting("customer_portal", mode, req.user.id);
    res.json({ customer_portal: mode, booking_mode: await getBookingMode() });
  } catch (err) {
    console.error("save customer portal error:", err.message);
    res.status(500).json({ error: err.code === "42P01" ? "Run the centre-bookings migration first" : "Failed to save" });
  }
});

export default router;
