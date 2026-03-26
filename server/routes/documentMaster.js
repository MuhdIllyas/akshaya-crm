import express from "express";
import pool from "../db.js";
import { customerAuthMiddleware } from "../middlewares/customerAuthMiddleware.js";

const router = express.Router();

/**
 * GET /api/document-master
 * Used for dropdown
 */
router.get("/", customerAuthMiddleware, async (req, res) => {
  const result = await pool.query(
    `
    SELECT name, scope, requires_number
    FROM document_master
    WHERE active = true
    ORDER BY name
    `
  );

  res.json(result.rows);
});

export default router;