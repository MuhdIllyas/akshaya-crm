// utils/whatsapp.js
import axios from "axios";
import { whatsappTemplates } from "../config/whatsappTemplates.js";
import { getPortalWhatsAppAccount, getPortalOtpAccounts } from "./whatsappAccount.js";

const postWith = (account, payload) =>
  axios.post(`${account.baseUrl}/messages`, payload, {
    headers: { Authorization: `Bearer ${account.token}`, "Content-Type": "application/json" },
  });

// Sends through the current organization's WhatsApp account
// (Communication Settings), not a token from server/.env.
const post = async (payload) => postWith(await getPortalWhatsAppAccount(), payload);

/**
 * Customer portal OTP. From the customer's centre's own number when there is
 * one (centreId), otherwise the organization's OTP number / the platform
 * number. If a number can't send (e.g. the OTP template isn't approved on it),
 * the next one is tried so the customer still gets a code.
 */
export const sendWhatsAppOTP = async ({ phone, otp, centreId = null }) => {
  const tpl = whatsappTemplates.OTP_APP;
  const payload = {
    to: `91${phone}`,
    ...tpl.build({ otp })
  };
  const accounts = await getPortalOtpAccounts(centreId);
  let lastError;
  for (const account of accounts) {
    try {
      const res = await postWith(account, payload);
      if (account !== accounts[0]) {
        console.warn(`[otp] centre ${centreId}'s number couldn't send; sent from ${account.platform ? "the platform number" : `account ${account.id}`}`);
      }
      return res;
    } catch (err) {
      lastError = err;
      console.error(`[otp] send failed from ${account.platform ? "platform number" : `account ${account.id}`}:`, err.response?.data || err.message);
    }
  }
  throw lastError;
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
