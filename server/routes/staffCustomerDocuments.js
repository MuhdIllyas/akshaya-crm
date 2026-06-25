import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import pool from "../db.js";
import jwt from 'jsonwebtoken';

const router = express.Router();

/* ================= MULTER ================= */
const storage = multer.diskStorage({
  destination: "uploads/customer-documents",
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

/* ================= HELPERS ================= */
const hashValue = (value) =>
  crypto.createHash("sha256").update(value.trim()).digest("hex");

// Middleware to verify token and role
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    console.log('staffDocumentService.js: No token provided');
    return res.status(403).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.error('staffDocumentService.js: Token verification error:', err.message);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

router.get("/document-master", authenticateToken , async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT 
        id,
        name, 
        scope, 
        requires_number,
        requires_expiry,
        creates_household,
        active
      FROM document_master
      WHERE active = true
      ORDER BY name
      `
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch document master" });
  }
});

/* ======================================================
   DOWNLOAD DOCUMENT
   staff / admin level
====================================================== */
router.get("/:id/download", authenticateToken,  async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `
      SELECT file_hash, mime_type, document_name
      FROM customer_documents
      WHERE id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "File not found" });
    }

    const fullPath = path.resolve(
      process.cwd(),
      "uploads/customer-documents",
      result.rows[0].file_hash
    );

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ message: "File missing" });
    }

    // Set content-disposition header for download
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.rows[0].document_name.replace(/\s+/g, '_')}"`
    );
    res.type(result.rows[0].mime_type);
    res.sendFile(fullPath);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Download failed" });
  }
});

/* ======================================================
   GET ALL CUSTOMER DOCUMENTS (STAFF VIEW)
====================================================== */
router.get("/:customerId/documents", authenticateToken, 
async (req, res) => {
 const { customerId } = req.params;
  const { scope, status, include_old_versions } = req.query;

  try {
    const result = await pool.query(
      `
      SELECT
        cd.id,
        cd.customer_id,
        cd.household_id,
        cd.service_entry_id,
        cd.document_name,
        cd.document_type,
        cd.scope,
        cd.document_number,          -- Actual document number
        cd.document_number_hash,
        cd.document_number_last4,
        cd.status,
        cd.version,
        cd.review_remarks,
        cd.created_at,
        cd.file_size,
        cd.mime_type,
        cd.file_url,
        cd.file_hash,
        cd.expiry_date,
        cd.is_latest,
        cd.uploaded_by,              -- Who uploaded (customer/staff)
        cd.reviewed_by,
        cd.reviewed_at,
        cd.replaced_by,
        dm.requires_expiry,
        dm.requires_number,
        dm.creates_household,
        h.ration_card_type,
        h.ration_card_last4,
        h.district as household_district,
        h.state as household_state,
        c.name as customer_name,
        c.primary_phone as customer_phone,
        c.email as customer_email,
        c.aadhaar_last4 as customer_aadhaar_last4,
        s.name as reviewed_by_staff_name
      FROM customer_documents cd
      LEFT JOIN document_master dm ON cd.document_name = dm.name
      LEFT JOIN households h ON cd.household_id = h.id
      LEFT JOIN customers c ON cd.customer_id = c.id
      LEFT JOIN staff s ON cd.reviewed_by = s.id
      WHERE cd.customer_id = $1
        AND ($2::boolean IS NULL OR cd.is_latest = NOT $2)
        AND ($3::text IS NULL OR cd.scope = $3)
        AND ($4::text IS NULL OR cd.status = $4)
      ORDER BY 
        CASE cd.scope 
          WHEN 'individual' THEN 1
          WHEN 'household' THEN 2
          WHEN 'service' THEN 3
          ELSE 4
        END,
        cd.document_name,
        cd.version DESC
      `,
      [
        customerId,
        include_old_versions === "true",
        scope || null,
        status || null
      ]
    );

    // Format response
    const documents = result.rows.map(doc => {
      const formattedDoc = { ...doc };
      
      // Generate full file URL for download
      if (doc.file_url && !doc.file_url.startsWith('http')) {
        formattedDoc.file_url = `${req.protocol}://${req.get('host')}${doc.file_url}`;
      }
      
      // Format dates
      const formatDate = (date) => date ? new Date(date).toISOString() : null;
      
      formattedDoc.created_at = formatDate(doc.created_at);
      formattedDoc.expiry_date = formatDate(doc.expiry_date);
      formattedDoc.reviewed_at = formatDate(doc.reviewed_at);
      
      // Mask sensitive information for display
      if (doc.document_number) {
        const masked = doc.document_number.replace(/(\d{4})(\d+)(\d{4})/, 
          (match, first, middle, last) => `${first}${'*'.repeat(middle.length)}${last}`
        );
        formattedDoc.masked_document_number = masked;
      }
      
      return formattedDoc;
    });

    res.json(documents);
  } catch (err) {
    console.error("Staff view documents error:", err);
    res.status(500).json({ message: "Failed to fetch customer documents" });
  }
});

/* ======================================================
   UPDATE DOCUMENT STATUS (STAFF REVIEW)
====================================================== */
router.put("/:id/review", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const staffId = req.user.id; 
  const { status, remarks } = req.body;

  if (!status || !['approved', 'rejected', 'pending'].includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Get current document
    const docResult = await client.query(
      `SELECT customer_id, status FROM customer_documents WHERE id = $1`,
      [id]
    );

    if (docResult.rows.length === 0) {
      throw new Error("Document not found");
    }

    // Update document status
    await client.query(
      `
      UPDATE customer_documents
      SET 
        status = $1,
        review_remarks = $2,
        reviewed_by = $3,
        reviewed_at = NOW(),
        updated_at = NOW()
      WHERE id = $4
      RETURNING *
      `,
      [status, remarks || null, staffId, id]
    );

    await client.query("COMMIT");

    res.json({ 
      success: true, 
      message: `Document ${status}`,
      documentId: id 
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Document review error:", err);
    res.status(400).json({ message: err.message });
  } finally {
    client.release();
  }
});

/* ======================================================
   UPLOAD DOCUMENT AS STAFF (for customer)
====================================================== */
router.post(
  "/:customerId/upload-staff",
  authenticateToken,
  upload.single("file"),
  async (req, res) => {
    const staffId = req.user.id;
    const { customerId } = req.params;
    const {
      document_name,
      document_type = "other",
      document_number,
      expiry_date,
      scope = "individual",
      household_id,
      service_entry_id, // ADD THIS - for service documents
      ration_card_type,
      district,
      state
    } = req.body;

    if (!req.file || !document_name) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      /* 1️⃣ Fetch document rules */
      const metaResult = await client.query(
        `
        SELECT scope, requires_number, creates_household, requires_expiry, active
        FROM document_master
        WHERE name = $1 AND active = true
        `,
        [document_name]
      );

      if (metaResult.rows.length === 0) {
        throw new Error("Invalid document type or document not active");
      }

      const meta = metaResult.rows[0];

      // Override scope from document master if provided
      const finalScope = scope || meta.scope;

      /* 2️⃣ Validate required fields */
      let numberHash = null;
      let numberLast4 = null;
      let actualDocumentNumber = document_number || null;

      if (meta.requires_number) {
        if (!document_number) {
          throw new Error("Document number required for this document type");
        }
        numberHash = hashValue(document_number);
        numberLast4 = document_number.slice(-4);
      }

      if (meta.requires_expiry && !expiry_date) {
        throw new Error("Expiry date required for this document");
      }

      /* 3️⃣ Service document validation */
      if (finalScope === 'service') {
        if (!service_entry_id) {
          throw new Error("Service entry ID is required for service documents");
        }
        
        // Optional: Verify that the service entry exists and belongs to this customer
        const serviceCheck = await client.query(
          `SELECT id FROM customer_services WHERE id = $1 AND customer_id = $2`,
          [service_entry_id, customerId]
        );
        
        if (serviceCheck.rows.length === 0) {
          throw new Error("Invalid service entry ID or service doesn't belong to this customer");
        }
      }

      /* 4️⃣ Household logic (only for household scope) */
      let finalHouseholdId = null;

      if (finalScope === 'household') {
        if (meta.creates_household) {
          if (!document_number) {
            throw new Error("Document number required for household creation");
          }

          // Check if household exists
          const householdResult = await client.query(
            `SELECT id FROM households WHERE ration_card_hash = $1`,
            [numberHash]
          );

          if (householdResult.rows.length === 0) {
            // Create new household
            const created = await client.query(
              `
              INSERT INTO households
              (ration_card_hash, ration_card_last4, ration_card_type, district, state, status)
              VALUES ($1, $2, $3, $4, $5, 'active')
              RETURNING id
              `,
              [
                numberHash, 
                numberLast4, 
                ration_card_type || 'general', 
                district || '', 
                state || ''
              ]
            );
            finalHouseholdId = created.rows[0].id;
          } else {
            finalHouseholdId = householdResult.rows[0].id;
            
            // Update household details if provided
            if (ration_card_type || district || state) {
              await client.query(
                `
                UPDATE households 
                SET 
                  ration_card_type = COALESCE($1, ration_card_type),
                  district = COALESCE($2, district),
                  state = COALESCE($3, state),
                  updated_at = NOW()
                WHERE id = $4
                `,
                [ration_card_type, district, state, finalHouseholdId]
              );
            }
          }

          // Link customer to household if not already linked
          const existingLink = await client.query(
            `SELECT * FROM customer_households 
             WHERE customer_id = $1 AND household_id = $2 AND left_at IS NULL`,
            [customerId, finalHouseholdId]
          );

          if (existingLink.rows.length === 0) {
            await client.query(
              `
              INSERT INTO customer_households
              (customer_id, household_id, role, joined_at)
              VALUES ($1, $2, 'member', NOW())
              `,
              [customerId, finalHouseholdId]
            );
          }
        } else {
          // For non-creating household documents, use provided household_id
          if (household_id) {
            finalHouseholdId = parseInt(household_id);
          } else {
            throw new Error("Household ID is required for household documents");
          }
        }
      }

      /* 5️⃣ Versioning - mark old versions as not latest */
      await client.query(
        `
        UPDATE customer_documents
        SET is_latest = false
        WHERE customer_id = $1
          AND document_name = $2
          AND scope = $3
          AND is_latest = true
        `,
        [customerId, document_name, finalScope]
      );

      // Get next version number
      const versionResult = await client.query(
        `
        SELECT COALESCE(MAX(version), 0) + 1 AS version
        FROM customer_documents
        WHERE customer_id = $1 AND document_name = $2 AND scope = $3
        `,
        [customerId, document_name, finalScope]
      );

      const version = versionResult.rows[0].version;

      /* 6️⃣ Insert document as staff */
      const insertResult = await client.query(
        `
        INSERT INTO customer_documents (
          customer_id,
          household_id,
          service_entry_id,  -- This is CRITICAL for service documents
          document_name,
          document_type,
          scope,
          document_number,
          document_number_hash,
          document_number_last4,
          file_hash,
          mime_type,
          file_size,
          status,
          version,
          is_latest,
          uploaded_by,
          expiry_date,
          reviewed_by,
          reviewed_at,
          file_url
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9,
          $10, $11, $12,
          'approved',  -- Staff uploads are auto-approved
          $13, true, 'staff',
          $14, $15, NOW(),
          '/api/staff/documents/temp'
        )
        RETURNING id, file_hash
        `,
        [
          customerId,
          finalHouseholdId,
          finalScope === 'service' ? service_entry_id : null, // CRITICAL: Set service_entry_id for service docs
          document_name,
          document_type,
          finalScope,
          meta.requires_number ? actualDocumentNumber : null,
          meta.requires_number ? numberHash : null,
          meta.requires_number ? numberLast4 : null,
          req.file.filename,
          req.file.mimetype,
          req.file.size,
          version,
          expiry_date || null,
          staffId  // reviewed_by = staff who uploaded
        ]
      );

      const docId = insertResult.rows[0].id;
      const fileHash = insertResult.rows[0].file_hash;

      // Update file_url with correct path
      await client.query(
        `
        UPDATE customer_documents
        SET file_url = $1
        WHERE id = $2
        `,
        [`/api/staff/documents/${docId}/download`, docId]
      );

      /* 7️⃣ Get household list for response */
      let households = [];
      if (finalScope === 'household') {
        const householdResult = await client.query(
          `
          SELECT h.id, h.ration_card_last4, h.ration_card_type
          FROM households h
          INNER JOIN customer_households ch ON h.id = ch.household_id
          WHERE ch.customer_id = $1 AND ch.left_at IS NULL
          ORDER BY h.created_at DESC
          `,
          [customerId]
        );
        households = householdResult.rows;
      }

      await client.query("COMMIT");

      res.json({
        success: true,
        documentId: docId,
        version: version,
        householdId: finalHouseholdId,
        households: households,
        requiresNumber: meta.requires_number,
        requiresExpiry: meta.requires_expiry,
        createsHousehold: meta.creates_household
      });

    } catch (err) {
      await client.query("ROLLBACK");

      // Clean up uploaded file
      if (req.file?.filename) {
        const filePath = path.join("uploads/customer-documents", req.file.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      console.error("Staff upload error:", err);
      res.status(400).json({ message: err.message });
    } finally {
      client.release();
    }
  }
);

/* ======================================================
   GET CUSTOMER SERVICES (for document linking)
====================================================== */
router.get("/:customerId/services", authenticateToken, async (req, res) => {
  const { customerId } = req.params;

  try {
    const result = await pool.query(
      `
      SELECT 
        cs.id,
        cs.application_number,
        s.name as service_name,
        sc.name as subcategory_name,
        cs.status,
        cs.applied_at as created_at,
        cs.assigned_staff_id as assigned_to,
        st.name as assigned_to_name,
        cs.payment_status
      FROM customer_services cs
      LEFT JOIN services s ON cs.service_id = s.id
      LEFT JOIN subcategories sc ON cs.subcategory_id = sc.id
      LEFT JOIN staff st ON cs.assigned_staff_id = st.id
      WHERE cs.customer_id = $1
        AND cs.status IN ('in_progress', 'completed', 'approved', 'pending')
      ORDER BY cs.applied_at DESC
      `,
      [customerId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching customer services:", err);
    res.status(500).json({ message: "Failed to fetch customer services" });
  }
});

export default router;