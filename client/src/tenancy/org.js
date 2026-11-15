// Which organization (business) this browser is talking to.
//
// Each business that subscribes has its own portal link: /portal/<slug>/...
// Opening it stores the slug here. Every API request then carries an
// `X-Org-Slug` header so the server uses that business's database for login,
// registration and public pages. After login the token itself carries the
// organization, so the header can't move a logged-in user to another business.
//
// This file must be imported before anything else in main.jsx: it patches
// axios (including instances made with axios.create) and fetch.

import axios from "axios";

const KEY = "org_slug";
const API_URL = import.meta.env.VITE_API_URL || "";

export function getOrgSlug() {
  try {
    return localStorage.getItem(KEY) || "";
  } catch {
    return "";
  }
}

export function setOrgSlug(slug) {
  try {
    if (slug) localStorage.setItem(KEY, slug);
    else localStorage.removeItem(KEY);
  } catch {
    /* storage blocked: requests fall back to the default organization */
  }
}

/** Forget the old business's logins (staff and customer) when switching business. */
export function clearOrgSession() {
  try {
    for (const key of ["token", "id", "role", "username", "name", "centre_id", "centre_name", "photo", "previous_sign_in",
      "customer_token", "customer_id", "customer_name", "preferred_centre_id",
      "customer_centre_id", "customer_centre_name", "customer_portal_mode"]) {
      localStorage.removeItem(key);
    }
  } catch {
    /* storage blocked */
  }
}

/**
 * A page address for the remembered business: "/portal/<slug>/<path>" for
 * another business, or just "/<path>" for your own. Use it wherever the app
 * sends someone to the login or registration page.
 */
export function portalPath(path) {
  const slug = getOrgSlug();
  const clean = String(path).replace(/^\//, "");
  return slug ? `/portal/${slug}/${clean}` : `/${clean}`;
}

export const loginPath = () => portalPath("login");

const isApiUrl = (url) => {
  const u = String(url || "");
  if (API_URL) return u.startsWith(API_URL) || u.startsWith("/api");
  return u.startsWith("/api");
};

/* ---------------- axios ---------------- */

function addHeader(config) {
  const slug = getOrgSlug();
  const full = `${config.baseURL || ""}${config.url || ""}`;
  if (slug && isApiUrl(full)) {
    config.headers = config.headers || {};
    if (typeof config.headers.set === "function") config.headers.set("X-Org-Slug", slug);
    else config.headers["X-Org-Slug"] = slug;
  }
  return config;
}

axios.interceptors.request.use(addHeader);

const originalCreate = axios.create.bind(axios);
axios.create = (...args) => {
  const instance = originalCreate(...args);
  instance.interceptors.request.use(addHeader);
  return instance;
};

/* ---------------- fetch ---------------- */

if (typeof window !== "undefined" && window.fetch) {
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const slug = getOrgSlug();
    const url = typeof input === "string" ? input : input?.url;
    if (!slug || !isApiUrl(url)) return originalFetch(input, init);

    const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
    if (!headers.has("X-Org-Slug")) headers.set("X-Org-Slug", slug);
    return originalFetch(input, { ...init, headers });
  };
}
