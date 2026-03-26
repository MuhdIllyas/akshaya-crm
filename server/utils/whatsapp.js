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