import express from "express";
import pool from "../db.js";
import { customerAuthMiddleware } from "../middlewares/customerAuthMiddleware.js";

const router = express.Router();

/* ======================================================
   GET ALL AVAILABLE SERVICES (for customer to apply)
====================================================== */
router.get("/available", customerAuthMiddleware, async (req, res) => {
  try {
    // 1. Fetch services
    const servicesResult = await pool.query(`
      SELECT
        id,
        name,
        description,
        website,
        department_charges,
        service_charges,
        requires_workflow,
        has_expiry,
        status AS service_status,
        created_at
      FROM services
      WHERE status = 'active'
      AND requires_workflow = true
      ORDER BY name ASC
    `);

    const services = [];

    for (const service of servicesResult.rows) {
      // 2. Fetch service-level documents
      const serviceDocsResult = await pool.query(
        `
        SELECT id, document_name
        FROM required_documents
        WHERE service_id = $1
        AND sub_category_id IS NULL
        `,
        [service.id]
      );

      // 3. Fetch subcategories
      const subcategoriesResult = await pool.query(
        `
        SELECT id, name, department_charges, service_charges
        FROM subcategories
        WHERE service_id = $1
        `,
        [service.id]
      );

      const subcategories = [];

      for (const sub of subcategoriesResult.rows) {
        // 4. Fetch subcategory documents
        const subDocsResult = await pool.query(
          `
          SELECT id, document_name
          FROM required_documents
          WHERE sub_category_id = $1
          `,
          [sub.id]
        );

        subcategories.push({
          id: sub.id,
          name: sub.name,
          department_charges: Number(sub.department_charges || 0),
          service_charges: Number(sub.service_charges || 0),
          total_charges:
            Number(sub.department_charges || 0) +
            Number(sub.service_charges || 0),
          required_documents: subDocsResult.rows
        });
      }

      services.push({
        id: service.id,
        service_name: service.name,
        description: service.description,
        website: service.website,
        department_charges: Number(service.department_charges || 0),
        service_charges: Number(service.service_charges || 0),
        total_charges:
          Number(service.department_charges || 0) +
          Number(service.service_charges || 0),
        requires_workflow: service.requires_workflow,
        has_expiry: service.has_expiry,
        service_status: service.service_status,
        category: "Government Services",
        created_at: service.created_at,
        required_documents: serviceDocsResult.rows,
        subcategories
      });
    }

    res.json(services);
  } catch (err) {
    console.error("Error fetching available services:", err);
    res.status(500).json({ message: "Failed to fetch available services" });
  }
});

/* ======================================================
   GET CUSTOMER'S APPLIED SERVICES
====================================================== */
router.get("/", customerAuthMiddleware, async (req, res) => {
  const customerId = req.customer.id;
  const { status } = req.query;

  try {
    // Base query
    let query = `
      SELECT 
        cs.id,
        cs.customer_id,
        cs.service_id,
        cs.subcategory_id,
        cs.status,
        cs.application_number as customer_application_number,
        cs.applied_at,
        cs.last_updated as customer_last_updated,
        cs.estimated_completion,
        cs.remarks,
        cs.service_data,
        
        -- Service details
        s.name as service_name,
        s.description as service_description,
        
        -- Subcategory details (if any)
        sc.name as subcategory_name,
        
        -- Service workflow tracking (if exists) - get the LATEST tracking record
        st.id as tracking_id,
        st.application_number as tracking_application_number,
        st.status as tracking_status,
        st.current_step,
        st.progress,
        -- FIXED: Format date to avoid timezone issues
        TO_CHAR(st.estimated_delivery, 'YYYY-MM-DD') as tracking_estimated_delivery,
        st.assigned_to as tracking_assigned_to,
        staff.name as assigned_staff_name,
        st.aadhaar as tracking_aadhaar,
        st.email as tracking_email,
        st.updated_at as tracking_updated,
        st.notes as tracking_notes,
        st.priority as tracking_priority
        
      FROM customer_services cs
      LEFT JOIN services s ON cs.service_id = s.id
      LEFT JOIN subcategories sc ON cs.subcategory_id = sc.id
      LEFT JOIN service_tracking st ON 
        st.application_number = cs.application_number 
        OR st.service_entry_id = cs.id
      LEFT JOIN staff ON st.assigned_to = staff.id
      WHERE cs.customer_id = $1
    `;
    
    const params = [customerId];
    
    // Add status filter if provided
    if (status && status !== 'all') {
      query += ` AND cs.status = $${params.length + 1}`;
      params.push(status);
    }
    
    query += ` ORDER BY cs.applied_at DESC`;
    
    const result = await pool.query(query, params);
    
    // Group by customer_service id to get the latest tracking record
    const serviceMap = new Map();
    
    result.rows.forEach(row => {
      if (!serviceMap.has(row.id)) {
        serviceMap.set(row.id, row);
      } else {
        // If we already have this service, keep the one with the latest tracking
        const existing = serviceMap.get(row.id);
        if (row.tracking_updated && (!existing.tracking_updated || new Date(row.tracking_updated) > new Date(existing.tracking_updated))) {
          serviceMap.set(row.id, row);
        }
      }
    });
    
    const uniqueRows = Array.from(serviceMap.values());
    
    // Format response
    const services = uniqueRows.map(service => {
      // Parse service_data
      let serviceData = {};
      if (service.service_data) {
        if (typeof service.service_data === 'string') {
          try {
            serviceData = JSON.parse(service.service_data);
          } catch (e) {
            console.error("Error parsing service_data string:", e);
            serviceData = {};
          }
        } else if (typeof service.service_data === 'object') {
          serviceData = service.service_data;
        }
      }
      
      // IMPORTANT: Determine the correct application number
      const finalApplicationNumber = service.tracking_application_number || 
                                     service.customer_application_number || 
                                     `TEMP-${service.id}`;
      
      // Determine the correct status
      const finalStatus = service.tracking_status || service.status;
      
      // Determine the correct last updated date
      const finalLastUpdated = service.tracking_updated || service.customer_last_updated || service.applied_at;
      
      // Determine progress
      const finalProgress = service.progress || serviceData.tracking?.progress || 0;
      
      // Determine current step
      const finalCurrentStep = service.current_step || serviceData.tracking?.current_step || 'Submitted';
      
      // FIXED: Handle date properly - keep as string from TO_CHAR
      const finalEstimatedCompletion = service.tracking_estimated_delivery || 
                                       (service.estimated_completion ? 
                                        new Date(service.estimated_completion).toISOString().split('T')[0] : 
                                        null);
      
      // Status labels
      const statusLabels = {
        'draft': 'Draft',
        'pending_documents': 'Action Required',
        'payment_pending': 'Payment Pending',
        'under_review': 'Under Review',
        'in_progress': 'In Progress',
        'completed': 'Completed',
        'rejected': 'Rejected',
        'cancelled': 'Cancelled',
        'pending': 'Pending',
        'submitted': 'Submitted',
        'approved': 'Approved'
      };
      
      return {
        id: service.id,
        service_name: service.service_name || serviceData.service_name || "Unknown Service",
        status: finalStatus,
        status_label: statusLabels[finalStatus] || finalStatus,
        applied_at: service.applied_at,
        last_updated: finalLastUpdated,
        application_number: finalApplicationNumber,
        estimated_completion: finalEstimatedCompletion,
        category: serviceData.category || "Government Services",
        service_description: service.service_description,
        subcategory_name: service.subcategory_name,
        current_step: finalCurrentStep,
        progress: finalProgress,
        remarks: service.tracking_notes || service.remarks,
        service_data: {
          ...serviceData,
          tracking: {
            id: service.tracking_id,
            current_step: finalCurrentStep,
            progress: finalProgress,
            assigned_staff_id: service.tracking_assigned_to,
            assigned_staff_name: service.assigned_staff_name,
            estimated_delivery: service.tracking_estimated_delivery,
            application_number: finalApplicationNumber,
            updated_at: service.tracking_updated,
            notes: service.tracking_notes,
            priority: service.tracking_priority
          }
        },
        total_charges: serviceData.total_charges || 0,
        assigned_staff_name: service.assigned_staff_name
      };
    });
    
    res.json(services);
  } catch (err) {
    console.error("Error fetching customer services:", err);
    res.status(500).json({ message: "Failed to fetch your services" });
  }
});

/* ======================================================
   GET SINGLE SERVICE APPLICATION
====================================================== */
router.get("/:id", customerAuthMiddleware, async (req, res) => {
  const { id } = req.params;
  const customerId = req.customer.id;

  try {
    const result = await pool.query(
      `
      SELECT 
        cs.*,
        s.name as service_name,
        s.description as service_description,
        s.website as service_website,
        sc.name as subcategory_name,
        st.status as tracking_status,
        st.current_step,
        st.progress,
        st.assigned_to,
        -- FIXED: Format date to avoid timezone issues
        TO_CHAR(st.estimated_delivery, 'YYYY-MM-DD') as tracking_estimated_delivery,
        TO_CHAR(st.updated_at, 'YYYY-MM-DD HH24:MI:SS') as tracking_updated,
        staff.name as assigned_staff_name,
        st.aadhaar as tracking_aadhaar,
        st.email as tracking_email,
        st.notes as tracking_notes,
        st.application_number as tracking_application_number
      FROM customer_services cs
      LEFT JOIN services s ON cs.service_id = s.id
      LEFT JOIN subcategories sc ON cs.subcategory_id = sc.id
      LEFT JOIN service_tracking st ON 
        st.application_number = cs.application_number 
        OR st.service_entry_id = cs.id
      LEFT JOIN staff ON st.assigned_to = staff.id
      WHERE cs.id = $1 AND cs.customer_id = $2
      ORDER BY st.updated_at DESC NULLS LAST
      LIMIT 1
      `,
      [id, customerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Service application not found" });
    }

    const service = result.rows[0];
    
    // Parse service data - handle both string and object
    let serviceData = {};
    if (service.service_data) {
      if (typeof service.service_data === 'string') {
        try {
          serviceData = JSON.parse(service.service_data);
        } catch (e) {
          console.error("Error parsing service_data:", e);
          serviceData = {};
        }
      } else if (typeof service.service_data === 'object') {
        serviceData = service.service_data;
      }
    }
    
    // Get payments if any
    const paymentsResult = await pool.query(
      `
      SELECT 
        p.amount,
        p.status as payment_status,
        p.created_at as payment_date,
        w.name as wallet_name
      FROM payments p
      LEFT JOIN wallets w ON p.wallet_id = w.id
      JOIN service_entries se ON p.service_entry_id = se.id
      WHERE se.customer_service_id = $1
      ORDER BY p.created_at DESC
      `,
      [id]  // This is customer_services.id
    );
    
    // Get uploaded documents for this service
    const documentsResult = await pool.query(
      `
      SELECT 
        cd.id,
        cd.document_name,
        cd.status as doc_status,
        cd.review_remarks,
        cd.created_at as uploaded_at,
        cd.version,
        cd.is_latest
      FROM customer_documents cd
      WHERE cd.customer_id = $1 
      AND cd.service_entry_id = $2
      ORDER BY cd.created_at DESC
      `,
      [customerId, service.service_entry_id || id]
    );
    
    // Get timeline/audit logs
    const timelineResult = await pool.query(
      `
      SELECT 
        al.action,
        al.details,
        al.created_at,
        al.performed_by
      FROM audit_logs al
      WHERE al.details LIKE $1
      ORDER BY al.created_at DESC
      LIMIT 10
      `,
      [`%${service.application_number || service.tracking_application_number}%`]
    );

    // Remove service_data from the service object and add it separately
    const { service_data, ...serviceWithoutData } = service;
    
    // Merge tracking data into service_data
    const mergedServiceData = {
      ...serviceData,
      tracking: {
        current_step: service.current_step || serviceData.tracking?.current_step || 'Submitted',
        progress: service.progress || serviceData.tracking?.progress || 0,
        assigned_staff_id: service.assigned_to,
        assigned_staff_name: service.assigned_staff_name,
        estimated_delivery: service.tracking_estimated_delivery,
        application_number: service.tracking_application_number || service.application_number,
        updated_at: service.tracking_updated,
        notes: service.tracking_notes,
        aadhaar: service.tracking_aadhaar,
        email: service.tracking_email
      }
    };
    
    res.json({
      ...serviceWithoutData,
      service_data: mergedServiceData,
      payments: paymentsResult.rows,
      documents: documentsResult.rows,
      timeline: timelineResult.rows,
      total_paid: paymentsResult.rows
        .filter(p => p.payment_status === 'received')
        .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0),
      tracking: {
        current_step: service.current_step || serviceData.tracking?.current_step || 'Submitted',
        progress: service.progress || serviceData.tracking?.progress || 0,
        assigned_staff_name: service.assigned_staff_name,
        estimated_delivery: service.tracking_estimated_delivery,
        updated_at: service.tracking_updated
      }
    });
  } catch (err) {
    console.error("Error fetching service application:", err);
    res.status(500).json({ message: "Failed to fetch service application" });
  }
});

/* ======================================================
   CREATE NEW SERVICE APPLICATION (DRAFT)
====================================================== */
router.post("/apply", customerAuthMiddleware, async (req, res) => {
  const customerId = req.customer.id;
  const {
    service_id,
    subcategory_id,
    household_id,
    service_data,
    selected_documents = []
  } = req.body;

  const client = await pool.connect();

  try {
    if (!service_id) {
      return res.status(400).json({ message: "Service ID is required" });
    }

    await client.query("BEGIN");

    // 1. Get service details
    const serviceResult = await client.query(
      `
      SELECT 
        s.*,
        sc.department_charges as sub_department_charges,
        sc.service_charges as sub_service_charges
      FROM services s
      LEFT JOIN subcategories sc ON sc.id = $2 AND sc.service_id = s.id
      WHERE s.id = $1 AND s.status = 'active'
      `,
      [service_id, subcategory_id]
    );

    if (serviceResult.rows.length === 0) {
      throw new Error("Service not found or not active");
    }

    const service = serviceResult.rows[0];
    
    // 2. Get required documents for this service
    let requiredDocs = [];
    try {
      const requiredDocsQuery = `
        SELECT 
          rd.document_name,
          dm.scope,
          dm.requires_number,
          dm.requires_expiry,
          dm.creates_household
        FROM required_documents rd
        LEFT JOIN document_master dm ON rd.document_name = dm.name
        WHERE (rd.service_id = $1 AND rd.sub_category_id IS NULL)
           OR (rd.sub_category_id = $2)
      `;
      
      const requiredDocsResult = await client.query(
        requiredDocsQuery,
        [service_id, subcategory_id]
      );
      requiredDocs = requiredDocsResult.rows;
    } catch (err) {
      console.log("Note: Could not fetch required documents:", err.message);
      // Continue without required documents - not critical
    }

    // 3. Check household if required
    let finalHouseholdId = household_id;
    if (!household_id) {
      try {
        // Get customer's primary household
        const householdResult = await client.query(
          `
          SELECT h.id 
          FROM households h
          JOIN customer_households ch ON h.id = ch.household_id
          WHERE ch.customer_id = $1 AND ch.left_at IS NULL
          ORDER BY ch.joined_at DESC
          LIMIT 1
          `,
          [customerId]
        );
        
        if (householdResult.rows.length > 0) {
          finalHouseholdId = householdResult.rows[0].id;
        }
      } catch (err) {
        console.log("Note: Could not fetch household:", err.message);
        // Continue without household - might not be required
      }
    }

    // 4. Calculate charges
    const departmentCharges = subcategory_id 
      ? parseFloat(service.sub_department_charges || 0)
      : parseFloat(service.department_charges || 0);
    
    const serviceCharges = subcategory_id
      ? parseFloat(service.sub_service_charges || 0)
      : parseFloat(service.service_charges || 0);
    
    const totalCharges = departmentCharges + serviceCharges;

    // 5. Generate application number
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    
    // Get today's count
    const countResult = await client.query(
      `SELECT COUNT(*) as count FROM customer_services WHERE DATE(applied_at) = CURRENT_DATE`
    );
    
    const count = parseInt(countResult.rows[0].count) + 1;
    const applicationNumber = `APP-${datePart}-${count.toString().padStart(4, '0')}`;

    // 6. Create service application in customer_services table only
    const insertResult = await client.query(
      `
      INSERT INTO customer_services (
        customer_id,
        service_id,
        subcategory_id,
        household_id,
        application_number,
        status,
        applied_at,
        last_updated,
        service_data,
        estimated_completion,
        remarks
      ) VALUES ($1, $2, $3, $4, $5, 'draft', NOW(), NOW(), $6, $7, $8)
      RETURNING id, application_number
      `,
      [
        customerId,
        service_id,
        subcategory_id || null,
        finalHouseholdId || null,
        applicationNumber,
        JSON.stringify({
          service_name: service.name,
          service_description: service.description,
          website: service.website,
          department_charges: departmentCharges,
          service_charges: serviceCharges,
          total_charges: totalCharges,
          requires_workflow: service.requires_workflow,
          has_expiry: service.has_expiry,
          required_documents: requiredDocs,
          selected_documents: selected_documents || [],
          ...(service_data || {})
        }),
        service.has_expiry 
          ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          : null,
        "Draft application created by customer"
      ]
    );

    const serviceAppId = insertResult.rows[0].id;
    const appNumber = insertResult.rows[0].application_number;

    // 7. Create audit log for tracking
    await client.query(
      `
      INSERT INTO audit_logs (
        action,
        performed_by,
        details,
        centre_id,
        created_at
      ) VALUES ($1, $2, $3, $4, NOW())
      `,
      [
        'Service Application Draft Created',
        `customer:${customerId}`,
        `Created draft application ${appNumber} for service: ${service.name}`,
        null
      ]
    );

    await client.query("COMMIT");

    res.status(201).json({
      success: true,
      service_application_id: serviceAppId,
      application_number: appNumber,
      status: 'draft',
      message: "Draft application created successfully",
      next_steps: [
        "Review your application details",
        "Upload required documents if any",
        "Submit for processing when ready"
      ],
      application_data: {
        service_name: service.name,
        charges: {
          department: departmentCharges,
          service: serviceCharges,
          total: totalCharges
        },
        requires_documents: requiredDocs.length > 0,
        document_count: requiredDocs.length
      }
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error creating service application:", err);
    
    // Provide more specific error messages
    let errorMessage = err.message;
    if (err.code === '42883') {
      errorMessage = "Database function error. Please contact support.";
    } else if (err.code === '23505') {
      errorMessage = "Duplicate application detected. Please try again.";
    } else if (err.code === '22P02') {
      errorMessage = "Invalid data format. Please check your input.";
    } else if (err.code === '23503') {
      errorMessage = "Invalid service or subcategory ID.";
    } else if (err.code === '42703') {
      errorMessage = "Database column error. Please contact administrator.";
    }
    
    res.status(400).json({ 
      success: false,
      message: errorMessage,
      details: err.detail || null
    });
  } finally {
    client.release();
  }
});

/* ======================================================
   UPDATE SERVICE APPLICATION (Submit documents, make payment, etc.)
====================================================== */
router.put("/:id", customerAuthMiddleware, async (req, res) => {
  const { id } = req.params;
  const customerId = req.customer.id;
  const {
    status,
    documents_submitted,
    payment_made,
    remarks,
    service_data,
    selected_documents
  } = req.body;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Get existing service application
    const existingResult = await client.query(
      `
      SELECT cs.*, s.requires_workflow, s.name as service_name
      FROM customer_services cs
      LEFT JOIN services s ON cs.service_id = s.id
      WHERE cs.id = $1 AND cs.customer_id = $2
      `,
      [id, customerId]
    );

    if (existingResult.rows.length === 0) {
      throw new Error("Service application not found");
    }

    const existing = existingResult.rows[0];
    let currentServiceData = {};
    try {
      currentServiceData = existing.service_data ? 
        (typeof existing.service_data === 'string' ? 
          JSON.parse(existing.service_data) : 
          existing.service_data) : {};
    } catch (e) {
      console.error("Error parsing existing service_data:", e);
    }

    // 2. Update based on status
    let newStatus = existing.status;
    let updateFields = [];
    let updateValues = [];
    let paramIndex = 1;

    // Update status if provided
    if (status && status !== existing.status) {
      // Validate status transition
      const validTransitions = {
        'draft': ['pending_documents', 'cancelled'],
        'pending_documents': ['under_review', 'payment_pending', 'cancelled'],
        'payment_pending': ['under_review', 'cancelled'],
        'under_review': ['in_progress', 'completed', 'rejected', 'submitted'], // ADD 'submitted' here
        'in_progress': ['completed', 'rejected']
      };

      if (validTransitions[existing.status] && !validTransitions[existing.status].includes(status)) {
        throw new Error(`Invalid status transition from ${existing.status} to ${status}`);
      }

      newStatus = status;
      updateFields.push(`status = $${paramIndex++}`);
      updateValues.push(status);
    }

    // Update service data if provided
    if (service_data || selected_documents) {
      const mergedData = { 
        ...currentServiceData, 
        ...service_data,
        // Update selected documents if provided
        ...(selected_documents !== undefined ? { selected_documents: selected_documents } : {})
      };
      updateFields.push(`service_data = $${paramIndex++}`);
      updateValues.push(JSON.stringify(mergedData));
    }

    // Update remarks if provided
    if (remarks !== undefined) {
      updateFields.push(`remarks = $${paramIndex++}`);
      updateValues.push(remarks);
    }

    // Always update last_updated
    updateFields.push(`last_updated = NOW()`);

    // 3. Execute update
    if (updateFields.length > 0) {
      updateValues.push(id, customerId);
      
      const updateQuery = `
        UPDATE customer_services
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex++} AND customer_id = $${paramIndex}
        RETURNING *
      `;
      
      const updateResult = await client.query(updateQuery, updateValues);
      
      if (updateResult.rows.length === 0) {
        throw new Error("Failed to update service application");
      }
    }

    // 4. Create audit log
    await client.query(
      `
      INSERT INTO audit_logs (
        action,
        performed_by,
        details,
        centre_id,
        created_at
      ) VALUES ($1, $2, $3, $4, NOW())
      `,
      [
        'Service Application Updated',
        `customer:${customerId}`,
        `Updated application ${existing.application_number} for ${existing.service_name} to status: ${newStatus}`,
        null
      ]
    );

    await client.query("COMMIT");

    res.json({
      success: true,
      message: "Service application updated successfully",
      status: newStatus,
      application_number: existing.application_number
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error updating service application:", err);
    res.status(400).json({ message: err.message });
  } finally {
    client.release();
  }
});

/* ======================================================
   GET REQUIRED DOCUMENTS FOR SERVICE APPLICATION
====================================================== */
router.get("/:id/required-documents", customerAuthMiddleware, async (req, res) => {
  const { id } = req.params;
  const customerId = req.customer.id;

  try {
    // 1. Get service application
    const serviceResult = await pool.query(
      `
      SELECT cs.*, s.name as service_name
      FROM customer_services cs
      LEFT JOIN services s ON cs.service_id = s.id
      WHERE cs.id = $1 AND cs.customer_id = $2
      `,
      [id, customerId]
    );

    if (serviceResult.rows.length === 0) {
      return res.status(404).json({ message: "Service application not found" });
    }

    const service = serviceResult.rows[0];
    
    // 2. Get required documents for this service
    const requiredDocsQuery = `
      SELECT 
        rd.document_name,
        dm.scope,
        dm.requires_number,
        dm.requires_expiry,
        dm.creates_household
      FROM required_documents rd
      LEFT JOIN document_master dm ON rd.document_name = dm.name
      WHERE (rd.service_id = $1 AND rd.sub_category_id IS NULL)
         OR (rd.sub_category_id = $2)
      ORDER BY rd.document_name
    `;
    
    const requiredDocsResult = await pool.query(
      requiredDocsQuery,
      [service.service_id, service.subcategory_id]
    );

    const requiredDocuments = requiredDocsResult.rows;

    // 3. Get customer's uploaded documents
    const customerDocsQuery = `
      SELECT 
        document_name,
        status,
        version,
        is_latest,
        expiry_date,
        created_at,
        review_remarks
      FROM customer_documents
      WHERE customer_id = $1 
        AND is_latest = true
        AND document_name IN (
          SELECT document_name FROM required_documents 
          WHERE (service_id = $2 AND sub_category_id IS NULL)
             OR (sub_category_id = $3)
        )
      ORDER BY document_name
    `;
    
    const customerDocsResult = await pool.query(
      customerDocsQuery,
      [customerId, service.service_id, service.subcategory_id]
    );

    const customerDocuments = customerDocsResult.rows;

    // 4. Parse service_data to get selected documents
    let serviceData = {};
    let selectedDocuments = [];
    try {
      serviceData = service.service_data ? 
        (typeof service.service_data === 'string' ? 
          JSON.parse(service.service_data) : 
          service.service_data) : {};
      selectedDocuments = serviceData.selected_documents || [];
    } catch (e) {
      console.error("Error parsing service_data:", e);
    }

    // 5. Combine data
    const documentStatus = requiredDocuments.map(doc => {
      const customerDoc = customerDocuments.find(cd => cd.document_name === doc.document_name);
      const isSelected = selectedDocuments.includes(doc.document_name);
      
      return {
        document_name: doc.document_name,
        scope: doc.scope,
        requires_number: doc.requires_number,
        requires_expiry: doc.requires_expiry,
        creates_household: doc.creates_household,
        status: customerDoc?.status || 'not_uploaded',
        is_available: customerDoc?.status === 'approved',
        is_latest: customerDoc?.is_latest || false,
        version: customerDoc?.version || 0,
        expiry_date: customerDoc?.expiry_date,
        uploaded_at: customerDoc?.created_at,
        review_remarks: customerDoc?.review_remarks,
        is_selected: isSelected,
        can_be_selected: customerDoc?.status === 'approved'
      };
    });

    res.json({
      service_id: service.service_id,
      service_name: service.service_name,
      application_number: service.application_number,
      status: service.status,
      required_documents: documentStatus,
      total_required: requiredDocuments.length,
      available_count: documentStatus.filter(d => d.is_available).length,
      selected_count: selectedDocuments.length
    });

  } catch (err) {
    console.error("Error fetching required documents:", err);
    res.status(500).json({ message: "Failed to fetch required documents" });
  }
});

/* ======================================================
   UPDATE SELECTED DOCUMENTS FOR SERVICE APPLICATION
====================================================== */
router.put("/:id/select-documents", customerAuthMiddleware, async (req, res) => {
  const { id } = req.params;
  const customerId = req.customer.id;
  const { selected_documents } = req.body;

  if (!Array.isArray(selected_documents)) {
    return res.status(400).json({ message: "selected_documents must be an array" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Get existing service application
    const existingResult = await client.query(
      `
      SELECT cs.*, s.name as service_name
      FROM customer_services cs
      LEFT JOIN services s ON cs.service_id = s.id
      WHERE cs.id = $1 AND cs.customer_id = $2
      `,
      [id, customerId]
    );

    if (existingResult.rows.length === 0) {
      throw new Error("Service application not found");
    }

    const existing = existingResult.rows[0];
    
    // 2. Parse existing service_data
    let currentServiceData = {};
    try {
      currentServiceData = existing.service_data ? 
        (typeof existing.service_data === 'string' ? 
          JSON.parse(existing.service_data) : 
          existing.service_data) : {};
    } catch (e) {
      console.error("Error parsing existing service_data:", e);
    }

    // 3. Get required documents to validate selection
    const requiredDocsQuery = `
      SELECT document_name
      FROM required_documents
      WHERE (service_id = $1 AND sub_category_id IS NULL)
         OR (sub_category_id = $2)
    `;
    
    const requiredDocsResult = await client.query(
      requiredDocsQuery,
      [existing.service_id, existing.subcategory_id]
    );
    
    const requiredDocumentNames = requiredDocsResult.rows.map(row => row.document_name);
    
    // Validate that all selected documents are in required documents
    const invalidDocuments = selected_documents.filter(doc => !requiredDocumentNames.includes(doc));
    if (invalidDocuments.length > 0) {
      throw new Error(`Invalid document selection: ${invalidDocuments.join(', ')}`);
    }

    // 4. Check if selected documents are available (approved and latest)
    const availableDocsQuery = `
      SELECT document_name
      FROM customer_documents
      WHERE customer_id = $1 
        AND document_name = ANY($2)
        AND is_latest = true
        AND status = 'approved'
    `;
    
    const availableDocsResult = await client.query(
      availableDocsQuery,
      [customerId, selected_documents]
    );
    
    const availableDocumentNames = availableDocsResult.rows.map(row => row.document_name);
    const unavailableDocuments = selected_documents.filter(doc => !availableDocumentNames.includes(doc));
    
    if (unavailableDocuments.length > 0) {
      // If some documents are not available, we can still save the selection
      // but the application status will remain as draft
      console.log(`Some documents are not available: ${unavailableDocuments.join(', ')}`);
    }

    // 5. Update service_data with selected documents
    const updatedServiceData = {
      ...currentServiceData,
      selected_documents: selected_documents
    };

    // 6. Determine new status based on document availability
    const allDocumentsAvailable = unavailableDocuments.length === 0;
    const newStatus = allDocumentsAvailable ? 'pending_documents' : 'draft';
    const remarks = allDocumentsAvailable 
      ? 'All required documents selected. Ready for document submission.'
      : `Draft updated. ${unavailableDocuments.length} document(s) not available.`;

    // 7. Update the service application
    await client.query(
      `
      UPDATE customer_services
      SET 
        service_data = $1,
        status = $2,
        remarks = $3,
        last_updated = NOW()
      WHERE id = $4 AND customer_id = $5
      RETURNING *
      `,
      [
        JSON.stringify(updatedServiceData),
        newStatus,
        remarks,
        id,
        customerId
      ]
    );

    // 8. Create audit log
    await client.query(
      `
      INSERT INTO audit_logs (
        action,
        performed_by,
        details,
        centre_id,
        created_at
      ) VALUES ($1, $2, $3, $4, NOW())
      `,
      [
        'Documents Selected for Service',
        `customer:${customerId}`,
        `Selected ${selected_documents.length} documents for application ${existing.application_number}`,
        null
      ]
    );

    await client.query("COMMIT");

    res.json({
      success: true,
      message: allDocumentsAvailable 
        ? 'Documents selected successfully! Application is ready for document submission.'
        : 'Draft saved. Some documents are not available.',
      status: newStatus,
      selected_count: selected_documents.length,
      required_count: requiredDocumentNames.length,
      unavailable_documents: unavailableDocuments,
      next_step: allDocumentsAvailable ? 'upload_documents' : 'select_documents'
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error selecting documents:", err);
    res.status(400).json({ message: err.message });
  } finally {
    client.release();
  }
});

/* ======================================================
   UPLOAD DOCUMENTS FOR SERVICE APPLICATION
====================================================== */
router.post("/:id/documents", customerAuthMiddleware, async (req, res) => {
  const { id } = req.params;
  const customerId = req.customer.id;
  const { documents } = req.body; // Array of {document_name, document_type, file_hash, etc.}

  const client = await pool.connect();

  try {
    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      return res.status(400).json({ message: "Documents array is required" });
    }

    await client.query("BEGIN");

    // 1. Get service application
    const serviceResult = await client.query(
      `
      SELECT cs.*, s.name as service_name
      FROM customer_services cs
      LEFT JOIN services s ON cs.service_id = s.id
      WHERE cs.id = $1 AND cs.customer_id = $2
      `,
      [id, customerId]
    );

    if (serviceResult.rows.length === 0) {
      throw new Error("Service application not found");
    }

    const service = serviceResult.rows[0];

    // 2. Process each document
    const uploadedDocs = [];
    for (const doc of documents) {
      // Check if document already exists for this service
      const existingDoc = await client.query(
        `
        SELECT id FROM customer_documents 
        WHERE customer_id = $1 
        AND service_entry_id = $2
        AND document_name = $3
        AND is_latest = true
        `,
        [customerId, id, doc.document_name]
      );

      // Mark old version as not latest
      if (existingDoc.rows.length > 0) {
        await client.query(
          `UPDATE customer_documents SET is_latest = false WHERE id = $1`,
          [existingDoc.rows[0].id]
        );
      }

      // Get version number
      const versionResult = await client.query(
        `
        SELECT COALESCE(MAX(version), 0) + 1 as version
        FROM customer_documents
        WHERE customer_id = $1 AND document_name = $2
        `,
        [customerId, doc.document_name]
      );

      const version = versionResult.rows[0].version;

      // Insert new document
      const docResult = await client.query(
        `
        INSERT INTO customer_documents (
          customer_id,
          service_entry_id,
          household_id,
          document_name,
          document_type,
          scope,
          file_hash,
          mime_type,
          file_size,
          status,
          version,
          is_latest,
          uploaded_by,
          file_url
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10, true, 'customer', $11)
        RETURNING id, document_name, version
        `,
        [
          customerId,
          id,
          service.household_id,
          doc.document_name,
          doc.document_type || 'other',
          doc.scope || 'service',
          doc.file_hash,
          doc.mime_type,
          doc.file_size,
          version,
          `/api/customer/documents/temp/${doc.file_hash}`
        ]
      );

      uploadedDocs.push(docResult.rows[0]);
    }

    // 3. Update service status to under_review if it was pending_documents
    if (service.status === 'pending_documents') {
      await client.query(
        `
        UPDATE customer_services
        SET status = 'under_review', last_updated = NOW()
        WHERE id = $1 AND customer_id = $2
        `,
        [id, customerId]
      );

      // Update tracking if exists
      const trackingExists = await client.query(
        `SELECT id FROM service_tracking WHERE application_number = $1`,
        [service.application_number]
      );

      if (trackingExists.rows.length > 0) {
        await client.query(
          `
          UPDATE service_tracking
          SET status = 'under_review', current_step = 'Documents Submitted', progress = 60, updated_at = NOW()
          WHERE application_number = $1
          `,
          [service.application_number]
        );
      }
    }

    // 4. Create audit log
    await client.query(
      `
      INSERT INTO audit_logs (
        action,
        performed_by,
        details,
        centre_id,
        created_at
      ) VALUES ($1, $2, $3, $4, NOW())
      `,
      [
        'Documents Uploaded',
        `customer:${customerId}`,
        `Uploaded ${documents.length} documents for application ${service.application_number}`,
        null
      ]
    );

    await client.query("COMMIT");

    res.json({
      success: true,
      message: `Successfully uploaded ${uploadedDocs.length} documents`,
      documents: uploadedDocs,
      status: service.status === 'pending_documents' ? 'under_review' : service.status
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error uploading documents:", err);
    res.status(400).json({ message: err.message });
  } finally {
    client.release();
  }
});

/* ======================================================
   GET SERVICE APPLICATION TIMELINE
====================================================== */
router.get("/:id/timeline", customerAuthMiddleware, async (req, res) => {
  const { id } = req.params;
  const customerId = req.customer.id;

  try {
    // Get service application
    const serviceResult = await pool.query(
      `
      SELECT cs.*, s.name as service_name
      FROM customer_services cs
      LEFT JOIN services s ON cs.service_id = s.id
      WHERE cs.id = $1 AND cs.customer_id = $2
      `,
      [id, customerId]
    );

    if (serviceResult.rows.length === 0) {
      return res.status(404).json({ message: "Service application not found" });
    }

    const service = serviceResult.rows[0];
    const appNumber = service.application_number;

    // Get timeline from audit logs
    const timelineResult = await pool.query(
      `
      SELECT 
        al.id,
        al.action,
        al.details,
        al.performed_by,
        al.created_at,
        CASE 
          WHEN al.performed_by LIKE 'customer:%' THEN 'customer'
          WHEN al.performed_by LIKE 'staff:%' THEN 'staff'
          WHEN al.performed_by LIKE 'admin:%' THEN 'admin'
          ELSE 'system'
        END as actor_type,
        CASE 
          WHEN al.action LIKE '%Created%' THEN 'created'
          WHEN al.action LIKE '%Updated%' THEN 'updated'
          WHEN al.action LIKE '%Uploaded%' THEN 'upload'
          WHEN al.action LIKE '%Payment%' THEN 'payment'
          WHEN al.action LIKE '%Completed%' THEN 'completed'
          WHEN al.action LIKE '%Rejected%' THEN 'rejected'
          WHEN al.action LIKE '%Approved%' THEN 'approved'
          WHEN al.action LIKE '%Assigned%' THEN 'assigned'
          ELSE 'info'
        END as event_type
      FROM audit_logs al
      WHERE al.details LIKE $1
      ORDER BY al.created_at ASC
      `,
      [`%${appNumber}%`]
    );

    // Get service tracking data
    const trackingData = await pool.query(
      `
      SELECT 
        st.id,
        st.application_number,
        st.status,
        st.current_step,
        st.progress,
        st.updated_at,
        st.notes,
        st.assigned_to,
        staff.name as assigned_staff_name
      FROM service_tracking st
      LEFT JOIN staff ON st.assigned_to = staff.id
      WHERE st.application_number = $1 OR st.service_entry_id = $2
      ORDER BY st.updated_at ASC
      `,
      [appNumber, id]
    );

    // Get service tracking steps (the detailed timeline from staff)
    let trackingSteps = [];
    if (trackingData.rows.length > 0) {
      const trackingId = trackingData.rows[0].id;
      const stepsResult = await pool.query(
        `
        SELECT 
          sts.id,
          sts.name,
          sts.completed,
          sts.date,
          sts.created_at,
          sts.step_order,
          sts.estimated_days
        FROM service_tracking_steps sts
        WHERE sts.service_tracking_id = $1
        ORDER BY sts.step_order, sts.created_at
        `,
        [trackingId]
      );
      
      trackingSteps = stepsResult.rows.map(step => ({
        id: `step_${step.id}`,
        action: step.completed ? 'Step Completed' : 'Step Started',
        details: `${step.name} ${step.completed ? 'completed' : 'started'}`,
        performed_by: 'staff',
        actor_type: 'staff',
        event_type: step.completed ? 'completed' : 'progress',
        created_at: step.date || step.created_at,
        icon: step.completed ? 'check' : 'clock',
        step_name: step.name,
        step_order: step.step_order,
        completed: step.completed
      }));
    }

    // Create timeline entries for tracking status changes
    const trackingTimeline = trackingData.rows.map(track => {
      const events = [];
      
      // Status change event
      events.push({
        id: `tracking_${track.id}`,
        action: 'Status Updated',
        details: `Application status changed to ${track.status || 'In Progress'}`,
        performed_by: track.assigned_staff_name ? `staff:${track.assigned_staff_name}` : 'system',
        actor_type: 'staff',
        event_type: 'updated',
        created_at: track.updated_at,
        icon: 'refresh'
      });

      // Assignment event if staff assigned
      if (track.assigned_staff_name) {
        events.push({
          id: `assigned_${track.id}`,
          action: 'Staff Assigned',
          details: `Application assigned to ${track.assigned_staff_name}`,
          performed_by: 'system',
          actor_type: 'system',
          event_type: 'assigned',
          created_at: track.updated_at,
          icon: 'user'
        });
      }

      // Notes/remarks event
      if (track.notes && track.notes.trim() !== '') {
        events.push({
          id: `note_${track.id}`,
          action: 'Staff Remark',
          details: track.notes,
          performed_by: track.assigned_staff_name || 'staff',
          actor_type: 'staff',
          event_type: 'info',
          created_at: track.updated_at,
          icon: 'message'
        });
      }

      return events;
    }).flat();

    // Combine all timeline events
    const allEvents = [
      // Draft creation
      {
        id: 'draft_created',
        action: 'Draft Created',
        details: `Application draft created for ${service.service_name || 'service'}`,
        performed_by: 'customer',
        actor_type: 'customer',
        event_type: 'created',
        created_at: service.applied_at,
        icon: 'file'
      },
      
      // Document selection (from service_data)
      ...(service.service_data?.selected_documents?.length > 0 ? [{
        id: 'docs_selected',
        action: 'Documents Selected',
        details: `${service.service_data.selected_documents.length} document(s) selected`,
        performed_by: 'customer',
        actor_type: 'customer',
        event_type: 'upload',
        created_at: service.last_updated || service.applied_at,
        icon: 'check'
      }] : []),
      
      // Application submission
      ...(service.service_data?.submitted_at ? [{
        id: 'submitted',
        action: 'Application Submitted',
        details: `Application submitted successfully${service.service_data.payment?.payment_method ? ` • Payment method: ${service.service_data.payment.payment_method}` : ''}`,
        performed_by: 'customer',
        actor_type: 'customer',
        event_type: 'submitted',
        created_at: service.service_data.submitted_at,
        icon: 'send'
      }] : []),
      
      // Payment events
      ...(service.service_data?.payment?.submitted_at ? [{
        id: 'payment_initiated',
        action: 'Payment Initiated',
        details: `Payment of ₹${service.service_data.payment.amount || service.service_data.total_charges || 0} initiated via ${service.service_data.payment.payment_method || 'online'}`,
        performed_by: 'customer',
        actor_type: 'customer',
        event_type: 'payment',
        created_at: service.service_data.payment.submitted_at,
        icon: 'dollar'
      }] : []),
      
      // Payment verification (from tracking or audit logs)
      ...(service.status === 'under_review' || service.status === 'in_progress' ? [{
        id: 'payment_verification',
        action: 'Payment Verification',
        details: 'Payment verified by staff, application under review',
        performed_by: 'staff',
        actor_type: 'staff',
        event_type: 'updated',
        created_at: service.last_updated,
        icon: 'check'
      }] : []),
      
      // Add all tracking steps
      ...trackingSteps,
      
      // Add all tracking status changes
      ...trackingTimeline,
      
      // Add all audit log events
      ...timelineResult.rows.map(row => ({
        id: row.id,
        action: row.action,
        details: row.details,
        performed_by: row.performed_by,
        actor_type: row.actor_type,
        event_type: row.event_type,
        created_at: row.created_at,
        icon: row.event_type === 'created' ? 'plus' : 
              row.event_type === 'upload' ? 'upload' : 
              row.event_type === 'payment' ? 'dollar' : 
              row.event_type === 'completed' ? 'check' : 
              row.event_type === 'approved' ? 'check' : 
              row.event_type === 'assigned' ? 'user' :
              row.event_type === 'rejected' ? 'x' : 
              row.event_type === 'updated' ? 'refresh' : 'info'
      }))
    ];

    // Sort by date (oldest first for timeline)
    const sortedTimeline = allEvents.sort((a, b) => 
      new Date(a.created_at) - new Date(b.created_at)
    );

    res.json(sortedTimeline);
  } catch (err) {
    console.error("Error fetching timeline:", err);
    res.status(500).json({ message: "Failed to fetch timeline" });
  }
});

/* ======================================================
   CANCEL SERVICE APPLICATION
====================================================== */
router.delete("/:id", customerAuthMiddleware, async (req, res) => {
  const { id } = req.params;
  const customerId = req.customer.id;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Get service application
    const serviceResult = await client.query(
      `
      SELECT * FROM customer_services 
      WHERE id = $1 AND customer_id = $2
      `,
      [id, customerId]
    );

    if (serviceResult.rows.length === 0) {
      throw new Error("Service application not found");
    }

    const service = serviceResult.rows[0];

    // Check if can be cancelled
    const cancellableStatuses = ['draft', 'pending_documents', 'payment_pending'];
    if (!cancellableStatuses.includes(service.status)) {
      throw new Error(`Cannot cancel application with status: ${service.status}`);
    }

    // Update status to cancelled
    await client.query(
      `
      UPDATE customer_services
      SET status = 'cancelled', last_updated = NOW(), remarks = 'Cancelled by customer'
      WHERE id = $1 AND customer_id = $2
      `,
      [id, customerId]
    );

    // Update tracking if exists
    const trackingExists = await client.query(
      `SELECT id FROM service_tracking WHERE application_number = $1`,
      [service.application_number]
    );

    if (trackingExists.rows.length > 0) {
      await client.query(
        `
        UPDATE service_tracking
        SET status = 'cancelled', current_step = 'Cancelled', progress = 100, updated_at = NOW()
        WHERE application_number = $1
        `,
        [service.application_number]
      );
    }

    // Create audit log
    await client.query(
      `
      INSERT INTO audit_logs (
        action,
        performed_by,
        details,
        centre_id,
        created_at
      ) VALUES ($1, $2, $3, $4, NOW())
      `,
      [
        'Service Application Cancelled',
        `customer:${customerId}`,
        `Cancelled application ${service.application_number}`,
        null
      ]
    );

    await client.query("COMMIT");

    res.json({
      success: true,
      message: "Service application cancelled successfully"
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error cancelling service application:", err);
    res.status(400).json({ message: err.message });
  } finally {
    client.release();
  }
});

/* ======================================================
   SUBMIT SERVICE APPLICATION (PAYMENT PENDING)
====================================================== */
router.put("/:id/payment", customerAuthMiddleware, async (req, res) => {
  const { id } = req.params;
  const customerId = req.customer.id;
  const {
    payment_method,
    additional_info,
    selected_documents
  } = req.body;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Get existing service application
    const existingResult = await client.query(
      `
      SELECT cs.*, s.name as service_name, s.requires_workflow
      FROM customer_services cs
      LEFT JOIN services s ON cs.service_id = s.id
      WHERE cs.id = $1 AND cs.customer_id = $2
      `,
      [id, customerId]
    );

    if (existingResult.rows.length === 0) {
      throw new Error("Service application not found");
    }

    const existing = existingResult.rows[0];
    
    // 2. Parse existing service_data
    let currentServiceData = {};
    try {
      currentServiceData = existing.service_data ? 
        (typeof existing.service_data === 'string' ? 
          JSON.parse(existing.service_data) : 
          existing.service_data) : {};
    } catch (e) {
      console.error("Error parsing existing service_data:", e);
    }

    // 3. Get total charges from service_data
    const totalCharges = currentServiceData.total_charges || 0;
    
    // 4. Update service_data with payment info and additional info
    const updatedServiceData = {
      ...currentServiceData,
      payment: {
        payment_method: payment_method || 'external',
        payment_status: 'pending', // Payment is pending verification
        amount: totalCharges,
        submitted_at: new Date().toISOString()
      },
      additional_info: additional_info || currentServiceData.additional_info || {},
      selected_documents: selected_documents || currentServiceData.selected_documents || [],
      submitted_at: new Date().toISOString()
    };

    // 5. Update status to under_review (payment pending)
    const newStatus = 'under_review';
    const remarks = payment_method === 'cash' 
      ? 'Application submitted. Payment to be made at office.' 
      : 'Application submitted. Payment verification pending.';

    // 6. Update the service application
    const updateResult = await client.query(
      `
      UPDATE customer_services
      SET 
        service_data = $1,
        status = $2,
        remarks = $3,
        last_updated = NOW()
      WHERE id = $4 AND customer_id = $5
      RETURNING *
      `,
      [
        JSON.stringify(updatedServiceData),
        newStatus,
        remarks,
        id,
        customerId
      ]
    );

    // 7. Create audit log
    await client.query(
      `
      INSERT INTO audit_logs (
        action,
        performed_by,
        details,
        centre_id,
        created_at
      ) VALUES ($1, $2, $3, $4, NOW())
      `,
      [
        'Application Submitted',
        `customer:${customerId}`,
        `Application ${existing.application_number} submitted. Payment method: ${payment_method || 'external'}. Amount: ₹${totalCharges}`,
        null
      ]
    );

    await client.query("COMMIT");

    res.json({
      success: true,
      message: payment_method === 'cash' 
        ? 'Application submitted! Please visit our office to complete payment.' 
        : 'Application submitted! Staff will contact you for payment verification.',
      status: newStatus,
      application_number: existing.application_number,
      payment_status: 'pending',
      next_step: 'confirmation'
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error submitting application:", err);
    res.status(400).json({ message: err.message });
  } finally {
    client.release();
  }
});

export default router;