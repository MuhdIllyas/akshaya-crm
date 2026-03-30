// utils/whatsapp.js
import axios from "axios";
import { whatsappTemplates } from "../config/whatsappTemplates.js";

export const sendWhatsAppOTP = async ({ phone, otp }) => {
  const tpl = whatsappTemplates.OTP_APP;
  const payload = {
    to: `91${phone}`,
    ...tpl.build({ otp })
  };
  const headers = {
    Authorization: `Bearer ${process.env.LIBROMI_ACCESS_TOKEN}`,
    "Content-Type": "application/json"
  };
  const url = `${process.env.LIBROMI_BASE_URL}/messages`;
  return axios.post(url, payload, { headers });
};

// Send plain text message
export const sendWhatsAppText = async ({ to, message }) => {
  const payload = {
    to,
    type: "text",
    text: { body: message }
  };
  const headers = {
    Authorization: `Bearer ${process.env.LIBROMI_ACCESS_TOKEN}`,
    "Content-Type": "application/json"
  };
  const url = `${process.env.LIBROMI_BASE_URL}/messages`;
  return axios.post(url, payload, { headers });
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
  const headers = {
    Authorization: `Bearer ${process.env.LIBROMI_ACCESS_TOKEN}`,
    "Content-Type": "application/json"
  };
  const url = `${process.env.LIBROMI_BASE_URL}/messages`;
  return axios.post(url, payload, { headers });
};
