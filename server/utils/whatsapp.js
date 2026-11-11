// utils/whatsapp.js
import axios from "axios";
import { whatsappTemplates } from "../config/whatsappTemplates.js";
import { getPortalWhatsAppAccount } from "./whatsappAccount.js";

// Sends through the current organization's WhatsApp account
// (Communication Settings), not a token from server/.env.
const post = async (payload) => {
  const account = await getPortalWhatsAppAccount();
  return axios.post(`${account.baseUrl}/messages`, payload, {
    headers: { Authorization: `Bearer ${account.token}`, "Content-Type": "application/json" },
  });
};

export const sendWhatsAppOTP = async ({ phone, otp }) => {
  const tpl = whatsappTemplates.OTP_APP;
  const payload = {
    to: `91${phone}`,
    ...tpl.build({ otp })
  };
  return post(payload);
};

// Send plain text message
export const sendWhatsAppText = async ({ to, message }) => {
  const payload = {
    to,
    type: "text",
    text: { body: message }
  };
  return post(payload);
};

// Send template message – matches the exact cURL format
export const sendWhatsAppTemplate = async ({ to, templateName, params = [] }) => {
  const payload = {
    to,
    type: "template",
    template: {
      name: templateName,
      language: {
        code: "en",
        policy: "deterministic"   // as per the cURL example
      },
      components: params.length ? [
        {
          type: "body",
          parameters: params.map(p => ({ type: "text", text: p }))
        }
      ] : []
    }
  };
  return post(payload);
};
