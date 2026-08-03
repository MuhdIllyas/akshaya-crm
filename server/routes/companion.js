import express from 'express';
import jwt from 'jsonwebtoken';
import pool from '../db.js';
import { deviceAuth } from '../middlewares/deviceAuth.js';

const router = express.Router();

// ❌ PUBLIC: POST /api/companion/pair
// Verifies the QR token, creates the device record, and returns a stateless JWT
router.post('/pair', async (req, res) => {
    try {
        // 'installationId' replaces 'deviceUuid'
        const { pairingToken, installationId, deviceName, appVersion } = req.body;
        
        // TODO: Verify pairingToken matches what the CRM generated and extract centreId
        const centreId = 4; // Mocked for this example

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
        
        res.status(200).json({ 
            message: "Paired successfully",
            token: token,
            device_id: deviceId,
            centre_id: centreId
        });
    } catch (error) {
        console.error("Pairing Error:", error);
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

export default router;