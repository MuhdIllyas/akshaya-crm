import jwt from "jsonwebtoken";
import pool from "../db.js";
import { customerCentreScope } from "../utils/customerCentres.js";

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

    // Per-centre portal: the centre this customer signed in at (null = shared
    // portal, or they still need to choose one).
    const scope = await customerCentreScope(customer.id, decoded.centre_id);

    req.customer = {
      id: customer.id,
      name: customer.name,
      phone: customer.primary_phone,
      portalMode: scope.mode,
      centreId: scope.centreId,
      needsCentre: scope.needsCentre
    };

    next();
  } catch (err) {
    console.error("Customer auth error:", err.message);
    return res.status(401).json({ error: "Invalid or expired customer token" });
  }
};

// For routes about bookings, chats and centres: in the per-centre portal the
// customer must have chosen their centre first (the portal sends them to the
// "choose your centre" page on this answer).
export const requireCustomerCentre = (req, res, next) => {
  if (req.customer?.needsCentre) {
    return res.status(409).json({ code: "choose_centre", message: "Choose your centre to continue" });
  }
  next();
};
