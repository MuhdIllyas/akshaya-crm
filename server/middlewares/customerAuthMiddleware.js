import jwt from "jsonwebtoken";
import pool from "../db.js";

export const customerAuthMiddleware = async (req, res, next) => {
  try {
    if (!process.env.CUSTOMER_JWT_SECRET) {
      throw new Error("CUSTOMER_JWT_SECRET is not defined");
    }

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Customer token missing" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "Invalid authorization format" });
    }

    const decoded = jwt.verify(token, process.env.CUSTOMER_JWT_SECRET);

    const result = await pool.query(
      `
      SELECT id, name, primary_phone, status
      FROM customers
      WHERE id = $1
      `,
      [decoded.customer_id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Customer not found" });
    }

    const customer = result.rows[0];

    if (customer.status !== "active") {
      return res.status(403).json({ error: "Customer account is blocked" });
    }

    req.customer = {
      id: customer.id,
      name: customer.name,
      phone: customer.primary_phone
    };

    next();
  } catch (err) {
    console.error("Customer auth error:", err.message);
    return res.status(401).json({ error: "Invalid or expired customer token" });
  }
};