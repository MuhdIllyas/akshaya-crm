import axios from "axios";

// UPI payments caught by the centre's companion phone, and their links to entries.
const API = `${import.meta.env.VITE_API_URL}/api/upi-credits`;
const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });

export const IST = "Asia/Kolkata";
export const todayIST = () => new Date().toLocaleDateString("en-CA", { timeZone: IST });
export const rupees = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
export const timeOf = (v) =>
  v ? new Date(v).toLocaleTimeString("en-IN", { timeZone: IST, hour: "numeric", minute: "2-digit" }) : "";
export const SOURCE = { sms: "Bank SMS", gpay: "GPay", paytm: "Paytm", phonepe: "PhonePe", sbi: "SBI app" };
export const servicesText = (s) => (s.services || []).map((x) => x.name).join(" + ");
export const customersText = (s) => (s.customers || []).join(", ") || "Walk-in";
export const sameAmount = (a, b) => Math.round(Number(a) * 100) === Math.round(Number(b) * 100);
export const errorText = (e, fallback) => e?.response?.data?.error || fallback;

/** Wallets whose UPI payments are checked (from the wallets list). */
// Wallets whose payment picker is on screen right now (Service Entry): a new
// payment for them needs no chime, the staff member is already looking at it.
const openPickers = new Map();
export const pickerOpened = (walletId) => openPickers.set(Number(walletId), (openPickers.get(Number(walletId)) || 0) + 1);
export const pickerClosed = (walletId) => {
  const n = (openPickers.get(Number(walletId)) || 1) - 1;
  if (n > 0) openPickers.set(Number(walletId), n); else openPickers.delete(Number(walletId));
};
export const isPickerOpenFor = (walletId) => (openPickers.get(Number(walletId)) || 0) > 0;

export const isUpiWallet = (w) => Array.isArray(w?.upi_match_sources) && w.upi_match_sources.length > 0;

export const getBoard = (date, centreId) =>
  axios.get(`${API}/board`, { ...auth(), params: { date, ...(centreId ? { centre_id: centreId } : {}) } }).then((r) => r.data);
export const getUnclaimed = (walletId, hours = 3) =>
  axios.get(`${API}/unclaimed`, { ...auth(), params: { wallet_id: walletId, hours } }).then((r) => r.data.credits);
export const linkToSave = (creditIds, walletId, saveKey) =>
  axios.post(`${API}/link`, { credit_ids: creditIds, wallet_id: walletId, save_key: saveKey }, auth());
export const linkToEntries = (creditIds, entryIds, walletId) =>
  axios.post(`${API}/link-entry`, { credit_ids: creditIds, entry_ids: entryIds, wallet_id: walletId }, auth());
export const unlinkCredit = (id) => axios.post(`${API}/${id}/unlink`, {}, auth());
export const ignoreCredit = (id, ignore) => axios.post(`${API}/${id}/ignore`, { ignore }, auth());
