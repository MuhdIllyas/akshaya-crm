/* Staff-side routes for tracking documents: upload, list, toggle visibility, delete, staff download */
import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import pool from "../db.js";
import { logActivity } from "../utils/activityLogger.js";

const router = express.Router();

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = user;
    next();
  });
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join("private_uploads", "tracking_documents", req.params.trackingId);
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + file.originalname.replace(/[^a-zA-Z0-9.]/g, "_");
    cb(null, unique);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|doc|docx|jpg|jpeg|png/;
    const ok = allowedTypes.test(path.extname(file.originalname).toLowerCase())
      && allowedTypes.test(file.mimetype);
    cb(ok ? null : new Error("Only PDF, DOC, and image files are allowed"), ok);
  }
});

// Returns the tracking row (with centre_id) if this user may act on it, otherwise null
const checkTrackingAccess = async (req, trackingId) => {
  const t = await pool.query(
    `SELECT st.assigned_to, se_staff.centre_id, se_staff.reports_to
     FROM service_tracking st
     JOIN service_entries se ON st.service_entry_id = se.id
     JOIN staff se_staff ON se.staff_id = se_staff.id
     WHERE st.id = $1`,
    [trackingId]
  );
  if (t.rows.length === 0) return null;
  const row = t.rows[0];

  if (req.user.role === "superadmin") return row;
  if (req.user.role === "admin") return row.centre_id === req.user.centre_id ? row : null;
  if (req.user.role === "supervisor") return row.reports_to === req.user.id ? row : null;
  if (req.user.role === "staff") return row.assigned_to === req.user.id ? row : null;
  return null;
};

const validTrackingId = (req, res) => {
  const id = parseInt(req.params.trackingId, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid tracking ID provided." });
    return null;
  }
  return id;
};

// UPLOAD
router.post("/:trackingId/documents", authenticateToken, upload.single("file"), async (req, res) => {
  try {
    const trackingId = validTrackingId(req, res);
    if (trackingId === null) {
      if (req.file) fs.unlinkSync(req.file.path);
      return;
    }
    const { label, visible_to_customer } = req.body;

    const access = await checkTrackingAccess(req, trackingId);
    if (!access) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(403).json({ error: "Access denied" });
    }
    if (!req.file) return res.status(400).json({ error: "File required" });
    if (!label || !label.trim()) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "Label is required" });
    }

    const result = await pool.query(
      `INSERT INTO service_tracking_documents
       (service_tracking_id, label, file_path, file_size, mime_type, visible_to_customer, uploaded_by, uploaded_by_role)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id, label, visible_to_customer, created_at`,
      [trackingId, label.trim(), req.file.path, req.file.size, req.file.mimetype,
       visible_to_customer === "true", req.user.id, req.user.role]
    );

    await logActivity({
      centre_id: access.centre_id,
      related_type: "service_tracking",
      related_id: trackingId,
      action: "Document uploaded",
      description: `Uploaded "${label.trim()}"${visible_to_customer === "true" ? " (visible to customer)" : ""}`,
      performed_by: req.user.id,
      performed_by_role: req.user.role
    });

    res.json({ message: "Uploaded", document: result.rows[0] });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    console.error("Document upload error:", err);
    res.status(400).json({ error: err.message });
  }
});

// LIST (staff view)
router.get("/:trackingId/documents", authenticateToken, async (req, res) => {
  const trackingId = validTrackingId(req, res);
  if (trackingId === null) return;

  if (!(await checkTrackingAccess(req, trackingId))) {
    return res.status(403).json({ error: "Access denied" });
  }
  const result = await pool.query(
    `SELECT d.id, d.label, d.file_size, d.mime_type, d.visible_to_customer, d.created_at,
            s.name AS uploaded_by_name
     FROM service_tracking_documents d
     LEFT JOIN staff s ON d.uploaded_by = s.id
     WHERE d.service_tracking_id = $1
     ORDER BY d.created_at DESC`,
    [trackingId]
  );
  res.json(result.rows);
});

// TOGGLE VISIBILITY
router.patch("/:trackingId/documents/:docId", authenticateToken, async (req, res) => {
  const trackingId = validTrackingId(req, res);
  if (trackingId === null) return;
  const { docId } = req.params;

  const access = await checkTrackingAccess(req, trackingId);
  if (!access) {
    return res.status(403).json({ error: "Access denied" });
  }
  const visible = req.body.visible_to_customer === true;
  const result = await pool.query(
    `UPDATE service_tracking_documents SET visible_to_customer = $1
     WHERE id = $2 AND service_tracking_id = $3 RETURNING *`,
    [visible, docId, trackingId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: "Not found" });

  await logActivity({
    centre_id: access.centre_id,
    related_type: "service_tracking",
    related_id: trackingId,
    action: "Document visibility changed",
    description: `"${result.rows[0].label}" is now ${visible ? "visible" : "hidden"} to the customer`,
    performed_by: req.user.id,
    performed_by_role: req.user.role
  });

  res.json(result.rows[0]);
});

// DELETE
router.delete("/:trackingId/documents/:docId", authenticateToken, async (req, res) => {
  const trackingId = validTrackingId(req, res);
  if (trackingId === null) return;
  const { docId } = req.params;

  const access = await checkTrackingAccess(req, trackingId);
  if (!access) {
    return res.status(403).json({ error: "Access denied" });
  }
  const doc = await pool.query(
    `DELETE FROM service_tracking_documents WHERE id = $1 AND service_tracking_id = $2 RETURNING file_path, label`,
    [docId, trackingId]
  );
  if (doc.rows.length === 0) return res.status(404).json({ error: "Not found" });
  if (fs.existsSync(doc.rows[0].file_path)) fs.unlinkSync(doc.rows[0].file_path);

  await logActivity({
    centre_id: access.centre_id,
    related_type: "service_tracking",
    related_id: trackingId,
    action: "Document deleted",
    description: `Deleted "${doc.rows[0].label}"`,
    performed_by: req.user.id,
    performed_by_role: req.user.role
  });

  res.json({ message: "Deleted" });
});

// STAFF DOWNLOAD (authenticated)
router.get("/:trackingId/documents/:docId/download", authenticateToken, async (req, res) => {
  const trackingId = validTrackingId(req, res);
  if (trackingId === null) return;
  const { docId } = req.params;

  if (!(await checkTrackingAccess(req, trackingId))) {
    return res.status(403).json({ error: "Access denied" });
  }
  const doc = await pool.query(
    `SELECT * FROM service_tracking_documents WHERE id = $1 AND service_tracking_id = $2`,
    [docId, trackingId]
  );
  if (doc.rows.length === 0 || !fs.existsSync(doc.rows[0].file_path)) {
    return res.status(404).json({ error: "Not found" });
  }
  const ext = path.extname(doc.rows[0].file_path);
  const hasExt = path.extname(doc.rows[0].label).toLowerCase() === ext.toLowerCase();
  const downloadName = hasExt ? doc.rows[0].label : `${doc.rows[0].label}${ext}`;

  res.setHeader("Content-Type", doc.rows[0].mime_type || "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${downloadName}"`);
  res.sendFile(path.resolve(doc.rows[0].file_path));
});

export default router;