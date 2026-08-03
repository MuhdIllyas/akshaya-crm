import jwt from "jsonwebtoken";
import pool from "../db.js";

export const deviceAuth = async (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
        return res.status(401).json({ error: "No device token provided" });
    }

    try {
        // Verify the JWT signature
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Ensure this token wasn't issued to a web dashboard user
        if (decoded.type !== "device") {
            return res.status(401).json({ error: "Invalid token type" });
        }

        // Verify the device still exists and is active in the database
        const result = await pool.query(
            `
            SELECT *
            FROM companion_devices
            WHERE id = $1
              AND is_active = TRUE
            `,
            [decoded.device_id]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: "Device not found or deactivated" });
        }

        // Attach the device record to the request for downstream routes
        req.device = result.rows[0];
        next();

    } catch (err) {
        return res.status(401).json({ error: "Invalid or expired device token" });
    }
};