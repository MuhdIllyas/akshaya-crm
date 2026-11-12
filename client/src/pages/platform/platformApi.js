// API client for the platform-admin page (/api/platform). Uses its own login
// token, separate from organization staff and customers.

import axios from "axios";

const TOKEN_KEY = "platform_token";

export const getPlatformToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
};

export const setPlatformToken = (token) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage blocked: the session lasts until reload */
  }
};

const platformApi = axios.create({ baseURL: `${import.meta.env.VITE_API_URL}/api/platform` });

platformApi.interceptors.request.use((config) => {
  const token = getPlatformToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

platformApi.interceptors.response.use(
  (res) => res,
  (err) => {
    const onLogin = window.location.pathname.startsWith("/platform/login");
    if (err.response?.status === 401 && !onLogin) {
      setPlatformToken("");
      window.location.assign("/platform/login");
    }
    return Promise.reject(err);
  }
);

export const errorText = (err, fallback = "Something went wrong") => err?.response?.data?.error || fallback;

export const rupees = (n) =>
  n === null || n === undefined || n === "" ? "—" : `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export const formatBytes = (b) => {
  if (b === null || b === undefined) return "—";
  if (b < 1024 * 1024) return `${Math.max(0, Math.round(b / 1024))} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
};

export const formatDate = (ymd) =>
  ymd ? new Date(`${ymd}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

export const formatDateTime = (iso) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })
    : "—";

/** What a platform role may do. The server checks the same rules. */
export const permissions = (role) => ({
  manageBilling: role === "owner" || role === "billing", // organizations, subscriptions, payments
  manageOwnerOnly: role === "owner", // plans, admins, activity log
});

export const ROLE_LABELS = { owner: "Owner", billing: "Billing", viewer: "Viewer" };

export default platformApi;
