// /logout: signs the user out of this browser (staff or customer) and opens
// the login page of their own organization (/login, or /portal/<slug>/login
// for another business). Remembered username and organization are kept.

import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { disconnectSocket } from "@/services/socket";
import { loginPath } from "@/tenancy/org";

const SESSION_KEYS = [
  "token", "id", "role", "username", "name", "centre_id", "centre_name", "photo", "previous_sign_in",
  "customer_token", "customer_id", "customer_name",
];

export default function Logout() {
  // Clear before rendering the redirect, so the login page never sees a stale session.
  try {
    for (const key of SESSION_KEYS) localStorage.removeItem(key);
  } catch {
    /* storage blocked: nothing stored */
  }

  useEffect(() => {
    try {
      disconnectSocket();
    } catch {
      /* not connected */
    }
  }, []);

  return <Navigate to={loginPath()} replace />;
}
