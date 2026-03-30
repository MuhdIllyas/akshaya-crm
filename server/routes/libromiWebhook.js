import express from "express";
import axios from "axios";

const router = express.Router();

const LIBROMI_BASE_URL = "https://server2-wc.libromi.cloud/api/v1";
const WEBHOOK_URL = process.env.WEBHOOK_URL || "https://akshaya-crm.onrender.com/api/webhook/whatsapp";

// 🔥 Register webhook
router.post("/register-webhook", async (req, res) => {
  try {
    const LIBROMI_TOKEN = process.env.LIBROMI_ACCESS_TOKEN;

    if (!LIBROMI_TOKEN) {
      return res.status(500).json({
        error: "LIBROMI_ACCESS_TOKEN not set"
      });
    }

    console.log("🚀 Registering webhook:", WEBHOOK_URL);

    const response = await axios.post(
      `${LIBROMI_BASE_URL}/webhook`,
      {
        webhook_url: WEBHOOK_URL
      },
      {
        headers: {
          Authorization: `Bearer ${LIBROMI_TOKEN}`,
          "Content-Type": "application/json",
          Accept: "application/json"
        }
      }
    );

    console.log("✅ Webhook registered:", response.data);

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
      message: "Webhook registered successfully",
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

// 🔍 Check webhook
router.get("/check-webhook", async (req, res) => {
  try {
    const LIBROMI_TOKEN = process.env.LIBROMI_ACCESS_TOKEN;

    const response = await axios.get(
      `${LIBROMI_BASE_URL}/webhook`,
      {
        headers: {
          Authorization: `Bearer ${LIBROMI_TOKEN}`,
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
    message: "Use POST method to register webhook"
  });
});

export default router;
