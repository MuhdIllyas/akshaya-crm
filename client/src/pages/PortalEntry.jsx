// Entry point for a business's own portal link: /portal/<slug>/<page>
// e.g. /portal/buyer-x/login, /portal/buyer-x/customer/register,
//      /portal/buyer-x/c/3 (a centre's link/QR), /portal/buyer-x/track/ABC123
// Checks the business exists and remembers it. The login and registration
// pages are shown right here, so the address bar keeps saying which business
// this is; other pages open at their normal address.

import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import axios from "axios";
import { clearOrgSession, getOrgSlug, setOrgSlug } from "@/tenancy/org";
import { setPreferredCentreId } from "@/tenancy/centres";
import Login from "./Login";
import CustomerRegistration from "./CustomerRegistration";

const API_URL = import.meta.env.VITE_API_URL;

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
        // A different business: the old login belongs to the old business.
        if (getOrgSlug() !== next) clearOrgSession();
        setOrgSlug(next);
        setState({ status: "ready", base: next ? `/portal/${next}` : "" });
      })
      .catch(() => !cancelled && setState({ status: "missing" }));
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (state.status === "ready") {
    const page = rest.replace(/\/$/, "") || "login";

    // Login and registration stay at /portal/<slug>/… (your own organization
    // uses the plain /login and /customer/register).
    if (page === "login") return state.base ? <Login /> : <Navigate to={`/login${window.location.search}`} replace />;
    if (page === "customer/register") return state.base ? <CustomerRegistration /> : <Navigate to="/customer/register" replace />;

    // A centre's own link or QR code: /portal/<slug>/c/<centreId>
    // remembers the centre (pre-selected when booking) and opens the customer portal.
    const centreLink = /^c\/(\d+)$/.exec(page);
    if (centreLink) {
      setPreferredCentreId(centreLink[1]);
      const loggedIn = Boolean(localStorage.getItem("customer_token"));
      return <Navigate to={loggedIn ? "/customer/dashboard" : `${state.base}/customer/register`} replace />;
    }
    return <Navigate to={`/${page}${window.location.search}`} replace />;
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
