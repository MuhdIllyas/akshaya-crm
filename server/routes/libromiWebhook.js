import express from "express";
import axios from "axios";
import pool from "../db.js"; 

const router = express.Router();

const WEBHOOK_URL = process.env.WEBHOOK_URL || "https://akshaya-crm.onrender.com/api/webhook/whatsapp";

// 🔥 Register webhook dynamically for a specific account
router.post("/register-webhook/:accountId", async (req, res) => {
  try {
    const { accountId } = req.params;

    // 1. Fetch the specific token and base URL for this account
    const accountQuery = await pool.query(
      `SELECT access_token, base_url, name FROM communication_accounts WHERE id = $1 AND is_active = true`,
      [accountId]
    );

    if (accountQuery.rows.length === 0) {
      return res.status(404).json({ error: "Communication account not found or inactive" });
    }

    const { access_token, base_url, name } = accountQuery.rows[0];

    console.log(`🚀 Registering webhook for '${name}' at:`, WEBHOOK_URL);

    // 2. Dispatch to Libromi using the dynamic credentials
    const response = await axios.post(
      `${base_url}/webhook`,
      {
        webhook_url: WEBHOOK_URL
      },
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
          Accept: "application/json"
        }
      }
    );

    console.log(`✅ Webhook registered for ${name}:`, response.data);

    // 🔍 Validate response
    if (!response.data?.webhook_url) {
      return res.status(400).json({
        success: false,
        message: "Webhook not stored properly",
        data: response.data
      });
    }

    res.json({
      success: true,
      message: `Webhook registered successfully for account: ${name}`,
      data: response.data
    });

  } catch (err) {
    console.error("❌ Webhook registration failed:", err.response?.data || err.message);

    res.status(500).json({
      success: false,
      error: err.response?.data || err.message
    });
  }
});

// 🔍 Check webhook for a specific account
router.get("/check-webhook/:accountId", async (req, res) => {
  try {
    const { accountId } = req.params;

    const accountQuery = await pool.query(
      `SELECT access_token, base_url FROM communication_accounts WHERE id = $1`,
      [accountId]
    );

    if (accountQuery.rows.length === 0) {
      return res.status(404).json({ error: "Communication account not found" });
    }

    const { access_token, base_url } = accountQuery.rows[0];

    const response = await axios.get(
      `${base_url}/webhook`,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          Accept: "application/json"
        }
      }
    );

    console.log("📌 Webhook status:", response.data);

    res.json({
      success: true,
      data: response.data
    });

  } catch (err) {
    console.error("❌ Webhook check failed:", err.response?.data || err.message);

    res.status(500).json({
      success: false,
      error: err.response?.data || err.message
    });
  }
});

// 🔧 Optional: quick browser check
router.get("/register-webhook", (req, res) => {
  res.json({
    message: "Use POST method with /register-webhook/:accountId to register webhook"
  });
});

export default router;