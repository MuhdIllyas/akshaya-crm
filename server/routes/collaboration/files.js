import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import pool from "../../db.js";

const router = express.Router();

/* ================================
   AUTH MIDDLEWARE
================================ */
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

/* ================================
   MULTER CONFIG
================================ */

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const isGlobal = req.body.is_global === "true";
    let uploadPath = "uploads";

    if (isGlobal) {
      // 🔥 SECURITY: Prevent staff from uploading to the global folder
      if (req.user.role === "staff") {
        return cb(new Error("Staff members are not allowed to upload global files"));
      }
      uploadPath = path.join("uploads", "global");
    } else {
      // 🔥 SECURITY: Force admin/staff to only upload to their assigned centre folder
      let finalCentreId = req.body.centre_id;
      if (req.user.role !== "superadmin") {
        finalCentreId = req.user.centre_id; 
      }
      uploadPath = path.join("uploads", `centre_${finalCentreId}`);
    }

    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + "-" + file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
    cb(null, unique);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|doc|docx|xls|xlsx|jpg|jpeg|png|gif|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only PDF, DOC, XLS, images and text files are allowed"));
    }
  }
});

/* ================================
   UPLOAD (NEW FILE OR NEW VERSION)
================================ */

router.post("/upload", authenticateToken, upload.single("file"), async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const {
      file_id,
      name,
      category,
      is_global,
      centre_id,
      related_service_id,
      description
    } = req.body;

    if (!req.file) throw new Error("File required");

    // Convert string booleans to actual booleans
    const isGlobalBool = is_global === "true";
    
    // Handle centre_id - convert empty string to null for integer fields
    let finalCentreId = null;
    
    if (centre_id && centre_id.trim() !== "") {
      // Only parse if it's a non-empty string
      finalCentreId = parseInt(centre_id, 10);
      if (isNaN(finalCentreId)) {
        finalCentreId = null;
      }
    }

    // Override centre_id based on user role
    if (req.user.role === "superadmin") {
      // Superadmin can upload globally or to a specific centre
      finalCentreId = isGlobalBool ? null : finalCentreId;
    } else if (req.user.role === "admin") {
      // Admin can upload globally OR to their own centre
      finalCentreId = isGlobalBool ? null : req.user.centre_id;
    } else if (req.user.role === "staff") {
      // 🔥 SECURITY: Block staff from creating global files in the database
      if (isGlobalBool) {
        throw new Error("Staff members are not allowed to upload global files");
      }
      // Staff can ONLY upload to their own centre
      finalCentreId = req.user.centre_id;
    } else {
      throw new Error("Permission denied");
    }

    let fileId = file_id;

    /* ===== NEW FILE ===== */
    if (!file_id) {
      // Validate required fields for new file
      if (!name || !category) {
        throw new Error("Name and category are required");
      }

      // Check if file with same name exists in same scope
      const existingFile = await client.query(
        `SELECT id FROM files 
         WHERE name = $1 AND category = $2 
         AND (($3::int IS NULL AND centre_id IS NULL) OR centre_id = $3::int)
         AND is_global = $4`,
        [name, category, finalCentreId, isGlobalBool]
      );

      if (existingFile.rows.length > 0) {
        throw new Error("A file with this name already exists in this location");
      }

      // Insert with explicit type casting for integer fields
      const fileInsert = await client.query(
        `INSERT INTO files
         (centre_id, is_global, name, category, description,
          related_service_id, created_by, created_by_role)
         VALUES ($1::int, $2, $3, $4, $5, $6::int, $7, $8)
         RETURNING id`,
        [
          finalCentreId,  // NULL or integer
          isGlobalBool,
          name,
          category,
          description || null,
          related_service_id && related_service_id.trim() !== "" ? parseInt(related_service_id, 10) : null,
          req.user.id,
          req.user.role
        ]
      );

      fileId = fileInsert.rows[0].id;
    } else {
      // Check if file exists
      const fileCheck = await client.query(
        `SELECT id FROM files WHERE id = $1`,
        [fileId]
      );
      
      if (fileCheck.rows.length === 0) {
        throw new Error("File not found");
      }
    }

    /* ===== VERSION NUMBER ===== */
    const versionRes = await client.query(
      `SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version
       FROM file_versions WHERE file_id = $1`,
      [fileId]
    );

    const versionNumber = versionRes.rows[0].next_version;

    await client.query(
      `INSERT INTO file_versions
       (file_id, version_number, file_path, file_size, mime_type,
        uploaded_by, uploaded_by_role)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        fileId,
        versionNumber,
        req.file.path,
        req.file.size,
        req.file.mimetype,
        req.user.id,
        req.user.role
      ]
    );

    await client.query("COMMIT");

    res.json({ 
      message: "File uploaded successfully", 
      fileId,
      versionNumber 
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Upload error:", err);
    
    // Delete uploaded file if database operation failed
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

/* ================================
   GET ALL FILES WITH LATEST VERSION
================================ */

router.get("/", authenticateToken, async (req, res) => {
  try {
    let query = `
      SELECT f.*,
             v.id AS version_id,
             v.version_number,
             v.file_path,
             v.file_size,
             v.mime_type,
             v.created_at AS version_created_at,
             s.name as uploaded_by_name
      FROM files f
      JOIN file_versions v
        ON v.file_id = f.id
      LEFT JOIN staff s
        ON v.uploaded_by = s.id
      WHERE v.version_number = (
          SELECT MAX(version_number)
          FROM file_versions
          WHERE file_id = f.id
      )
    `;

    const params = [];

    // Filter based on user role
    if (req.user.role === "admin") {
      query += ` AND (f.is_global = true OR f.centre_id = $1)`;
      params.push(req.user.centre_id);
    } else if (req.user.role === "staff") {
      query += ` AND (f.is_global = true OR f.centre_id = $1)`;
      params.push(req.user.centre_id);
    }

    query += ` ORDER BY f.created_at DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching files:", err);
    res.status(400).json({ error: err.message });
  }
});

/* ================================
   GET FILE VERSIONS
================================ */

router.get("/:id/versions", authenticateToken, async (req, res) => {
  try {
    // Check if user has access to this file
    const fileCheck = await pool.query(
      `SELECT f.* FROM files f
       WHERE f.id = $1 AND (
         f.is_global = true 
         OR f.centre_id = $2 
         OR $3 = 'superadmin'
         OR ($3 IN ('admin', 'staff') AND f.centre_id = $2)
       )`,
      [req.params.id, req.user.centre_id, req.user.role]
    );

    if (fileCheck.rows.length === 0) {
      return res.status(403).json({ error: "Access denied" });
    }

    const result = await pool.query(
      `SELECT v.*, 
              s.name as uploaded_by_name,
              s.role as uploaded_by_role
       FROM file_versions v
       LEFT JOIN staff s ON v.uploaded_by = s.id
       WHERE v.file_id = $1
       ORDER BY v.version_number DESC`,
      [req.params.id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching versions:", err);
    res.status(400).json({ error: err.message });
  }
});

/* ================================
   DELETE FILE
================================ */

router.delete("/:id", authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Check if user has permission to delete
    const fileCheck = await client.query(
      `SELECT f.* FROM files f
       WHERE f.id = $1 AND (
         $2 = 'superadmin' 
         OR ($2 IN ('admin', 'staff') AND f.centre_id = $3)
         OR f.created_by = $4
       )`,
      [req.params.id, req.user.role, req.user.centre_id, req.user.id]
    );

    if (fileCheck.rows.length === 0) {
      throw new Error("Permission denied or file not found");
    }

    // Get all version file paths
    const versions = await client.query(
      `SELECT file_path FROM file_versions WHERE file_id = $1`,
      [req.params.id]
    );

    // Delete physical files
    for (const v of versions.rows) {
      if (v.file_path && fs.existsSync(v.file_path)) {
        fs.unlinkSync(v.file_path);
      }
    }

    // Delete from database (cascade will delete versions)
    await client.query(`DELETE FROM files WHERE id = $1`, [req.params.id]);

    await client.query("COMMIT");

    res.json({ message: "File deleted permanently" });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Delete error:", err);
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

/* ================================
   DOWNLOAD VERSION
================================ */

router.get("/version/:id", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT v.*, f.is_global, f.centre_id, f.name as file_name
       FROM file_versions v
       JOIN files f ON v.file_id = f.id
       WHERE v.id = $1`,
      [req.params.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "File not found" });
    }

    const file = result.rows[0];

    // Check access permission
    const hasAccess = 
      file.is_global || 
      file.centre_id === req.user.centre_id || 
      req.user.role === "superadmin" ||
      (req.user.role === "admin" && file.centre_id === req.user.centre_id) ||
      (req.user.role === "staff" && file.centre_id === req.user.centre_id);

    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (!fs.existsSync(file.file_path)) {
      return res.status(404).json({ error: "Physical file not found" });
    }

    // Set proper headers for download
    const filename = path.basename(file.file_path);
    const originalName = file.file_name || filename;
    
    res.setHeader('Content-Disposition', `attachment; filename="${originalName}"`);
    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    
    // Send the file
    res.sendFile(path.resolve(file.file_path));
    
  } catch (err) {
    console.error("Download error:", err);
    res.status(400).json({ error: err.message });
  }
});

// Also add a separate endpoint that accepts token via query parameter
router.get("/version/:id/download", async (req, res) => {
  try {
    const token = req.query.token;
    if (!token) {
      return res.status(401).json({ error: "Unauthorized - No token provided" });
    }

    // Verify token
    jwt.verify(token, process.env.JWT_SECRET, async (err, user) => {
      if (err) {
        return res.status(403).json({ error: "Invalid token" });
      }
      
      req.user = user;
      
      // Now proceed with download
      const result = await pool.query(
        `SELECT v.*, f.is_global, f.centre_id, f.name as file_name
         FROM file_versions v
         JOIN files f ON v.file_id = f.id
         WHERE v.id = $1`,
        [req.params.id]
      );

      if (!result.rows.length) {
        return res.status(404).json({ error: "File not found" });
      }

      const file = result.rows[0];

      // Check access permission
      const hasAccess = 
        file.is_global || 
        file.centre_id === user.centre_id || 
        user.role === "superadmin" ||
        (user.role === "admin" && file.centre_id === user.centre_id) ||
        (user.role === "staff" && file.centre_id === user.centre_id);

      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied" });
      }

      if (!fs.existsSync(file.file_path)) {
        return res.status(404).json({ error: "Physical file not found" });
      }

      const filename = path.basename(file.file_path);
      const originalName = file.file_name || filename;
      
      res.setHeader('Content-Disposition', `attachment; filename="${originalName}"`);
      res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
      
      res.sendFile(path.resolve(file.file_path));
    });
  } catch (err) {
    console.error("Download error:", err);
    res.status(400).json({ error: err.message });
  }
});

/* ================================
   GET FILE STATISTICS
================================ */

router.get("/stats/summary", authenticateToken, async (req, res) => {
  try {
    let query = `
      SELECT 
        COUNT(DISTINCT f.id) as total_files,
        COUNT(DISTINCT CASE WHEN f.is_global THEN f.id END) as global_files,
        COUNT(DISTINCT CASE WHEN NOT f.is_global THEN f.id END) as local_files,
        COUNT(v.id) as total_versions,
        SUM(v.file_size) as total_storage_bytes
      FROM files f
      LEFT JOIN file_versions v ON f.id = v.file_id
      WHERE 1=1
    `;

    const params = [];

    if (req.user.role === "admin" || req.user.role === "staff") {
      query += ` AND (f.is_global = true OR f.centre_id = $1)`;
      params.push(req.user.centre_id);
    }

    const result = await pool.query(query, params);
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching stats:", err);
    res.status(400).json({ error: err.message });
  }
});

export default router;