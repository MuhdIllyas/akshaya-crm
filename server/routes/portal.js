// Public data for the customer portal of the current organization.
//   GET /api/portal/centres  centres customers can book with, and the WhatsApp
//                            number to chat with each (null = WhatsApp off).

import express from "express";
import pool from "../db.js";
import { featureEnabled } from "../tenancy/limits.js";

const router = express.Router();

router.get("/centres", async (req, res) => {
  try {
    let rows;
    try {
      ({ rows } = await pool.query(`
        SELECT c.id, c.name, c.district, c.address, c.phone,
               CASE WHEN ca.is_active THEN ca.phone_number END AS whatsapp_number
          FROM centres c
          LEFT JOIN communication_accounts ca ON ca.id = c.communication_account_id
         ORDER BY c.name`));
    } catch (err) {
      if (err.code !== "42703" && err.code !== "42P01") throw err;
      // Older database without WhatsApp columns: list centres only.
      ({ rows } = await pool.query(`SELECT id, name, district, address, phone, NULL AS whatsapp_number FROM centres ORDER BY name`));
    }
    // WhatsApp not in the plan: no chat buttons.
    res.json(featureEnabled("whatsapp") ? rows : rows.map((r) => ({ ...r, whatsapp_number: null })));
  } catch (err) {
    console.error("portal centres error:", err.message);
    res.status(500).json({ error: "Failed to load centres" });
  }
});

export default router;
