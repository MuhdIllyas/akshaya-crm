import express from 'express';
import jwt from 'jsonwebtoken';
import pool from '../db.js';
import { deviceAuth } from '../middlewares/deviceAuth.js';

export const authMiddleware = (allowedRoles) => async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    console.log("Auth middleware: No token provided");
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result = await pool.query("SELECT role, centre_id FROM staff WHERE id = $1", [decoded.id]);
    if (result.rows.length === 0) {
      console.log(`Auth middleware: User not found for ID ${decoded.id}`);
      return res.status(401).json({ error: "User not found" });
    }

    // Normalize role to lowercase for comparison
    const userRole = result.rows[0].role.toLowerCase();
    if (!allowedRoles.includes(userRole)) {
      console.log(`Auth middleware: Role ${userRole} not allowed. Required: ${allowedRoles}`);
      return res.status(403).json({ error: "Unauthorized access" });
    }

    req.user = decoded;
    req.user.centre_id = result.rows[0].centre_id;
    next();
  } catch (err) {
    console.error("Auth middleware error:", err.message);
    res.status(401).json({ error: "Invalid or expired token" });
  }
};

const router = express.Router();

// ---> 1. NEW ROUTE: Generate a secure, 15-minute pairing token for the React Admin
router.get("/generate-pairing-token", authMiddleware([ "admin", "superadmin"]), async (req, res) => {
    try {
        const centreId = req.user.centre_id;
        
        // Create a temporary token that expires in 15 minutes
        const pairingToken = jwt.sign(
            { type: "pairing", centre_id: centreId },
            process.env.JWT_SECRET,
            { expiresIn: "15m" }
        );
        
        res.json({ pairingToken });
    } catch (error) {
        console.error("Token generation error:", error);
        res.status(500).json({ error: "Failed to generate pairing token" });
    }
});

// ❌ PUBLIC: POST /api/companion/pair
// Verifies the QR token, creates the device record, and returns a stateless JWT
router.post('/pair', async (req, res) => {
    try {
        // 'installationId' replaces 'deviceUuid'
        const { pairingToken, installationId, deviceName, appVersion } = req.body;
        const decoded = jwt.verify(pairingToken, process.env.JWT_SECRET);

        if (decoded.type !== "pairing") {
            return res.status(400).json({ error: "Invalid token type" });
        }
        
        const centreId = decoded.centre_id; // Extract centreId from the verified token

        // Insert or Update the device using the installationId
        const result = await pool.query(
            `
            INSERT INTO companion_devices (centre_id, device_uuid, device_name, app_version, is_active)
            VALUES ($1, $2, $3, $4, TRUE)
            ON CONFLICT (device_uuid) 
            DO UPDATE SET 
                centre_id = EXCLUDED.centre_id,
                device_name = EXCLUDED.device_name,
                is_active = TRUE,
                last_seen = CURRENT_TIMESTAMP
            RETURNING id;
            `,
            [centreId, installationId, deviceName, appVersion]
        );

        const deviceId = result.rows[0].id;

        // Generate the stateless JWT
        const token = jwt.sign(
            {
                device_id: deviceId,
                centre_id: centreId,
                type: "device"
            },
            process.env.JWT_SECRET
        );
        
        // Fetch the actual Centre Name to send to the Android phone
        const centreRes = await pool.query('SELECT name FROM centres WHERE id = $1', [centreId]);
        const centreName = centreRes.rows[0]?.name || `Centre ${centreId}`;

        res.status(200).json({ 
            message: "Paired successfully",
            token: token,
            device_id: deviceId,
            centre_id: centreId,
            centre_name: centreName
        });
    } catch (error) {
        console.error("Pairing Error:", error);
        
        // Catch specific JWT errors to tell the Android app exactly what went wrong
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: "QR code expired. Please generate a new one." });
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: "Invalid QR code." });
        }
        
        res.status(500).json({ error: "Server error during pairing" });
    }
});

// ✅ PROTECTED: POST /api/companion/heartbeat
router.post('/heartbeat', deviceAuth, async (req, res) => {
    try {
        const { batteryLevel, networkStatus } = req.body;
        
        await pool.query(
            `
            UPDATE companion_devices 
            SET battery_level = $1, network_status = $2, last_seen = CURRENT_TIMESTAMP, is_online = TRUE
            WHERE id = $3
            `,
            [batteryLevel, networkStatus, req.device.id]
        );
        
        res.status(200).json({ message: "Heartbeat acknowledged" });
    } catch (error) {
        res.status(500).json({ error: "Failed to update heartbeat" });
    }
});

// ✅ PROTECTED: GET /api/companion/status
router.get('/status', deviceAuth, async (req, res) => {
    try {
        // You can now safely use req.device.id and req.device.centre_id here
        res.status(200).json({ 
            device: req.device,
            message: "Status fetched successfully" 
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch status" });
    }
});

// ✅ PROTECTED: POST /api/companion/unpair
router.post('/unpair', deviceAuth, async (req, res) => {
    try {
        // Soft delete the device
        await pool.query(
            `UPDATE companion_devices SET is_active = FALSE, is_online = FALSE WHERE id = $1`,
            [req.device.id]
        );
        
        res.status(200).json({ message: "Device unpaired successfully" });
    } catch (error) {
        res.status(500).json({ error: "Failed to unpair device" });
    }
});

// ---> NEW ROUTE: Fetch all registered devices for an Admin's centre
router.get("/devices", authMiddleware(["admin", "superadmin"]), async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, device_name, app_version, battery_level, network_status, last_seen, is_active 
             FROM companion_devices 
             WHERE centre_id = $1 
             ORDER BY last_seen DESC`,
            [req.user.centre_id]
        );
        res.json(result.rows);
    } catch (error) {
        console.error("Fetch devices error:", error);
        res.status(500).json({ error: "Failed to fetch devices" });
    }
});

// ---> NEW ROUTE: Admin unpairs/removes a device from the CRM
router.delete("/devices/:id", authMiddleware(["admin", "superadmin"]), async (req, res) => {
    try {
        const { id } = req.params;
        
        // Soft delete: Mark it inactive and offline. 
        // We include centre_id in the WHERE clause for security so admins can't delete other centres' phones.
        const result = await pool.query(
            `UPDATE companion_devices 
             SET is_active = FALSE, is_online = FALSE 
             WHERE id = $1 AND centre_id = $2`,
            [id, req.user.centre_id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Device not found or not authorized." });
        }

        res.json({ success: true, message: "Device unpaired successfully." });
    } catch (error) {
        console.error("Remove device error:", error);
        res.status(500).json({ error: "Failed to remove device" });
    }
});

export default router;
