import express from 'express';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';
import { resolveConversation } from '../utils/conversationService.js';
import { sendMessage } from '../utils/messageRouter.js';
import pool from '../db.js';

const router = express.Router();

// ===============================
// 📁 DIRECTORY SETUP FOR DOWNLOADS
// ===============================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'chat');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ===============================
// 📥 DOWNLOAD MEDIA HELPER
// ===============================
async function downloadWhatsAppMedia(mediaId, accessToken, baseUrl, mimeType, filenameHint) {
  try {
    console.log(`[Webhook] Fetching media URL for ID: ${mediaId}`);
    
    // 1. Get the actual media URL from Meta/Libromi
    const mediaUrlRes = await axios.get(`${baseUrl}/${mediaId}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    const downloadUrl = mediaUrlRes.data.url;
    if (!downloadUrl) throw new Error("No download URL returned for media ID");

    // 2. Download the binary data
    const response = await axios.get(downloadUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      responseType: 'stream'
    });

    // 3. Determine extension and filename
    let ext = '';
    if (mimeType) {
      ext = '.' + mimeType.split('/')[1].split(';')[0]; // e.g., 'image/jpeg' -> '.jpeg'
    } else if (filenameHint) {
      ext = path.extname(filenameHint);
    }
    
    const uniqueFilename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    const filePath = path.join(UPLOAD_DIR, uniqueFilename);

    // 4. Save to disk
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    console.log(`[Webhook] Successfully saved media to ${filePath}`);

    // 5. Return the local relative path for the database
    return `/uploads/chat/${uniqueFilename}`;

  } catch (error) {
    console.error(`[Webhook] Failed to download WhatsApp media ${mediaId}:`, error.message);
    return null;
  }
}

// Helper to safely extract text from any API provider structure
const extractText = (msg) => {
  if (!msg) return null;
  if (typeof msg === 'string') return msg;
  if (typeof msg.text === 'string') return msg.text;
  if (msg.text?.body) return msg.text.body;
  if (msg.button?.text) return msg.button.text;
  if (msg.interactive?.button_reply?.title) return msg.interactive.button_reply.title;
  if (msg.interactive?.list_reply?.title) return msg.interactive.list_reply.title;
  if (msg.message) return typeof msg.message === 'string' ? msg.message : msg.message.body;
  if (msg.body) return msg.body;
  return null;
};

router.post('/whatsapp', async (req, res) => {
  // 🔥 1. Immediately tell Libromi we got it to prevent duplicates
  res.sendStatus(200);

  try {
    const body = req.body;
    console.log("🔥 LIBROMI WEBHOOK HIT");

    let from = null;
    let message_id = null;
    let recipientPhone = null;
    let msgObject = null;

    // ===============================
    // 🔥 FORMAT 1: META / WHATSAPP CLOUD STYLE
    // ===============================
    if (body.entry && Array.isArray(body.entry)) {
      const changes = body.entry[0]?.changes;
      if (changes && changes.length > 0) {
        const value = changes[0]?.value;
        recipientPhone = value?.metadata?.display_phone_number; 

        const messages = value?.messages;
        if (messages && messages.length > 0) {
          msgObject = messages[0];
          from = msgObject.from;
          message_id = msgObject.id;
        }
      }
    }
    // ===============================
    // 🔥 FORMAT 2: Flat / Alternative Libromi Structures
    // ===============================
    else if (body.messages && Array.isArray(body.messages)) {
      msgObject = body.messages[0];
      from = msgObject.from;
      message_id = msgObject.id;
    } else if (body.data) {
      msgObject = body.data;
      from = body.data.from || body.data.phone || body.data.sender;
      message_id = body.data.id;
    } else if (body.from) {
      msgObject = body;
      from = body.from;
      message_id = body.message_id || body.id;
    }

    // ===============================
    // 📸 PARSE NATIVE MEDIA & TEXT
    // ===============================
    let messageText = "";
    let messageType = "text";
    let fileUrl = null;
    let fileName = null;
    let mediaIdToDownload = null;
    let mimeTypeHint = null;

    if (msgObject) {
      switch (msgObject.type) {
        case "text":
          messageText = extractText(msgObject) || "";
          messageType = "text";
          break;
          
        case "image":
          messageType = "image";
          mediaIdToDownload = msgObject.image?.id;
          mimeTypeHint = msgObject.image?.mime_type || "image/jpeg";
          messageText = msgObject.image?.caption || msgObject.caption || "";
          fileName = "Image.jpeg";
          // Fallback if there is a direct public link but no ID
          if (!mediaIdToDownload && (msgObject.image?.link || msgObject.link)) {
            fileUrl = msgObject.image?.link || msgObject.link;
          }
          break;
          
        case "document":
          messageType = "document";
          mediaIdToDownload = msgObject.document?.id;
          mimeTypeHint = msgObject.document?.mime_type || "application/pdf";
          fileName = msgObject.document?.filename || "Document.pdf";
          messageText = msgObject.document?.caption || msgObject.caption || "";
          if (!mediaIdToDownload && (msgObject.document?.link || msgObject.link)) {
            fileUrl = msgObject.document?.link || msgObject.link;
          }
          break;

        case "video":
          messageType = "video";
          mediaIdToDownload = msgObject.video?.id;
          mimeTypeHint = msgObject.video?.mime_type || "video/mp4";
          messageText = msgObject.video?.caption || msgObject.caption || "";
          fileName = "Video.mp4";
          if (!mediaIdToDownload && (msgObject.video?.link || msgObject.link)) {
            fileUrl = msgObject.video?.link || msgObject.link;
          }
          break;

        case "audio":
          messageType = "audio";
          mediaIdToDownload = msgObject.audio?.id;
          mimeTypeHint = msgObject.audio?.mime_type || "audio/ogg";
          fileName = "VoiceNote.ogg";
          if (!mediaIdToDownload && (msgObject.audio?.link || msgObject.link)) {
            fileUrl = msgObject.audio?.link || msgObject.link;
          }
          break;
          
        default:
          messageText = extractText(msgObject) || "Unsupported message type received.";
          messageType = "text";
      }
    }

    // ===============================
    // 🧹 NORMALIZE PHONE
    // ===============================
    if (from) {
      from = from.toString().replace(/\s+/g, '');
      if (!from.startsWith('+')) from = '+' + from;
    }

    // ===============================
    // ❌ VALIDATION (Must have Text OR Media)
    // ===============================
    if (!from || (!messageText && !fileUrl && !mediaIdToDownload)) {
      console.log(`⚠️ Webhook Ignored. It was likely a read/delivery receipt. (From: ${from})`);
      return; 
    }

    // ===============================
    // 🔍 FIND ACCOUNTS AND CUSTOMERS
    // ===============================
    let communicationAccountId = null;
    let centreId = null;

    let incomingChannelId = body.channel_id || body.data?.channel_id || null;
    
    if (incomingChannelId) {
        const accountQuery = await pool.query(
            `SELECT ca.id, c.id as centre_id 
             FROM communication_accounts ca
             LEFT JOIN centres c ON c.communication_account_id = ca.id
             WHERE ca.channel_id = $1 LIMIT 1`,
            [String(incomingChannelId)]
        );
        if (accountQuery.rows.length > 0) {
            communicationAccountId = accountQuery.rows[0].id;
            centreId = accountQuery.rows[0].centre_id;
        }
    }

    if (!communicationAccountId && recipientPhone) {
        const formattedRecipient = recipientPhone.startsWith('+') ? recipientPhone : `+${recipientPhone}`;
        const accountQuery = await pool.query(
            `SELECT ca.id, c.id as centre_id 
             FROM communication_accounts ca
             LEFT JOIN centres c ON c.communication_account_id = ca.id
             WHERE ca.phone_number = $1 OR ca.phone_number = $2 LIMIT 1`,
            [formattedRecipient, recipientPhone]
        );
        if (accountQuery.rows.length > 0) {
            communicationAccountId = accountQuery.rows[0].id;
            centreId = accountQuery.rows[0].centre_id;
        }
    }

    // ===============================
    // ⬇️ EXECUTE MEDIA DOWNLOAD
    // ===============================
    if (mediaIdToDownload && communicationAccountId) {
      try {
        const accountData = await pool.query(
          `SELECT access_token, base_url FROM communication_accounts WHERE id = $1`,
          [communicationAccountId]
        );
        
        if (accountData.rows.length > 0) {
          const { access_token, base_url } = accountData.rows[0];
          
          const localPath = await downloadWhatsAppMedia(
            mediaIdToDownload, 
            access_token, 
            base_url, 
            mimeTypeHint, 
            fileName
          );
          
          if (localPath) {
            fileUrl = localPath; // ✅ e.g. "/uploads/chat/12345.pdf"
          } else {
            messageText += "\n\n[Failed to download media attachment]";
          }
        }
      } catch(error){

console.log("MEDIA DOWNLOAD FAILED");

console.log("Status:",
error.response?.status);

console.log("Data:",
error.response?.data);

console.log("URL:",
`${baseUrl}/${mediaId}`);

return null;

}
    }

    const customerQuery = await pool.query(
        `SELECT id, name FROM customers WHERE primary_phone = $1 OR primary_phone = $2 LIMIT 1`,
        [from, from.replace('+', '')]
    );
    const customerId = customerQuery.rows.length > 0 ? customerQuery.rows[0].id : null;
    const customerName = customerQuery.rows.length > 0 ? customerQuery.rows[0].name : "Customer";

    // ===============================
    // 💬 RESOLVE CONVERSATION
    // ===============================
    const conversation = await resolveConversation({
      channel: 'whatsapp',
      context_type: customerId ? 'customer' : null,
      context_id: null,
      customer_id: customerId,
      phone_number: from,
      communication_account_id: communicationAccountId,
      centre_id: centreId, 
      name: `WhatsApp - ${customerName}`,
      is_group: false,
    });

    // ===============================
    // 💾 SAVE MESSAGE
    // ===============================
    const io = req.app.get('io') || req.io;

    await sendMessage({
      conversation_id: conversation.id,
      sender_id: customerId, 
      sender_type: 'customer',
      message: messageText,
      message_type: messageType,
      direction: 'incoming',
      io: io,
      external_message_id: message_id,
      // ✅ Pass the successfully downloaded file properties to the router!
      incoming_file_url: fileUrl,
      incoming_file_name: fileName
    });

    console.log(`✅ Message safely routed. Type: [${messageType}]. Text: "${messageText.substring(0, 20)}..."`);

  } catch (err) {
    console.error('❌ WhatsApp webhook processing error:', err);
  }
});

export default router;