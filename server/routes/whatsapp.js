import express from "express";
import { sendManualWhatsAppTemplate } from "../utils/messageRouter.js";
import { authenticateToken } from "./collaboration/chat.js";

const router = express.Router();

router.post("/send-template", authenticateToken , async (req, res) => {
  const { conversationId, templateName, params } = req.body;
  const io = req.app.get("io"); // assuming you store io instance on app

  if (!conversationId || !templateName) {
    return res.status(400).json({ error: "Missing conversationId or templateName" });
  }

  try {
    const result = await sendManualWhatsAppTemplate({
      conversationId,
      templateName,
      params: params || [],
      io
    });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
