import express from 'express';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';
import { resolveConversation } from '../utils/conversationService.js';
import { sendMessage } from '../utils/messageRouter.js';
import pool from '../db.js';
import { getLibromiApiKey } from '../utils/whatsappAccount.js';
import { orgUploadPath } from '../tenancy/uploads.js';

const router = express.Router();

// ===============================
// 📁 DIRECTORY SETUP FOR DOWNLOADS
// ===============================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Files are saved per organization: uploads/chat (default) or uploads/<slug>/chat.

// ===============================
// 📥 MEDIA DOWNLOADER (via Libromi API Platform)
// ===============================
// Meta's lookaside.fbsbx.com links need a *Meta* access token in an
// Authorization header. We only hold Libromi tokens, so those links always
// answer 401. Libromi already downloads every customer file from Meta and
// serves it from its own API, so we fetch it from there instead:
//   1. find the Libromi conversation  (GET /v1/conversations?query=<phone>&channel_id=<id>)
//   2. find the matching inbound media message (GET /v1/conversations/{id}/messages)
//   3. download media.url (works WITHOUT a key for ~10 min) and save locally.
// Needs the account's Libromi developer API key (Communication Settings; read access is enough).

const LIBROMI_API = (process.env.LIBROMI_API_URL || 'https://api.wa-api.cloud/v1').replace(/\/$/, '');

const KIND_TO_TYPE = { image: 'IMAGE', video: 'VIDEO', audio: 'AUDIO', document: 'DOCUMENT', sticker: 'STICKER' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const libromiGet = (apiKey, url, params) =>
  axios.get(`${LIBROMI_API}${url}`, {
    params,
    headers: { Authorization: `Bearer ${apiKey}` },
    timeout: 15000,
  });

// Pick a file extension: real file name first (documents), then mime type.
function pickExtension(mimeType, filenameHint) {
  const fromName = filenameHint ? path.extname(filenameHint).toLowerCase() : '';
  if (fromName && fromName.length <= 6) return fromName;
  if (mimeType) {
    const sub = mimeType.split('/')[1]?.split(';')[0]?.trim().toLowerCase();
    const map = { jpeg: '.jpg', 'x-m4a': '.m4a', mpeg: '.mp3', quicktime: '.mov', pdf: '.pdf' };
    if (sub) return map[sub] || (sub.length <= 5 ? `.${sub}` : '.bin');
  }
  return '.bin';
}

async function saveStreamToDisk(url, mimeType, filenameHint) {
  const res = await axios.get(url, { responseType: 'stream', timeout: 60000 });
  const ext = pickExtension(res.headers['content-type'] || mimeType, filenameHint);
  const uniqueFilename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  const target = orgUploadPath('chat');
  const filePath = path.join(target.dir, uniqueFilename);

  await new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(filePath);
    res.data.pipe(writer);
    writer.on('finish', resolve);
    writer.on('error', reject);
    res.data.on('error', reject);
  });

  console.log('[Webhook] LOCAL FILE SAVED:', filePath);
  return `${target.url}/${uniqueFilename}`;
}

// Find the Libromi conversation id for this customer on this channel.
async function findLibromiConversationId(apiKey, customerPhone, channelId) {
  const digits = String(customerPhone).replace(/\D/g, '').slice(-10); // "contains" match
  const params = { query: digits };
  if (channelId) params.channel_id = String(channelId);

  let res = await libromiGet(apiKey, '/conversations', params);
  let list = res.data?.data || [];

  // If our stored channel_id doesn't match Libromi's id format, retry without it.
  if (!list.length && channelId) {
    res = await libromiGet(apiKey, '/conversations', { query: digits });
    list = res.data?.data || [];
  }
  return list[0]?.id || null;
}

async function downloadWhatsAppMedia({ accountId, customerPhone, channelId, kind, caption, sentAtMs, mimeType, filenameHint }) {
  const apiKey = await getLibromiApiKey(accountId);
  if (!apiKey) {
    console.error('[Webhook] No Libromi developer API key in Communication Settings – cannot download media.');
    return null;
  }

  try {
    const conversationId = await findLibromiConversationId(apiKey, customerPhone, channelId);
    if (!conversationId) throw new Error(`No Libromi conversation found for ${customerPhone}`);

    // The file may still be downloading inside Libromi for a few seconds → retry.
    for (let attempt = 1; attempt <= 4; attempt++) {
      const res = await libromiGet(apiKey, `/conversations/${conversationId}/messages`, {
        direction: 'inbound',
        types: KIND_TO_TYPE[kind] || undefined,
        limit: 10,
      });
      const candidates = (res.data?.data || []).filter((m) => m.has_media && m.media);

      // Best match: same caption and closest in time to the webhook; else the newest one.
      const scored = candidates
        .map((m) => {
          const t = m.created_at ? new Date(m.created_at).getTime() : 0;
          const timeDiff = sentAtMs && t ? Math.abs(t - sentAtMs) : 0;
          const captionMatch = caption ? (m.media.caption || m.text || '') === caption : true;
          return { m, timeDiff, captionMatch };
        })
        .filter((c) => c.timeDiff <= 5 * 60 * 1000) // within 5 minutes of the webhook
        .sort((a, b) => Number(b.captionMatch) - Number(a.captionMatch) || a.timeDiff - b.timeDiff);

      const match = scored[0]?.m;

      if (match?.media?.url) {
        return await saveStreamToDisk(match.media.url, match.media.mime || mimeType, match.media.file_name || filenameHint);
      }

      if (match?.media?.url_unavailable === 'failed' || match?.media?.status === 'failed') {
        throw new Error('Libromi could not store this file (media_failed).');
      }

      // Not found yet or still processing → wait and try again.
      console.log(`[Webhook] Media not ready yet (attempt ${attempt}), retrying...`);
      await sleep(3000 * attempt);
    }

    throw new Error('Media still not available after retries.');
  } catch (error) {
    console.error('[Webhook] Failed to download WhatsApp media:', error.response?.data || error.message);
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
    if (mediaIdToDownload || directLink) {
      try {
        let channelId = incomingChannelId;
        if (!channelId && communicationAccountId) {
          const accountData = await pool.query(
            `SELECT channel_id FROM communication_accounts WHERE id = $1`,
            [communicationAccountId]
          );
          channelId = accountData.rows[0]?.channel_id || null;
        }

        const sentAtMs = msgObject?.timestamp ? Number(msgObject.timestamp) * 1000 : Date.now();

        const localPath = await downloadWhatsAppMedia({
          accountId: communicationAccountId,
          customerPhone: from,
          channelId,
          kind: messageType,
          caption: messageText || null,
          sentAtMs,
          mimeType: mimeTypeHint,
          filenameHint: fileName,
        });

        if (localPath) {
          fileUrl = localPath;
        } else {
          // Never store Meta's lookaside link: it always answers 401 in a browser.
          console.error(`[Webhook] Media download failed. Meta media id: ${mediaIdToDownload}`);
          messageText += "\n[Attachment could not be downloaded – open it in Libromi inbox]";
        }
      } catch (err) {
        console.error("Error during media download:", err);
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