// Centres of the current organization, as the customer portal sees them,
// and the centre a customer came through (a centre's own link or QR code,
// /portal/<slug>/c/<centreId>), which pre-selects it when booking.

import { useEffect, useState } from "react";
import axios from "axios";

const KEY = "preferred_centre_id";
const API_URL = import.meta.env.VITE_API_URL;

export function getPreferredCentreId() {
  try {
    return localStorage.getItem(KEY) || "";
  } catch {
    return "";
  }
}

export function setPreferredCentreId(id) {
  try {
    if (id) localStorage.setItem(KEY, String(id));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage blocked: the customer just picks the centre by hand */
  }
}

/** [{ id, name, district, address, phone, whatsapp_number }] — whatsapp_number is null when off. */
export function usePortalCentres() {
  const [centres, setCentres] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    axios
      .get(`${API_URL}/api/portal/centres`)
      .then(({ data }) => !cancelled && setCentres(Array.isArray(data) ? data : []))
      .catch(() => !cancelled && setCentres([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  return { centres, loading };
}

/** wa.me link that opens a chat with the centre's WhatsApp number. */
export function whatsappChatLink(number, text = "") {
  const digits = String(number || "").replace(/\D/g, "");
  if (!digits) return null;
  const full = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${full}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
