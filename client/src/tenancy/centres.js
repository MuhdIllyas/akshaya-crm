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
      // a signed-in customer in the per-centre portal gets only their centre
      .get(`${API_URL}/api/portal/centres`, { headers: customerAuthHeaders() })
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

// ---------------------------------------------------------------------
// Signed-in customer and their centre.
// In the per-centre portal (set by the superadmin) a customer works "at" one
// centre: the server limits their bookings, chats and centre list to it.
// ---------------------------------------------------------------------

const CENTRE_KEYS = ["customer_centre_id", "customer_centre_name", "customer_portal_mode"];

export function customerAuthHeaders() {
  const token = localStorage.getItem("customer_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** The customer's centre as last saved: { id, name, mode }. */
export function getCustomerCentre() {
  try {
    return {
      id: localStorage.getItem("customer_centre_id") || "",
      name: localStorage.getItem("customer_centre_name") || "",
      mode: localStorage.getItem("customer_portal_mode") || "shared",
    };
  } catch {
    return { id: "", name: "", mode: "shared" };
  }
}

function rememberCustomerCentre(mode, centre) {
  try {
    localStorage.setItem("customer_portal_mode", mode || "shared");
    if (centre?.id) {
      localStorage.setItem("customer_centre_id", String(centre.id));
      localStorage.setItem("customer_centre_name", centre.name || "");
      setPreferredCentreId(centre.id);
    } else {
      localStorage.removeItem("customer_centre_id");
      localStorage.removeItem("customer_centre_name");
    }
  } catch {
    /* storage blocked */
  }
}

export function forgetCustomerCentre() {
  try {
    CENTRE_KEYS.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* storage blocked */
  }
}

/**
 * Save a customer sign-in answer from the server (verify-otp, register,
 * select-centre) and return where to go next.
 */
export function saveCustomerSession(data, fallbackName = "") {
  localStorage.setItem("role", "customer");
  if (data.token) localStorage.setItem("customer_token", data.token);
  if (data.customerId) localStorage.setItem("customer_id", data.customerId);
  if (data.name || fallbackName) localStorage.setItem("customer_name", data.name || fallbackName);
  rememberCustomerCentre(data.portal_mode, data.centre);
  return data.needs_centre ? "/customer/choose-centre" : "/customer/dashboard";
}

/** Where the signed-in customer stands: { portal_mode, centre, centres, needs_centre }. */
export async function fetchCustomerPortalContext() {
  const { data } = await axios.get(`${API_URL}/api/customer/portal-context`, { headers: customerAuthHeaders() });
  rememberCustomerCentre(data.portal_mode, data.centre);
  return data;
}

/** Work at (or join) a centre; saves the new session. Returns the next path. */
export async function selectCustomerCentre(centreId) {
  const { data } = await axios.post(
    `${API_URL}/api/customer/select-centre`,
    { centre_id: Number(centreId) },
    { headers: customerAuthHeaders() }
  );
  return saveCustomerSession(data);
}
