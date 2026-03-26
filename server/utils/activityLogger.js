import pool from "../db.js";

export const logActivity = async ({
  centre_id,
  related_type,
  related_id,
  action,
  description,
  performed_by,
  performed_by_role
}) => {
  try {
    await pool.query(
      `
      INSERT INTO activities
      (centre_id, related_type, related_id, action, description, performed_by, performed_by_role, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
      `,
      [
        centre_id,
        related_type,
        related_id,
        action,
        description,
        performed_by,
        performed_by_role
      ]
    );
  } catch (err) {
    console.error("Activity log error:", err);
  }
};