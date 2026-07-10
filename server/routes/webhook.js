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
// 📥 BULLETPROOF MEDIA DOWNLOADER
// ===============================
async function downloadWhatsAppMedia(mediaId, directLink, accessToken, baseUrl, mimeType, filenameHint) {
  try {
    let downloadUrl = directLink;

    // 1. Resolve ID to URL if necessary
    if (!downloadUrl && mediaId) {
      const cleanBase = baseUrl.replace(/\/messages\/?$/, '');
      const endpointsToTry = [
        `${cleanBase}/media/${mediaId}`,              
        `${cleanBase}/${mediaId}`,                    
        `https://graph.facebook.com/v18.0/${mediaId}` 
      ];

      for (const endpoint of endpointsToTry) {
        try {
          const res = await axios.get(endpoint, { headers: { Authorization: `Bearer ${accessToken}` } });
          if (res.data && (res.data.url || res.data.link)) {
            downloadUrl = res.data.url || res.data.link;
            break; 
          }
        } catch (e) { /* Ignore and try next */ }
      }
    }

    if (!downloadUrl) throw new Error("Could not find a valid download URL.");

    console.log(`[Webhook] Downloading media from: ${downloadUrl.substring(0, 60)}...`);

    let responseStream;
    
    // 🔥 THE FIX: Handle WhatsApp CDN Redirects manually!
    // Axios strips Auth headers on cross-domain redirects (causing 401s).
    // We force Axios to stop at the redirect, grab the new URL, and fetch it securely.
    try {
      const initialReq = await axios.get(downloadUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
        maxRedirects: 0, // Stop at the 302 Redirect
        responseType: 'stream'
      });
      responseStream = initialReq.data;
    } catch (err) {
      if (err.response && [301, 302, 303, 307, 308].includes(err.response.status)) {
        const redirectUrl = err.response.headers.location;
        console.log(`[Webhook] Following Meta CDN redirect...`);
        
        // The CDN URL already contains the auth hash in the link itself, 
        // so we fetch it without the Bearer token to avoid cross-origin rejections.
        const cdnReq = await axios.get(redirectUrl, {
          responseType: 'stream'
        });
        responseStream = cdnReq.data;
      } else {
        console.error(`[Webhook] Media API Error:`, err.response?.status);
        throw err;
      }
    }

    // 3. Determine extension and generate a safe filename
    let ext = '';
    if (mimeType) {
      ext = '.' + mimeType.split('/')[1].split(';')[0]; 
    } else if (filenameHint) {
      ext = path.extname(filenameHint);
    }
    if (!ext) ext = '.bin'; 
    
    const uniqueFilename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    const filePath = path.join(UPLOAD_DIR, uniqueFilename);

    // 4. Save to your local disk
    const writer = fs.createWriteStream(filePath);
    responseStream.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    console.log(`[Webhook] Successfully saved media to ${filePath}`);

    // 5. Return the local relative path for the database
    return `/uploads/chat/${uniqueFilename}`;

  } catch (error) {
    console.error(`[Webhook] Failed to download WhatsApp media:`, error.message);
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
    let directLink = null;
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
          // 🔥 FIX: Check for .url first!
          directLink = msgObject.image?.url || msgObject.image?.link || msgObject.url || msgObject.link;
          mimeTypeHint = msgObject.image?.mime_type || "image/jpeg";
          messageText = msgObject.image?.caption || msgObject.caption || "";
          fileName = "Image.jpeg";
          break;
          
        case "document":
          messageType = "document";
          mediaIdToDownload = msgObject.document?.id;
          directLink = msgObject.document?.url || msgObject.document?.link || msgObject.url || msgObject.link;
          mimeTypeHint = msgObject.document?.mime_type || "application/pdf";
          fileName = msgObject.document?.filename || "Document.pdf";
          messageText = msgObject.document?.caption || msgObject.caption || "";
          break;

        case "video":
          messageType = "video";
          mediaIdToDownload = msgObject.video?.id;
          directLink = msgObject.video?.url || msgObject.video?.link || msgObject.url || msgObject.link;
          mimeTypeHint = msgObject.video?.mime_type || "video/mp4";
          messageText = msgObject.video?.caption || msgObject.caption || "";
          fileName = "Video.mp4";
          break;

        case "audio":
          messageType = "audio";
          mediaIdToDownload = msgObject.audio?.id;
          directLink = msgObject.audio?.url || msgObject.audio?.link || msgObject.url || msgObject.link;
          mimeTypeHint = msgObject.audio?.mime_type || "audio/ogg";
          fileName = "VoiceNote.ogg";
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
    if (!from || (!messageText && !directLink && !mediaIdToDownload)) {
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
    if ((mediaIdToDownload || directLink) && communicationAccountId) {
      try {
        const accountData = await pool.query(
          `SELECT access_token, base_url FROM communication_accounts WHERE id = $1`,
          [communicationAccountId]
        );
        
        if (accountData.rows.length > 0) {
          const { access_token, base_url } = accountData.rows[0];
          
          const localPath = await downloadWhatsAppMedia(
            mediaIdToDownload, 
            directLink,
            access_token, 
            base_url, 
            mimeTypeHint, 
            fileName
          );
          
          if (localPath) {
            fileUrl = localPath; 
          } else if (directLink) {
            fileUrl = directLink; 
            messageText += "\n[Media saved as external link]";
          } else {
            messageText += "\n[Failed to download media attachment]";
          }
        }
      } catch (err) {
        console.error("Error retrieving account data for media download:", err);
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
      incoming_file_url: fileUrl,
      incoming_file_name: fileName
    });

    console.log(`✅ Message safely routed. Type: [${messageType}]. Text: "${messageText.substring(0, 20)}..."`);

  } catch (err) {
    console.error('❌ WhatsApp webhook processing error:', err);
  }
});

export default router;