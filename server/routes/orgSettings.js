// Organization-wide options set by the superadmin.
//   GET /api/org-settings                 (any staff)  { org_slug, booking_mode, saved_booking_mode, customer_portal }
//   PUT /api/org-settings/booking-mode    (superadmin) { booking_mode: "shared" | "strict" }
//   PUT /api/org-settings/customer-portal (superadmin) { customer_portal: "shared" | "per_centre" }

import express from "express";
import { authMiddleware } from "./staff.js";
import pool from "../db.js";
import { BOOKING_MODES, CUSTOMER_PORTAL, getBookingMode, getCustomerPortalMode, getSetting, setSetting } from "../utils/orgSettings.js";

const router = express.Router();

router.get("/", authMiddleware(["staff", "supervisor", "admin", "superadmin"]), async (req, res) => {
  try {
    res.json({
      org_slug: req.tenant.slug,
      booking_mode: await getBookingMode(), // in effect (strict while the portal is per-centre)
      saved_booking_mode: (await getSetting("booking_mode")) === BOOKING_MODES.STRICT ? BOOKING_MODES.STRICT : BOOKING_MODES.SHARED,
      customer_portal: await getCustomerPortalMode(),
      booking_poster: (await getSetting("booking_poster")) === true,
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

/* ------------------------------------------------------------------
   Booking poster: an A4 poster with a centre's booking QR, printed by
   the centre admin (Print Settings → Booking Poster). The superadmin
   decides whether admins get it.
   GET /api/org-settings/booking-poster   (admin, superadmin; superadmin may pass ?centre_id)
     → { enabled, org_slug, centre: { id, name }, services: [names] }
   PUT /api/org-settings/booking-poster   (superadmin) { enabled: true|false }
------------------------------------------------------------------- */
router.get("/booking-poster", authMiddleware(["admin", "superadmin"]), async (req, res) => {
  try {
    const enabled = (await getSetting("booking_poster")) === true;
    const centreId = Number(req.user.role === "superadmin" ? req.query.centre_id || req.user.centre_id : req.user.centre_id) || null;
    let centre = null;
    let services = [];
    if (centreId) {
      const { rows } = await pool.query(`SELECT id, name FROM centres WHERE id = $1`, [centreId]);
      centre = rows[0] || null;
    }
    if (centre) {
      // The centre's most-used services in the last 6 months, then other active services.
      const { rows: top } = await pool.query(
        `SELECT s.name, count(*) AS n
           FROM service_entries se
           JOIN staff st ON st.id = se.staff_id
           JOIN services s ON s.id = se.category_id
          WHERE st.centre_id = $1 AND se.created_at > now() - interval '180 days'
            AND COALESCE(s.status, 'active') = 'active'
          GROUP BY s.name
          ORDER BY n DESC, s.name
          LIMIT 8`,
        [centre.id]
      );
      services = top.map((r) => r.name);
      if (services.length < 8) {
        const { rows: more } = await pool.query(
          `SELECT name FROM services WHERE COALESCE(status, 'active') = 'active' AND NOT (name = ANY($1::text[]))
            ORDER BY name LIMIT $2`,
          [services, 8 - services.length]
        );
        services.push(...more.map((r) => r.name));
      }
    }
    res.json({ enabled, org_slug: req.tenant.slug, centre, services });
  } catch (err) {
    console.error("booking poster error:", err.message);
    res.status(500).json({ error: "Failed to load the booking poster" });
  }
});

router.put("/booking-poster", authMiddleware(["superadmin"]), async (req, res) => {
  const enabled = req.body?.enabled === true;
  try {
    await setSetting("booking_poster", enabled, req.user.id);
    res.json({ enabled });
  } catch (err) {
    console.error("save booking poster error:", err.message);
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
