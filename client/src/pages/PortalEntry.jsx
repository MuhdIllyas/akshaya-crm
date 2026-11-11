// Entry point for a business's own portal link: /portal/<slug>/<page>
// e.g. /portal/buyer-x/login, /portal/buyer-x/customer/register,
//      /portal/buyer-x/track/ABC123
// Checks the business exists, remembers it, then opens the normal page.

import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import axios from "axios";
import { getOrgSlug, setOrgSlug } from "@/tenancy/org";
import { setPreferredCentreId } from "@/tenancy/centres";

const API_URL = import.meta.env.VITE_API_URL;

const clearSession = () => {
  // A different business: the old login belongs to the old business.
  for (const key of ["token", "id", "role", "username", "name", "centre_id", "centre_name", "photo",
    "customer_token", "customer_id", "customer_name", "preferred_centre_id"]) {
    localStorage.removeItem(key);
  }
};

export default function PortalEntry() {
  const { slug = "", "*": rest = "" } = useParams();
  const [state, setState] = useState({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    const wanted = slug.toLowerCase();
    axios
      .get(`${API_URL}/api/org/${encodeURIComponent(wanted)}`)
      .then(({ data }) => {
        if (cancelled) return;
        if (!data.active) return setState({ status: "inactive", name: data.name });
        const next = data.is_default ? "" : data.slug;
        if (getOrgSlug() !== next) clearSession();
        setOrgSlug(next);
        setState({ status: "ready" });
      })
      .catch(() => !cancelled && setState({ status: "missing" }));
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (state.status === "ready") {
    // A centre's own link or QR code: /portal/<slug>/c/<centreId>
    // remembers the centre (pre-selected when booking) and opens the customer portal.
    const centreLink = /^c\/(\d+)\/?$/.exec(rest);
    if (centreLink) {
      setPreferredCentreId(centreLink[1]);
      const loggedIn = Boolean(localStorage.getItem("customer_token"));
      return <Navigate to={loggedIn ? "/customer/dashboard" : "/customer/register"} replace />;
    }
    const target = `/${rest || "login"}${window.location.search}`;
    return <Navigate to={target} replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {state.status === "loading" && <p className="text-sm text-slate-500">Opening portal…</p>}
        {state.status === "missing" && (
          <>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Portal not found</h1>
            <p className="mt-2 text-sm text-slate-500">Check the link you were given, or ask the centre for the correct one.</p>
          </>
        )}
        {state.status === "inactive" && (
          <>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{state.name || "This portal"} is unavailable</h1>
            <p className="mt-2 text-sm text-slate-500">This account is not active right now. Please contact the centre.</p>
          </>
        )}
        {state.status !== "loading" && (
          <Link to="/" className="mt-4 inline-block text-sm font-medium text-teal-600 hover:underline">Go to home page</Link>
        )}
      </div>
    </div>
  );
}
