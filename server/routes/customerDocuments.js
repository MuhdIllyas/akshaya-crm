import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import pool from "../db.js";
import { customerAuthMiddleware } from "../middlewares/customerAuthMiddleware.js";

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

/* ======================================================
   GET DOCUMENT MASTER WITH ALL FIELDS
   MUST BE PLACED BEFORE :id ROUTES
====================================================== */
router.get("/document-master",customerAuthMiddleware, async (req, res) => {
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
   GET HOUSEHOLDS WITH DETAILS
   MUST BE PLACED BEFORE :id ROUTES
====================================================== */
router.get("/households", customerAuthMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT 
        h.id, 
        h.ration_card_last4,
        h.ration_card_type,
        h.district,
        h.state,
        h.status,
        h.created_at,
        COUNT(DISTINCT ch.customer_id) as member_count
      FROM households h
      JOIN customer_households ch ON ch.household_id = h.id
      WHERE ch.customer_id = $1 AND ch.left_at IS NULL
      GROUP BY h.id
      ORDER BY h.created_at DESC
      `,
      [req.customer.id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch households" });
  }
});

/* ======================================================
   GET CUSTOMER DOCUMENTS
====================================================== */
router.get("/", customerAuthMiddleware, async (req, res) => {
  const customerId = req.customer.id;
  const { scope, include_all_versions } = req.query;

  try {
    const result = await pool.query(
      `
      SELECT
        id,
        customer_id,
        household_id,
        document_name,
        document_type,
        scope,
        document_number_last4,
        status,
        version,
        review_remarks,
        created_at,
        file_size,
        mime_type,
        file_url,
        file_hash,
        expiry_date,
        is_latest,
        uploaded_by
      FROM customer_documents
      WHERE customer_id = $1
        AND ($2::boolean IS NULL OR is_latest = NOT $2)
        AND ($3::text IS NULL OR scope = $3)
      ORDER BY document_name, version DESC
      `,
      [customerId, include_all_versions === "true", scope || null]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch documents" });
  }
});

/* ======================================================
   DOWNLOAD DOCUMENT
   MUST BE PLACED BEFORE :id ROUTE
====================================================== */
router.get("/:id/download", customerAuthMiddleware, async (req, res) => {
  const { id } = req.params;
  const customerId = req.customer.id;

  try {
    const result = await pool.query(
      `
      SELECT file_hash, mime_type, document_name
      FROM customer_documents
      WHERE id = $1 AND customer_id = $2
      `,
      [id, customerId]
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
   GET DOCUMENT VERSIONS
   MUST BE PLACED BEFORE :id ROUTE
====================================================== */
router.get("/:id/versions", customerAuthMiddleware, async (req, res) => {
  const { id } = req.params;
  const customerId = req.customer.id;

  try {
    // Get current document to find document name
    const currentDoc = await pool.query(
      `SELECT document_name FROM customer_documents WHERE id = $1 AND customer_id = $2`,
      [id, customerId]
    );

    if (currentDoc.rows.length === 0) {
      return res.status(404).json({ message: "Document not found" });
    }

    const documentName = currentDoc.rows[0].document_name;

    // Get all versions
    const result = await pool.query(
      `
      SELECT 
        id,
        version,
        status,
        file_size,
        mime_type,
        created_at,
        expiry_date,
        review_remarks,
        is_latest
      FROM customer_documents
      WHERE customer_id = $1 
        AND document_name = $2
      ORDER BY version DESC
      `,
      [customerId, documentName]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch versions" });
  }
});

/* ======================================================
   GET SINGLE DOCUMENT
====================================================== */
router.get("/:id", customerAuthMiddleware, async (req, res) => {
  const { id } = req.params;
  const customerId = req.customer.id;

  // Check if id is a number (document ID) or string (document-master/households)
  if (isNaN(parseInt(id))) {
    return res.status(404).json({ message: "Document not found" });
  }

  try {
    const result = await pool.query(
      `
      SELECT
        cd.*,
        dm.requires_expiry,
        dm.requires_number,
        dm.creates_household,
        h.ration_card_type,
        h.district,
        h.state
      FROM customer_documents cd
      LEFT JOIN document_master dm ON cd.document_name = dm.name
      LEFT JOIN households h ON cd.household_id = h.id
      WHERE cd.id = $1 AND cd.customer_id = $2
      `,
      [id, customerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Document not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch document" });
  }
});

/* ======================================================
   UPLOAD/CREATE DOCUMENT
====================================================== */
router.post(
  "/",
  customerAuthMiddleware,
  upload.single("file"),
  async (req, res) => {
    const customerId = req.customer.id;
    const {
      document_name,
      document_type,
      document_number, // This is the actual document number
      expiry_date,
      household_id,
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
        SELECT scope, requires_number, creates_household, requires_expiry
        FROM document_master
        WHERE name = $1 AND active = true
        `,
        [document_name]
      );

      if (metaResult.rows.length === 0) {
        throw new Error("Invalid document type");
      }

      const meta = metaResult.rows[0];

      /* 2️⃣ Validate required fields */
      let numberHash = null;
      let numberLast4 = null;
      let actualDocumentNumber = null; // Store the actual number

      if (meta.requires_number) {
        if (!document_number) {
          throw new Error("Document number required");
        }
        actualDocumentNumber = document_number; // Store actual number
        numberHash = hashValue(document_number);
        numberLast4 = document_number.slice(-4);
      }

      if (meta.requires_expiry && !expiry_date) {
        throw new Error("Expiry date required for this document");
      }

      /* 3️⃣ Household logic */
      let finalHouseholdId = null;
      let serviceEntryId = null;

      if (meta.scope === 'household') {
        if (meta.creates_household) {
          if (!document_number) {
            throw new Error("Document number required for household creation");
          }

          const householdResult = await client.query(
            `SELECT id FROM households WHERE ration_card_hash = $1`,
            [numberHash]
          );

          if (householdResult.rows.length === 0) {
            // Create new household with additional details
            const created = await client.query(
              `
              INSERT INTO households
              (ration_card_hash, ration_card_last4, ration_card_type, district, state, status)
              VALUES ($1, $2, $3, $4, $5, 'active')
              RETURNING id
              `,
              [numberHash, numberLast4, ration_card_type || 'general', district || '', state || '']
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

          // Check if customer is already linked to this household
          const existingLink = await client.query(
            `SELECT * FROM customer_households 
             WHERE customer_id = $1 AND household_id = $2 AND left_at IS NULL`,
            [customerId, finalHouseholdId]
          );

          if (existingLink.rows.length === 0) {
            // Insert customer household link only if not already linked
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
          // For non-creating household documents, use the provided household_id
          if (household_id) {
            finalHouseholdId = parseInt(household_id);
          } else {
            throw new Error("Household ID is required for household documents");
          }
        }
      } else if (meta.scope === 'service') {
        // Service documents are not yet supported in this version
        throw new Error("Service documents are not yet supported");
      }

      /* 4️⃣ Versioning */
      await client.query(
        `
        UPDATE customer_documents
        SET is_latest = false
        WHERE customer_id = $1
          AND document_name = $2
          AND is_latest = true
        `,
        [customerId, document_name]
      );

      const versionResult = await client.query(
        `
        SELECT COALESCE(MAX(version), 0) + 1 AS version
        FROM customer_documents
        WHERE customer_id = $1 AND document_name = $2
        `,
        [customerId, document_name]
      );

      const version = versionResult.rows[0].version;

      /* 5️⃣ Insert document - FIXED to include document_number */
      const insertResult = await client.query(
          `
          INSERT INTO customer_documents (
            customer_id,
            household_id,
            service_entry_id,
            document_name,
            document_type,
            scope,
            document_number,           -- ADDED: Store actual document number
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
            replaced_by,
            file_url
          )
          VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8,  -- $7 is document_number, $8 is document_number_hash
            $9, $10, $11,
            $12,  -- This is for file_size
            'pending',
            $13, true, 'customer',
            $14, NULL,
            '/api/customer/documents/temp'
          )
          RETURNING id, file_hash
          `,
          [
            customerId,
            meta.scope === 'household' ? finalHouseholdId : null,
            meta.scope === 'service' ? serviceEntryId : null,
            document_name,
            document_type || 'other',
            meta.scope,
            meta.requires_number ? actualDocumentNumber : null,      // Store actual number
            meta.requires_number ? numberHash : null,                // Store hash
            meta.requires_number ? numberLast4 : null,               // Store last4
            req.file.filename,
            req.file.mimetype,
            req.file.size,
            version,
            expiry_date || null
          ]
        );

      const docId = insertResult.rows[0].id;
      const fileHash = insertResult.rows[0].file_hash;

      // Now update the file_url with the correct one
      await client.query(
        `
        UPDATE customer_documents
        SET file_url = $1
        WHERE id = $2
        `,
        [`/api/customer/documents/${docId}/download`, docId]
      );

      await client.query("COMMIT");
      
      res.json({ 
        success: true, 
        documentId: docId,
        version: version,
        householdId: finalHouseholdId 
      });

    } catch (err) {
      await client.query("ROLLBACK");

      // Clean up uploaded file if exists
      if (req.file?.filename) {
        const filePath = path.join("uploads/customer-documents", req.file.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      console.error("Upload error:", err);
      res.status(400).json({ message: err.message });
    } finally {
      client.release();
    }
  }
);

/* ======================================================
   UPDATE DOCUMENT (With or without new file)
====================================================== */
router.put(
  "/:id",
  customerAuthMiddleware,
  upload.single("file"),
  async (req, res) => {
    const { id } = req.params;
    const customerId = req.customer.id;
    const {
      document_number, // Make sure this is extracted
      document_name,
      expiry_date,
      ration_card_type,
      district,
      state
    } = req.body;

    // Validate ID is numeric
    if (isNaN(parseInt(id))) {
      return res.status(400).json({ message: "Invalid document ID" });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Get existing document with document master info
      const existingDoc = await client.query(
        `
        SELECT 
          d.*,
          dm.requires_number,
          dm.requires_expiry,
          dm.creates_household,
          dm.scope as doc_scope
        FROM customer_documents d
        LEFT JOIN document_master dm ON d.document_name = dm.name
        WHERE d.id = $1 AND d.customer_id = $2
        `,
        [id, customerId]
      );

      if (existingDoc.rows.length === 0) {
        throw new Error("Document not found");
      }

      const existing = existingDoc.rows[0];

      // Check if this is the latest version
      if (!existing.is_latest) {
        throw new Error("Can only update the latest version of a document");
      }

      // Validate required fields based on document master
      let numberHash = existing.document_number_hash;
      let numberLast4 = existing.document_number_last4;

      // FIX: Check if document_number is provided in the request
      if (existing.requires_number && document_number && document_number.trim()) {
        numberHash = hashValue(document_number);
        numberLast4 = document_number.slice(-4);
      }

      if (existing.requires_expiry && !expiry_date) {
        throw new Error("Expiry date required for this document");
      }

      // Handle household updates if this is a household document
      if (existing.creates_household && existing.household_id) {
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
          [ration_card_type, district, state, existing.household_id]
        );
      }

      // If new file is uploaded, create a new version
      if (req.file) {
        // Mark current as not latest
        await client.query(
          `UPDATE customer_documents SET is_latest = false WHERE id = $1`,
          [id]
        );

        // Create new version
        const versionResult = await client.query(
          `SELECT COALESCE(MAX(version), 0) + 1 AS version
           FROM customer_documents 
           WHERE customer_id = $1 AND document_name = $2`,
          [customerId, existing.document_name]
        );

        const newVersion = versionResult.rows[0].version;

        const insertResult = await client.query(
          `
          INSERT INTO customer_documents (
            customer_id,
            household_id,
            service_entry_id,
            document_name,
            document_type,
            scope,
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
            replaced_by,
            file_url
          )
          VALUES (
            $1, $2, $3, $4, $5,
            $6, $7,
            $8, $9, $10,
            $11,  -- This is for file_size
            'pending',
            $12, true, 'customer',
            $13, $14,
            '/api/customer/documents/temp'
          )
          RETURNING id
          `,
          [
            customerId,
            existing.scope === 'household' ? existing.household_id : null,
            existing.scope === 'service' ? existing.service_entry_id : null,
            existing.document_name,
            existing.document_type,
            existing.scope,
            existing.requires_number ? numberHash : null,
            existing.requires_number ? numberLast4 : null,
            req.file.filename,
            req.file.mimetype,
            req.file.size,
            newVersion,
            expiry_date || existing.expiry_date,
            id
          ]
        );

        const newDocId = insertResult.rows[0].id;

        // Update file URL for new document with correct ID
        await client.query(
          `UPDATE customer_documents SET file_url = $1 WHERE id = $2`,
          [`/api/customer/documents/${newDocId}/download`, newDocId]
        );

        // Delete old file
        const oldFilePath = path.join("uploads/customer-documents", existing.file_hash);
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }

        await client.query("COMMIT");
        
        res.json({ 
          success: true, 
          message: "Document updated with new version",
          documentId: newDocId,
          version: newVersion 
        });

      } else {
        // Update metadata only (no new file)
        await client.query(
          `
          UPDATE customer_documents
          SET
            document_number_hash = $1,
            document_number_last4 = $2,
            expiry_date = $3,
            updated_at = NOW()
          WHERE id = $4 AND customer_id = $5
          `,
          [
            // FIX: Use numberHash if document_number was provided, otherwise keep existing
            document_number && existing.requires_number ? numberHash : existing.document_number_hash,
            document_number && existing.requires_number ? numberLast4 : existing.document_number_last4,
            expiry_date || existing.expiry_date, 
            id, 
            customerId
          ]
        );

        await client.query("COMMIT");
        
        res.json({ 
          success: true, 
          message: "Document metadata updated" 
        });
      }

    } catch (err) {
      await client.query("ROLLBACK");

      // Clean up uploaded file if exists
      if (req.file?.filename) {
        const filePath = path.join("uploads/customer-documents", req.file.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      console.error("Update error:", err);
      res.status(400).json({ message: err.message });
    } finally {
      client.release();
    }
  }
);

/* ======================================================
   DELETE DOCUMENT
====================================================== */
router.delete("/:id", customerAuthMiddleware, async (req, res) => {
  const { id } = req.params;
  const customerId = req.customer.id;

  // Validate ID is numeric
  if (isNaN(parseInt(id))) {
    return res.status(400).json({ message: "Invalid document ID" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Get document details
    const docResult = await client.query(
      `
      SELECT 
        d.*,
        h.ration_card_hash
      FROM customer_documents d
      LEFT JOIN households h ON d.household_id = h.id
      WHERE d.id = $1 AND d.customer_id = $2
      `,
      [id, customerId]
    );

    if (docResult.rows.length === 0) {
      throw new Error("Document not found");
    }

    const document = docResult.rows[0];

    // Check if this document created a household
    const householdDocCount = await client.query(
      `
      SELECT COUNT(*) as count
      FROM customer_documents
      WHERE household_id = $1
        AND customer_id = $2
        AND id != $3
        AND is_latest = true
      `,
      [document.household_id, customerId, id]
    );

    // Delete the document
    await client.query(
      `DELETE FROM customer_documents WHERE id = $1 AND customer_id = $2`,
      [id, customerId]
    );

    // If this was the only document linking to the household, remove the household link
    if (document.household_id && householdDocCount.rows[0].count === 0) {
      await client.query(
        `DELETE FROM customer_households 
         WHERE customer_id = $1 AND household_id = $2`,
        [customerId, document.household_id]
      );
    }

    // Delete the physical file
    const filePath = path.join("uploads/customer-documents", document.file_hash);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // If this was the latest version, make the previous version the latest
    if (document.is_latest) {
      const prevVersion = await client.query(
        `
        SELECT id, version
        FROM customer_documents
        WHERE customer_id = $1
          AND document_name = $2
          AND id != $3
        ORDER BY version DESC
        LIMIT 1
        `,
        [customerId, document.document_name, id]
      );

      if (prevVersion.rows.length > 0) {
        await client.query(
          `UPDATE customer_documents SET is_latest = true WHERE id = $1`,
          [prevVersion.rows[0].id]
        );
      }
    }

    await client.query("COMMIT");
    
    res.json({ 
      success: true, 
      message: "Document deleted successfully" 
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(400).json({ message: err.message });
  } finally {
    client.release();
  }
});

export default router;