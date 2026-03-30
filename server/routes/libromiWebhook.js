import express from "express";
import axios from "axios";

const router = express.Router();

// 🔥 Register webhook to Libromi
router.post("/register-webhook", async (req, res) => {
  try {
    const LIBROMI_TOKEN = process.env.LIBROMI_ACCESS_TOKEN;

    if (!LIBROMI_TOKEN) {
      return res.status(500).json({
        error: "LIBROMI_ACCESS_TOKEN not found in environment variables"
      });
    }

    const webhookUrl = "https://akshaya-crm.onrender.com/api/webhook/whatsapp";

    const response = await axios.post(
      "https://server2-wc.libromi.cloud/api/v1/webhook",
      {
        webhook_url: webhookUrl
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

    res.json({
      success: true,
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

// 🔍 Verify webhook
router.get("/check-webhook", async (req, res) => {
  try {
    const LIBROMI_TOKEN = process.env.LIBROMI_ACCESS_TOKEN;

    const response = await axios.get(
      "https://server2-wc.libromi.cloud/api/v1/webhook",
      {
        headers: {
          Authorization: `Bearer ${LIBROMI_TOKEN}`,
          Accept: "application/json"
        }
      }
    );

    console.log("📌 Webhook status:", response.data);

    res.json(response.data);

  } catch (err) {
    console.error("❌ Webhook check failed:", err.response?.data || err.message);

    res.status(500).json({
      success: false,
      error: err.response?.data || err.message
    });
  }
});

router.get("/register-webhook", async (req, res) => {
  res.json({ message: "Use POST method for this route" });
});

export default router;
