import express from "express";
import crypto from "crypto";
import axios from "axios";
import pool from "../db.js";
import { customerAuthMiddleware } from "../middlewares/customerAuthMiddleware.js";

const router = express.Router();

/* -------------------------------------------------------
   1️⃣ CREATE REVIEW REQUEST (For service_tracking)
------------------------------------------------------- */

export async function createReviewRequest({
  centreId,
  trackingId,
  serviceId,
  staffId,
  customerName,
  customerPhone,
  centreName
}) {
  try {
    const token = crypto.randomUUID();

    await pool.query(
      `INSERT INTO service_reviews
       (centre_id, tracking_id, service_id, staff_id,
        customer_name, customer_phone, review_token)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        centreId,
        trackingId,
        serviceId,
        staffId,
        customerName,
        customerPhone,
        token
      ]
    );

  // Send WhatsApp Template (Libromi)
  if (process.env.LIBROMI_ACCESS_TOKEN) {

    const formattedPhone = customerPhone.startsWith("+91")
      ? customerPhone
      : `+91${customerPhone}`;

    await axios.post(
      "https://wa-api.cloud/api/v1/messages",
      {
        to: formattedPhone,
        type: "template",
        template: {
          name: "service_feedback_request",
          language: {
            code: "en",
            policy: "deterministic"
          },
          components: [
            {
              type: "body"
            },
            {
              type: "button",
              sub_type: "url",
              index: "0",
              parameters: [
                {
                  type: "text",
                  text: token   // 🔥 this is your dynamic URL part
                }
              ]
            }
          ]
        }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.LIBROMI_ACCESS_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );
  }

    return { success: true, token };

  } catch (error) {
    console.error("Review request error:", error);
    return { success: false, error };
  }
}

/* -------------------------------------------------------
   2️⃣ GET PUBLIC REVIEW BY TOKEN (Check if already submitted)
------------------------------------------------------- */

router.get("/public/:token", async (req, res) => {
  try {
    const { token } = req.params;

    const review = await pool.query(
      `SELECT sr.*, 
              s.name as service_name,
              st.name as staff_name,
              se.customer_name as entry_customer_name,
              se.phone as entry_phone
       FROM service_reviews sr
       LEFT JOIN services s ON sr.service_id = s.id
       LEFT JOIN staff st ON sr.staff_id = st.id
       LEFT JOIN service_entries se ON sr.tracking_id = se.id
       WHERE sr.review_token = $1`,
      [token]
    );

    if (review.rows.length === 0) {
      return res.status(404).json({ message: "Invalid review link" });
    }

    // Return review data (don't expose sensitive info)
    res.json({
      id: review.rows[0].id,
      service_name: review.rows[0].service_name,
      staff_name: review.rows[0].staff_name,
      customer_name: review.rows[0].customer_name || review.rows[0].entry_customer_name,
      is_submitted: review.rows[0].is_submitted,
      service_rating: review.rows[0].service_rating,
      staff_rating: review.rows[0].staff_rating,
      review_text: review.rows[0].review_text,
      submitted_at: review.rows[0].submitted_at
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

/* -------------------------------------------------------
   3️⃣ PUBLIC REVIEW SUBMISSION (No login)
------------------------------------------------------- */

router.post("/public/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const { service_rating, staff_rating, review_text } = req.body;

    if (!service_rating || !review_text) {
      return res.status(400).json({ message: "Rating and review required" });
    }

    if (service_rating < 1 || service_rating > 5) {
      return res.status(400).json({ message: "Rating must be between 1 and 5" });
    }

    const review = await pool.query(
      `SELECT * FROM service_reviews
       WHERE review_token = $1`,
      [token]
    );

    if (review.rows.length === 0) {
      return res.status(404).json({ message: "Invalid review link" });
    }

    if (review.rows[0].is_submitted) {
      return res.status(400).json({ message: "Review already submitted" });
    }

    await pool.query(
      `UPDATE service_reviews
       SET service_rating = $1,
           staff_rating = $2,
           review_text = $3,
           is_submitted = true,
           submitted_at = NOW()
       WHERE review_token = $4`,
      [service_rating, staff_rating || null, review_text, token]
    );

    res.json({ success: true, message: "Review submitted successfully" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

/* -------------------------------------------------------
   4️⃣ CUSTOMER PORTAL REVIEW (Logged in) - FIXED with centre_id from staff table
------------------------------------------------------- */

router.post("/booking/:bookingId", customerAuthMiddleware, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { service_rating, staff_rating, review_text } = req.body;

    // Check if customer is authenticated
    if (!req.customer || !req.customer.id) {
      console.error('Customer authentication failed:', req.customer);
      return res.status(401).json({ message: "Authentication required" });
    }

    const customerId = req.customer.id;

    if (!service_rating || !review_text) {
      return res.status(400).json({ message: "Rating and review required" });
    }

    if (service_rating < 1 || service_rating > 5) {
      return res.status(400).json({ message: "Rating must be between 1 and 5" });
    }

    // Check if booking exists and belongs to customer - get staff_id from customer_services
    const booking = await pool.query(
      `SELECT cs.*, 
              cs.service_id,
              cs.assigned_staff_id as staff_id,
              cs.customer_id
       FROM customer_services cs
       WHERE cs.id = $1 AND cs.customer_id = $2`,
      [bookingId, customerId]
    );

    if (booking.rows.length === 0) {
      return res.status(404).json({ message: "Booking not found" });
    }

    const bookingData = booking.rows[0];

    // Check if booking is completed
    if (bookingData.status !== 'completed') {
      return res.status(400).json({ message: "Can only review completed bookings" });
    }

    // Check if review already exists for this booking
    const existingReview = await pool.query(
      `SELECT id FROM service_reviews WHERE booking_id = $1`,
      [bookingId]
    );

    if (existingReview.rows.length > 0) {
      return res.status(400).json({ message: "Review already submitted for this booking" });
    }

    // Get centre_id from staff table using assigned_staff_id
    let centreId = null;
    if (bookingData.staff_id) {
      const staffResult = await pool.query(
        `SELECT centre_id FROM staff WHERE id = $1`,
        [bookingData.staff_id]
      );
      if (staffResult.rows.length > 0) {
        centreId = staffResult.rows[0].centre_id;
      }
    }

    // If no staff assigned or staff not found, we need to handle this case
    if (!centreId) {
      return res.status(400).json({ message: "Unable to determine centre for this booking" });
    }

    // Insert review with centre_id from staff table
    await pool.query(
      `INSERT INTO service_reviews
       (centre_id, customer_id, booking_id,
        service_id, staff_id,
        service_rating, staff_rating,
        review_text, is_submitted, submitted_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,NOW())`,
      [
        centreId,
        customerId,
        bookingId,
        bookingData.service_id,
        bookingData.staff_id || null,
        service_rating,
        staff_rating || null,
        review_text
      ]
    );

    res.json({ success: true, message: "Review submitted successfully" });

  } catch (error) {
    console.error('Review submission error:', error);
    res.status(500).json({ message: "Server error: " + error.message });
  }
});

/* -------------------------------------------------------
   5️⃣ CHECK BOOKING REVIEW ELIGIBILITY
------------------------------------------------------- */

router.get("/booking/:bookingId/eligibility", customerAuthMiddleware, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const customerId = req.customer.id;

    // Check if booking exists and is completed
    const booking = await pool.query(
      `SELECT id, status FROM customer_services 
       WHERE id = $1 AND customer_id = $2`,
      [bookingId, customerId]
    );

    if (booking.rows.length === 0) {
      return res.status(404).json({ message: "Booking not found" });
    }

    // Check if already reviewed
    const existingReview = await pool.query(
      `SELECT id FROM service_reviews WHERE booking_id = $1`,
      [bookingId]
    );

    res.json({
      eligible: booking.rows[0].status === 'completed',
      already_reviewed: existingReview.rows.length > 0,
      status: booking.rows[0].status
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

/* -------------------------------------------------------
   6️⃣ GET REVIEW FOR A SPECIFIC BOOKING
------------------------------------------------------- */

router.get("/booking/:bookingId/review", customerAuthMiddleware, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const customerId = req.customer.id;

    // Check if booking belongs to customer
    const booking = await pool.query(
      `SELECT id FROM customer_services 
       WHERE id = $1 AND customer_id = $2`,
      [bookingId, customerId]
    );

    if (booking.rows.length === 0) {
      return res.status(404).json({ message: "Booking not found" });
    }

    // Get review if exists
    const review = await pool.query(
      `SELECT sr.*, 
              s.name as service_name,
              st.name as staff_name
       FROM service_reviews sr
       LEFT JOIN services s ON sr.service_id = s.id
       LEFT JOIN staff st ON sr.staff_id = st.id
       WHERE sr.booking_id = $1 AND sr.is_submitted = true`,
      [bookingId]
    );

    if (review.rows.length === 0) {
      return res.status(404).json({ message: "No review found for this booking" });
    }

    res.json(review.rows[0]);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

/* -------------------------------------------------------
   7️⃣ STAFF VIEW THEIR REVIEWS
------------------------------------------------------- */

router.get("/staff/:staffId", async (req, res) => {
  try {
    const { staffId } = req.params;
    const { start_date, end_date, min_rating } = req.query;

    let query = `
      SELECT sr.*, 
             s.name as service_name,
             c.name as customer_name
      FROM service_reviews sr
      LEFT JOIN services s ON sr.service_id = s.id
      LEFT JOIN customers c ON sr.customer_id = c.id
      WHERE sr.staff_id = $1
      AND sr.is_submitted = true
    `;
    
    const values = [staffId];
    let paramCount = 2;

    if (start_date) {
      query += ` AND sr.submitted_at >= $${paramCount++}`;
      values.push(start_date);
    }
    
    if (end_date) {
      query += ` AND sr.submitted_at <= $${paramCount++}`;
      values.push(end_date);
    }
    
    if (min_rating) {
      query += ` AND sr.service_rating >= $${paramCount++}`;
      values.push(parseInt(min_rating));
    }

    query += ` ORDER BY sr.submitted_at DESC`;

    const reviews = await pool.query(query, values);

    // Calculate stats
    const stats = {
      total: reviews.rows.length,
      average: reviews.rows.length > 0 
        ? (reviews.rows.reduce((acc, r) => acc + r.service_rating, 0) / reviews.rows.length).toFixed(1)
        : 0,
      rating_distribution: {
        1: reviews.rows.filter(r => r.service_rating === 1).length,
        2: reviews.rows.filter(r => r.service_rating === 2).length,
        3: reviews.rows.filter(r => r.service_rating === 3).length,
        4: reviews.rows.filter(r => r.service_rating === 4).length,
        5: reviews.rows.filter(r => r.service_rating === 5).length
      }
    };

    res.json({
      reviews: reviews.rows,
      stats
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

/* -------------------------------------------------------
   8️⃣ ADMIN CENTRE REVIEWS
------------------------------------------------------- */

router.get("/centre/:centreId", async (req, res) => {
  try {
    const { centreId } = req.params;
    const { staff_id, start_date, end_date, min_rating } = req.query;

    let query = `
      SELECT sr.*, 
             s.name as service_name,
             st.name as staff_name,
             c.name as customer_name
      FROM service_reviews sr
      LEFT JOIN services s ON sr.service_id = s.id
      LEFT JOIN staff st ON sr.staff_id = st.id
      LEFT JOIN customers c ON sr.customer_id = c.id
      WHERE sr.centre_id = $1
      AND sr.is_submitted = true
    `;
    
    const values = [centreId];
    let paramCount = 2;

    if (staff_id) {
      query += ` AND sr.staff_id = $${paramCount++}`;
      values.push(staff_id);
    }
    
    if (start_date) {
      query += ` AND sr.submitted_at >= $${paramCount++}`;
      values.push(start_date);
    }
    
    if (end_date) {
      query += ` AND sr.submitted_at <= $${paramCount++}`;
      values.push(end_date);
    }
    
    if (min_rating) {
      query += ` AND sr.service_rating >= $${paramCount++}`;
      values.push(parseInt(min_rating));
    }

    query += ` ORDER BY sr.submitted_at DESC`;

    const reviews = await pool.query(query, values);

    // Calculate stats
    const stats = {
      total: reviews.rows.length,
      average: reviews.rows.length > 0 
        ? (reviews.rows.reduce((acc, r) => acc + r.service_rating, 0) / reviews.rows.length).toFixed(1)
        : 0,
      by_staff: {},
      rating_distribution: {
        1: reviews.rows.filter(r => r.service_rating === 1).length,
        2: reviews.rows.filter(r => r.service_rating === 2).length,
        3: reviews.rows.filter(r => r.service_rating === 3).length,
        4: reviews.rows.filter(r => r.service_rating === 4).length,
        5: reviews.rows.filter(r => r.service_rating === 5).length
      }
    };

    // Group by staff
    reviews.rows.forEach(review => {
      const staffName = review.staff_name || 'Unassigned';
      if (!stats.by_staff[staffName]) {
        stats.by_staff[staffName] = {
          total: 0,
          sum: 0,
          average: 0
        };
      }
      stats.by_staff[staffName].total++;
      stats.by_staff[staffName].sum += review.service_rating;
    });

    // Calculate averages for each staff
    Object.keys(stats.by_staff).forEach(staff => {
      stats.by_staff[staff].average = (stats.by_staff[staff].sum / stats.by_staff[staff].total).toFixed(1);
    });

    res.json({
      reviews: reviews.rows,
      stats
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

/* -------------------------------------------------------
   9️⃣ SUPERADMIN ALL REVIEWS
------------------------------------------------------- */

router.get("/all", async (req, res) => {
  try {
    const { centre_id, staff_id, start_date, end_date, min_rating } = req.query;

    let query = `
      SELECT sr.*, 
             s.name as service_name,
             st.name as staff_name,
             c.name as customer_name,
             cen.name as centre_name
      FROM service_reviews sr
      LEFT JOIN services s ON sr.service_id = s.id
      LEFT JOIN staff st ON sr.staff_id = st.id
      LEFT JOIN customers c ON sr.customer_id = c.id
      LEFT JOIN centres cen ON sr.centre_id = cen.id
      WHERE sr.is_submitted = true
    `;
    
    const values = [];
    let paramCount = 1;

    if (centre_id) {
      query += ` AND sr.centre_id = $${paramCount++}`;
      values.push(centre_id);
    }
    
    if (staff_id) {
      query += ` AND sr.staff_id = $${paramCount++}`;
      values.push(staff_id);
    }
    
    if (start_date) {
      query += ` AND sr.submitted_at >= $${paramCount++}`;
      values.push(start_date);
    }
    
    if (end_date) {
      query += ` AND sr.submitted_at <= $${paramCount++}`;
      values.push(end_date);
    }
    
    if (min_rating) {
      query += ` AND sr.service_rating >= $${paramCount++}`;
      values.push(parseInt(min_rating));
    }

    query += ` ORDER BY sr.submitted_at DESC`;

    const reviews = await pool.query(query, values);

    // Calculate overall stats
    const stats = {
      total: reviews.rows.length,
      average: reviews.rows.length > 0 
        ? (reviews.rows.reduce((acc, r) => acc + r.service_rating, 0) / reviews.rows.length).toFixed(1)
        : 0,
      by_centre: {},
      rating_distribution: {
        1: reviews.rows.filter(r => r.service_rating === 1).length,
        2: reviews.rows.filter(r => r.service_rating === 2).length,
        3: reviews.rows.filter(r => r.service_rating === 3).length,
        4: reviews.rows.filter(r => r.service_rating === 4).length,
        5: reviews.rows.filter(r => r.service_rating === 5).length
      }
    };

    // Group by centre
    reviews.rows.forEach(review => {
      const centreName = review.centre_name || 'Unknown';
      if (!stats.by_centre[centreName]) {
        stats.by_centre[centreName] = {
          total: 0,
          sum: 0,
          average: 0
        };
      }
      stats.by_centre[centreName].total++;
      stats.by_centre[centreName].sum += review.service_rating;
    });

    // Calculate averages for each centre
    Object.keys(stats.by_centre).forEach(centre => {
      stats.by_centre[centre].average = (stats.by_centre[centre].sum / stats.by_centre[centre].total).toFixed(1);
    });

    res.json({
      reviews: reviews.rows,
      stats
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;