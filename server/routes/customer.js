import express from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import multer from "multer";
import path from "path";
import fs from "fs";
import pool from "../db.js";
import { sendWhatsAppOTP } from "../utils/whatsapp.js";
import { authMiddleware } from "./staff.js";

const router = express.Router();

/* ======================================================
   MULTER CONFIGURATION FOR FILE UPLOAD
====================================================== */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "uploads/customer-photos";
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: customerId_timestamp.extension
    const customerId = req.customerId || "temp";
    const timestamp = Date.now();
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `customer_${customerId}_${timestamp}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  // Accept image files only
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error("Only image files (jpeg, jpg, png, gif, webp) are allowed"));
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1
  }
});

/* ======================================================
   HELPERS
====================================================== */

// Hash Aadhaar / Ration / etc
const hashValue = (value) => {
  return crypto
    .createHash("sha256")
    .update(value.trim())
    .digest("hex");
};

// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// OTP expiry (minutes)
const OTP_EXPIRY_MINUTES = 5;

// Get customer ID from token
const getCustomerIdFromToken = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  
  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.CUSTOMER_JWT_SECRET);
    return decoded.customer_id;
  } catch (err) {
    return null;
  }
};

// Delete old profile photo if exists
const deleteOldProfilePhoto = async (customerId) => {
  try {
    const result = await pool.query(
      `SELECT profile_photo FROM customers WHERE id = $1`,
      [customerId]
    );
    
    if (result.rows.length > 0 && result.rows[0].profile_photo) {
      const oldPhotoPath = result.rows[0].profile_photo;
      // Remove 'uploads/' from path to get relative path
      const relativePath = oldPhotoPath.replace(/^uploads\//, '');
      const fullPath = path.join('uploads', relativePath);
      
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }
  } catch (err) {
    console.error("Error deleting old profile photo:", err);
  }
};

/* ======================================================
   1. SEND AADHAAR OTP
   POST /api/customer/send-aadhaar-otp
====================================================== */
router.post("/send-aadhaar-otp", async (req, res) => {
  const { aadhaar, phone } = req.body;

  if (!aadhaar || aadhaar.length !== 12 || !phone) {
    return res.status(400).json({ message: "Invalid Aadhaar or phone number" });
  }

  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60000);

  try {
    // Remove old OTPs for this Aadhaar
    await pool.query(
      `DELETE FROM customer_otps WHERE phone = $1`,
      [phone]
    );

    await pool.query(
      `
      INSERT INTO customer_otps (phone, otp, expires_at)
      VALUES ($1, $2, $3)
      `,
      [phone, otp, expiresAt]
    );

    // TODO: Integrate WhatsApp / SMS gateway here
    await sendWhatsAppOTP({ phone, otp });

    return res.json({ success: true });
  } catch (err) {
    console.error("send-aadhaar-otp error:", err);
    return res.status(500).json({ message: "Failed to send OTP" });
  }
});

/* ======================================================
   2. VERIFY AADHAAR OTP
   POST /api/customer/verify-aadhaar-otp
====================================================== */
router.post("/verify-aadhaar-otp", async (req, res) => {
  const { aadhaar, otp } = req.body;

  if (!aadhaar || !otp) {
    return res.status(400).json({ message: "Missing Aadhaar or OTP" });
  }

  try {
    const otpResult = await pool.query(
      `
      SELECT * FROM customer_otps
      WHERE otp = $1
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [otp]
    );

    if (otpResult.rows.length === 0) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    const record = otpResult.rows[0];

    if (new Date(record.expires_at) < new Date()) {
      return res.status(400).json({ message: "OTP expired" });
    }

    // OTP valid → Aadhaar verified
    return res.json({
      success: true,
      customerData: null // Placeholder for future UIDAI prefill
    });
  } catch (err) {
    console.error("verify-aadhaar-otp error:", err);
    return res.status(500).json({ message: "OTP verification failed" });
  }
});

/* ======================================================
   3. REGISTER CUSTOMER
   POST /api/customer/register
====================================================== */
router.post("/register", async (req, res) => {
  const {
    aadhaar,
    primary_phone,
    email,
    name,
    address,
    pincode,
    district,
    state
  } = req.body;

  if (!aadhaar || aadhaar.length !== 12) {
    return res.status(400).json({ message: "Invalid Aadhaar" });
  }

  const aadhaarHash = hashValue(aadhaar);
  const aadhaarLast4 = aadhaar.slice(-4);

  try {
    // Check if customer already exists
    const existing = await pool.query(
      `SELECT id FROM customers WHERE aadhaar_hash = $1`,
      [aadhaarHash]
    );

    if (existing.rows.length > 0) {
      return res.status(200).json({
        success: true,
        message: "Customer already exists"
      });
    }

    await pool.query(
      `
      INSERT INTO customers (
        aadhaar_hash,
        aadhaar_last4,
        primary_phone,
        email,
        name,
        address,
        pincode,
        district,
        state,
        is_verified,
        verified_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,NOW())
      `,
      [
        aadhaarHash,
        aadhaarLast4,
        primary_phone,
        email,
        name,
        address,
        pincode,
        district,
        state || "Kerala"
      ]
    );

    return res.json({ success: true });
  } catch (err) {
    console.error("register error:", err);
    return res.status(500).json({ message: "Registration failed" });
  }
});

/* ======================================================
   4. CUSTOMER LOGIN (PHONE OTP)
   POST /api/customer/send-otp
====================================================== */
router.post("/send-otp", async (req, res) => {
  const { phone } = req.body;

  if (!phone || phone.length !== 10) {
    return res.status(400).json({ message: "Invalid phone number" });
  }

  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60000);

  try {
    await pool.query(`DELETE FROM customer_otps WHERE phone = $1`, [phone]);

    await pool.query(
      `
      INSERT INTO customer_otps (phone, otp, expires_at)
      VALUES ($1, $2, $3)
      `,
      [phone, otp, expiresAt]
    );

    await sendWhatsAppOTP({ phone, otp });

    return res.json({ success: true });
  } catch (err) {
    console.error("send-otp error:", err);
    return res.status(500).json({ message: "Failed to send OTP" });
  }
});

/* ======================================================
   5. VERIFY LOGIN OTP → ISSUE JWT
   POST /api/customer/verify-otp
====================================================== */
router.post("/verify-otp", async (req, res) => {
  const { phone, otp } = req.body;

  try {
    const otpResult = await pool.query(
      `
      SELECT * FROM customer_otps
      WHERE phone = $1 AND otp = $2
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [phone, otp]
    );

    if (otpResult.rows.length === 0) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    const record = otpResult.rows[0];

    if (new Date(record.expires_at) < new Date()) {
      return res.status(400).json({ message: "OTP expired" });
    }

    const customerResult = await pool.query(
      `SELECT id, name FROM customers WHERE primary_phone = $1`,
      [phone]
    );

    if (customerResult.rows.length === 0) {
      return res.status(404).json({ message: "User not registered" });
    }

    const customer = customerResult.rows[0];

    const token = jwt.sign(
      { customer_id: customer.id },
      process.env.CUSTOMER_JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      success: true,
      token,
      customerId: customer.id,
      name: customer.name
    });
  } catch (err) {
    console.error("verify-otp error:", err);
    return res.status(500).json({ message: "Login failed" });
  }
});

/* ======================================================
   6. VERIFY CUSTOMER TOKEN (for CustomerProtectedRoute)
   GET /api/customer/verify
====================================================== */
router.get("/verify", async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: "Token missing" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.CUSTOMER_JWT_SECRET);

    const result = await pool.query(
      `SELECT id FROM customers WHERE id = $1 AND status = 'active'`,
      [decoded.customer_id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Invalid customer" });
    }

    return res.json({ success: true });
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
});

/* ======================================================
   7. GET CUSTOMER PROFILE
   GET /api/customer/profile
====================================================== */
router.get("/profile", async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: "Token missing" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.CUSTOMER_JWT_SECRET);

    const result = await pool.query(
      `
      SELECT 
        id,
        name,
        primary_phone as phone,
        email,
        date_of_birth,
        gender,
        marital_status,
        date_of_marriage,
        address,
        district,
        state,
        pincode,
        occupation,
        emergency_contact,
        profile_photo,
        is_verified,
        created_at,
        updated_at
      FROM customers
      WHERE id = $1 AND status = 'active'
      `,
      [decoded.customer_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const customer = result.rows[0];
    
    // If profile_photo exists, convert to full URL
    if (customer.profile_photo) {
      customer.profile_photo_url = `${req.protocol}://${req.get('host')}/${customer.profile_photo}`;
    }

    return res.json(customer);
  } catch (err) {
    console.error("get profile error:", err);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
});

/* ======================================================
   8. UPDATE CUSTOMER PROFILE
   PUT /api/customer/profile
====================================================== */
router.put("/profile", async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: "Token missing" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.CUSTOMER_JWT_SECRET);

    const {
      name,
      email,
      dateOfBirth,
      gender,
      maritalStatus,
      dateOfMarriage,
      address,
      district,
      state,
      pincode,
      occupation,
      emergencyContact
    } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({ message: "Name is required" });
    }

    // Email is optional, but if provided, validate format
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "Invalid email format" });
      }
    }

    // Validate date formats
    if (dateOfBirth) {
      const dob = new Date(dateOfBirth);
      const today = new Date();
      if (dob > today) {
        return res.status(400).json({ message: "Date of birth cannot be in the future" });
      }
    }

    if (maritalStatus === 'married' && dateOfMarriage) {
      const marriageDate = new Date(dateOfMarriage);
      const dob = dateOfBirth ? new Date(dateOfBirth) : null;
      const today = new Date();
      
      if (marriageDate > today) {
        return res.status(400).json({ message: "Marriage date cannot be in the future" });
      }
      
      if (dob && marriageDate < dob) {
        return res.status(400).json({ message: "Marriage date cannot be before date of birth" });
      }
    }

    // Validate pincode format
    if (pincode && !/^\d{6}$/.test(pincode)) {
      return res.status(400).json({ message: "Pincode must be 6 digits" });
    }

    const result = await pool.query(
      `
      UPDATE customers
      SET 
        name = $1,
        email = COALESCE($2, email),
        date_of_birth = $3,
        gender = $4,
        marital_status = $5,
        date_of_marriage = $6,
        address = $7,
        district = $8,
        state = $9,
        pincode = $10,
        occupation = $11,
        emergency_contact = $12,
        updated_at = NOW()
      WHERE id = $13 AND status = 'active'
      RETURNING 
        id, name, email, primary_phone as phone, 
        date_of_birth, gender, marital_status, date_of_marriage,
        address, district, state, pincode, occupation, emergency_contact,
        profile_photo,
        created_at, updated_at
      `,
      [
        name,
        email || null,
        dateOfBirth || null,
        gender || null,
        maritalStatus || null,
        maritalStatus === 'married' ? dateOfMarriage || null : null,
        address || null,
        district || null,
        state || null,
        pincode || null,
        occupation || null,
        emergencyContact || null,
        decoded.customer_id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const updatedProfile = result.rows[0];
    
    // If profile_photo exists, convert to full URL
    if (updatedProfile.profile_photo) {
      updatedProfile.profile_photo_url = `${req.protocol}://${req.get('host')}/${updatedProfile.profile_photo}`;
    }

    return res.json({ 
      success: true, 
      message: "Profile updated successfully",
      profile: updatedProfile
    });
  } catch (err) {
    console.error("update profile error:", err);
    
    // Handle duplicate email
    if (err.code === '23505' && err.constraint.includes('email')) {
      return res.status(400).json({ message: "Email already exists" });
    }
    
    return res.status(500).json({ message: "Failed to update profile" });
  }
});

/* ======================================================
   9. UPLOAD PROFILE PHOTO
   POST /api/customer/profile-photo
====================================================== */
router.post("/profile-photo", upload.single('photo'), async (req, res) => {
  const customerId = getCustomerIdFromToken(req);
  
  if (!customerId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  try {
    // Delete old profile photo if exists
    await deleteOldProfilePhoto(customerId);

    // Save new profile photo path to database
    const photoPath = req.file.path;
    
    const result = await pool.query(
      `
      UPDATE customers
      SET profile_photo = $1, updated_at = NOW()
      WHERE id = $2 AND status = 'active'
      RETURNING id, name, profile_photo
      `,
      [photoPath, customerId]
    );

    if (result.rows.length === 0) {
      // Delete the uploaded file if customer not found
      fs.unlinkSync(photoPath);
      return res.status(404).json({ message: "Customer not found" });
    }

    const profilePhotoUrl = `${req.protocol}://${req.get('host')}/${photoPath}`;

    return res.json({
      success: true,
      message: "Profile photo uploaded successfully",
      profile_photo: photoPath,
      profile_photo_url: profilePhotoUrl
    });
  } catch (err) {
    console.error("upload profile photo error:", err);
    
    // Delete the uploaded file in case of error
    if (req.file && req.file.path) {
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    }
    
    return res.status(500).json({ message: "Failed to upload profile photo" });
  }
});

/* ======================================================
   10. DELETE PROFILE PHOTO
   DELETE /api/customer/profile-photo
====================================================== */
router.delete("/profile-photo", async (req, res) => {
  const customerId = getCustomerIdFromToken(req);
  
  if (!customerId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    // Get current photo path
    const result = await pool.query(
      `SELECT profile_photo FROM customers WHERE id = $1`,
      [customerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const currentPhotoPath = result.rows[0].profile_photo;

    if (!currentPhotoPath) {
      return res.status(400).json({ message: "No profile photo to delete" });
    }

    // Delete the file from server
    if (fs.existsSync(currentPhotoPath)) {
      fs.unlinkSync(currentPhotoPath);
    }

    // Update database
    await pool.query(
      `UPDATE customers SET profile_photo = NULL, updated_at = NOW() WHERE id = $1`,
      [customerId]
    );

    return res.json({
      success: true,
      message: "Profile photo deleted successfully"
    });
  } catch (err) {
    console.error("delete profile photo error:", err);
    return res.status(500).json({ message: "Failed to delete profile photo" });
  }
});

/* ======================================================
   11. GET ALL CUSTOMERS (STAFF / ADMIN / SUPERADMIN)
   GET /api/customer/
====================================================== */
router.get("/", authMiddleware(["staff", "supervisor", "admin", "superadmin"]), async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT 
        id, 
        name, 
        primary_phone, 
        email, 
        aadhaar_last4,
        address,
        district,
        state,
        pincode,
        date_of_birth,
        gender,
        marital_status,
        date_of_marriage,
        occupation,
        emergency_contact,
        profile_photo,
        is_verified,
        verified_at,
        status,
        created_at,
        updated_at
      FROM customers 
      ORDER BY created_at DESC
      `
    );
    
    // Transform the response to ensure consistent field names
    const customers = result.rows.map(customer => ({
      id: customer.id,
      name: customer.name,
      phone: customer.primary_phone, // Use primary_phone consistently
      email: customer.email,
      aadhaar_last4: customer.aadhaar_last4,
      address: customer.address,
      district: customer.district,
      state: customer.state,
      pincode: customer.pincode,
      date_of_birth: customer.date_of_birth,
      gender: customer.gender,
      marital_status: customer.marital_status,
      date_of_marriage: customer.date_of_marriage,
      occupation: customer.occupation,
      emergency_contact: customer.emergency_contact,
      profile_photo: customer.profile_photo,
      is_verified: customer.is_verified,
      verified_at: customer.verified_at,
      status: customer.status,
      created_at: customer.created_at,
      updated_at: customer.updated_at
    }));
    
    res.json(customers);
  } catch (err) {
    console.error("Error fetching all customers:", err);
    res.status(500).json({ message: "Failed to fetch customers" });
  }
});

/* ======================================================
   12. GET CUSTOMER BY ID (STAFF / ADMIN / SUPERADMIN)
   GET /api/customer/:id
====================================================== */
router.get(
  "/:id",
  authMiddleware(["staff", "admin", "superadmin"]),
  async (req, res) => {
    const { id } = req.params;

    try {
      const result = await pool.query(
        `
        SELECT
          c.id,
          c.name,
          c.primary_phone AS phone,
          c.email,
          c.date_of_birth,
          c.gender,
          c.marital_status,
          c.occupation,
          c.emergency_contact,
          c.address,
          c.district,
          c.state,
          c.pincode,
          c.is_verified,
          c.verified_at,
          c.status,
          c.created_at,
          c.updated_at,

          -- Aadhaar (from documents)
          aadhaar.document_number AS aadhaar_number,
          aadhaar.status AS aadhaar_status,

          -- Ration Card (from documents)
          ration.document_number AS ration_card_number,
          ration.status AS ration_card_status

        FROM customers c

        LEFT JOIN customer_documents aadhaar
          ON aadhaar.customer_id = c.id
          AND aadhaar.document_name = 'Aadhaar Card'
          AND aadhaar.is_latest = true

        LEFT JOIN customer_documents ration
          ON ration.customer_id = c.id
          AND ration.document_name = 'Ration Card'
          AND ration.is_latest = true

        WHERE c.id = $1
        `,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Customer not found" });
      }

      res.json(result.rows[0]);
    } catch (err) {
      console.error("Get customer by ID (staff) error:", err);
      res.status(500).json({ message: "Failed to fetch customer" });
    }
  }
);

export default router;