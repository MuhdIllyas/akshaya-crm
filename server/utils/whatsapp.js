// utils/whatsapp.js
import axios from "axios";
import { whatsappTemplates } from "../config/whatsappTemplates.js";

// Existing OTP function (kept as is)
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

// NEW: Send a plain text message
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

// NEW: Send any template by name with parameters
export const sendWhatsAppTemplate = async ({ to, templateName, params = [] }) => {
  // If you have a predefined config for templates, use it, otherwise build generic
  // Here we assume the template name exists in your provider's system
  const payload = {
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: "en" },
      components: []
    }
  };
  if (params.length) {
    payload.template.components.push({
      type: "body",
      parameters: params.map(p => ({ type: "text", text: p }))
    });
  }
  const headers = {
    Authorization: `Bearer ${process.env.LIBROMI_ACCESS_TOKEN}`,
    "Content-Type": "application/json"
  };
  const url = `${process.env.LIBROMI_BASE_URL}/messages`;
  return axios.post(url, payload, { headers });
};
