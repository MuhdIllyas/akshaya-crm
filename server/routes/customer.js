import express from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import multer from "multer";
import path from "path";
import fs from "fs";
import pool from "../db.js";
import { currentTenant } from "../tenancy/context.js";
import { sendWhatsAppOTP } from "../utils/whatsapp.js";
import { generateOtp, checkSend, checkVerifyIp, recordWrong, clearWrong } from "../utils/otpGuard.js";
import { authMiddleware } from "./staff.js";
import { orgUploadPath } from '../tenancy/uploads.js';

const router = express.Router();

/* ======================================================
   MULTER CONFIGURATION FOR FILE UPLOAD
====================================================== */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = orgUploadPath("customer-photos").rel;
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
   OTP HELPERS
   Codes are tied to one phone, used once, thrown away after
   MAX_WRONG wrong tries, and sending is rate limited (utils/otpGuard.js).
====================================================== */
const clientIp = (req) => String(req.ip || "").replace(/^::ffff:/, "");
const orgSlug = () => currentTenant()?.slug || "default";
const validPhone = (phone) => /^\d{10}$/.test(String(phone || ""));

// Store a fresh code for this phone and send it on WhatsApp.
async function issueOtp(req, res, phone) {
  const blocked = checkSend(orgSlug(), phone, clientIp(req));
  if (blocked) {
    res.status(429).json({ message: blocked });
    return false;
  }
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60000);
  await pool.query(`DELETE FROM customer_otps WHERE phone = $1`, [phone]);
  await pool.query(
    `INSERT INTO customer_otps (phone, otp, expires_at) VALUES ($1, $2, $3)`,
    [phone, otp, expiresAt]
  );
  await sendWhatsAppOTP({ phone, otp });
  return true;
}

// Check a code for this phone. Returns an error { status, message } or null.
// A correct code is deleted, so it works only once.
async function consumeOtp(req, phone, otp) {
  const ipBlocked = checkVerifyIp(orgSlug(), clientIp(req));
  if (ipBlocked) return { status: 429, message: ipBlocked };

  const { rows } = await pool.query(
    `SELECT otp, expires_at FROM customer_otps
      WHERE phone = $1 ORDER BY created_at DESC LIMIT 1`,
    [phone]
  );
  const record = rows[0];
  if (!record) return { status: 400, message: "Invalid OTP" };
  if (new Date(record.expires_at) < new Date()) {
    await pool.query(`DELETE FROM customer_otps WHERE phone = $1`, [phone]);
    return { status: 400, message: "OTP expired" };
  }

  const given = Buffer.from(String(otp || ""));
  const stored = Buffer.from(String(record.otp));
  const matches = given.length === stored.length && crypto.timingSafeEqual(given, stored);
  if (!matches) {
    if (recordWrong(orgSlug(), phone)) {
      await pool.query(`DELETE FROM customer_otps WHERE phone = $1`, [phone]);
      return { status: 400, message: "Too many wrong codes. Please ask for a new OTP." };
    }
    return { status: 400, message: "Invalid OTP" };
  }

  clearWrong(orgSlug(), phone);
  await pool.query(`DELETE FROM customer_otps WHERE phone = $1`, [phone]);
  return null;
}

// Proof (valid 30 minutes) that this phone and ID were verified by OTP;
// /register only accepts details that come with it.
const REGISTRATION_TOKEN_MINUTES = 30;
const signRegistrationToken = (phone, aadhaarHash) =>
  jwt.sign(
    { purpose: "customer-register", phone, aadhaar_hash: aadhaarHash, org: orgSlug() },
    process.env.CUSTOMER_JWT_SECRET,
    { expiresIn: `${REGISTRATION_TOKEN_MINUTES}m` }
  );

/* ======================================================
   1. SEND AADHAAR OTP
   POST /api/customer/send-aadhaar-otp
====================================================== */
router.post("/send-aadhaar-otp", async (req, res) => {
  const { aadhaar, phone } = req.body;

  if (!aadhaar || String(aadhaar).length !== 12 || !validPhone(phone)) {
    return res.status(400).json({ message: "Invalid Aadhaar or phone number" });
  }

  try {
    if (!(await issueOtp(req, res, phone))) return;
    return res.json({ success: true });
  } catch (err) {
    console.error("send-aadhaar-otp error:", err);
    return res.status(500).json({ message: "Failed to send OTP" });
  }
});

/* ======================================================
   2. VERIFY AADHAAR OTP
   POST /api/customer/verify-aadhaar-otp
   Returns registration_token, which /register requires.
====================================================== */
router.post("/verify-aadhaar-otp", async (req, res) => {
  const { aadhaar, phone, otp } = req.body;

  if (!aadhaar || String(aadhaar).length !== 12 || !validPhone(phone) || !otp) {
    return res.status(400).json({ message: "Missing Aadhaar, phone or OTP" });
  }

  try {
    const failed = await consumeOtp(req, phone, otp);
    if (failed) return res.status(failed.status).json({ message: failed.message });

    // OTP valid → this phone and ID can be registered
    return res.json({
      success: true,
      registration_token: signRegistrationToken(phone, hashValue(String(aadhaar))),
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
   Needs the registration_token from verify-aadhaar-otp.
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
    state,
    registration_token
  } = req.body;

  if (!aadhaar || String(aadhaar).length !== 12) {
    return res.status(400).json({ message: "Invalid Aadhaar" });
  }

  const aadhaarHash = hashValue(String(aadhaar));
  const aadhaarLast4 = String(aadhaar).slice(-4);

  let proof;
  try {
    proof = jwt.verify(String(registration_token || ""), process.env.CUSTOMER_JWT_SECRET);
  } catch {
    return res.status(401).json({ message: "Please verify your phone number with the OTP first" });
  }
  if (proof.purpose !== "customer-register" || proof.org !== orgSlug()) {
    return res.status(401).json({ message: "Please verify your phone number with the OTP first" });
  }
  if (proof.phone !== String(primary_phone) || proof.aadhaar_hash !== aadhaarHash) {
    return res.status(400).json({
      message: "The phone number or ID was changed after verification. Please verify again."
    });
  }

  try {
    // Check if customer already exists
    const existing = await pool.query(
      `SELECT id, name, primary_phone FROM customers WHERE aadhaar_hash = $1`,
      [aadhaarHash]
    );

    if (existing.rows.length > 0) {
      const found = existing.rows[0];
      // Same person, same phone (just verified): sign them in.
      if (String(found.primary_phone || "").replace(/\D/g, "").slice(-10) === proof.phone) {
        const token = jwt.sign(
          { customer_id: found.id, org: orgSlug() },
          process.env.CUSTOMER_JWT_SECRET,
          { expiresIn: "7d" }
        );
        return res.json({ success: true, existing: true, token, customerId: found.id, name: found.name, org_slug: orgSlug() });
      }
      // The ID belongs to a customer with another phone. The OTP proves this
      // phone, not the ID, so the phone on that account is not changed here.
      return res.status(409).json({
        message: "This ID is already registered with another phone number. Sign in with that number, or ask the centre to update it."
      });
    }

    const inserted = await pool.query(
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
      RETURNING id, name
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

    // The phone was just verified by OTP, so sign the new customer in
    // straight away instead of asking for another code.
    const customer = inserted.rows[0];
    const token = jwt.sign(
      { customer_id: customer.id, org: orgSlug() },
      process.env.CUSTOMER_JWT_SECRET,
      { expiresIn: "7d" }
    );
    return res.json({ success: true, token, customerId: customer.id, name: customer.name, org_slug: orgSlug() });
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

  if (!validPhone(phone)) {
    return res.status(400).json({ message: "Invalid phone number" });
  }

  try {
    if (!(await issueOtp(req, res, phone))) return;
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

  if (!validPhone(phone) || !otp) {
    return res.status(400).json({ message: "Invalid phone number or OTP" });
  }

  try {
    const failed = await consumeOtp(req, phone, otp);
    if (failed) return res.status(failed.status).json({ message: failed.message });

    const customerResult = await pool.query(
      `SELECT id, name FROM customers WHERE primary_phone = $1`,
      [phone]
    );

    if (customerResult.rows.length === 0) {
      return res.status(404).json({ message: "User not registered" });
    }

    const customer = customerResult.rows[0];

    const token = jwt.sign(
      { customer_id: customer.id, org: currentTenant().slug },
      process.env.CUSTOMER_JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      success: true,
      token,
      customerId: customer.id,
      name: customer.name,
      org_slug: currentTenant().slug
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