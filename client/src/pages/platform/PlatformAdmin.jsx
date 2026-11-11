// Platform-admin page (/platform) for the software owner: organizations,
// plans and billing. Separate login from organization staff.

import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { FiBriefcase, FiLayers, FiLogOut } from "react-icons/fi";
import platformApi, { getPlatformToken, setPlatformToken } from "./platformApi";
import OrgsPanel from "./OrgsPanel";
import PlansPanel from "./PlansPanel";

const TABS = [
  ["orgs", FiBriefcase, "Organizations"],
  ["plans", FiLayers, "Plans"],
];

export default function PlatformAdmin() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("orgs");
  const [admin, setAdmin] = useState(null);
  const hasToken = Boolean(getPlatformToken());

  useEffect(() => {
    if (!hasToken) return;
    platformApi.get("/auth/me").then(({ data }) => setAdmin(data.admin)).catch(() => {});
  }, [hasToken]);

  if (!hasToken) return <Navigate to="/platform/login" replace />;

  const signOut = () => {
    setPlatformToken("");
    navigate("/platform/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Akshaya Sahayi</p>
            <h1 className="text-lg font-bold text-slate-900">Platform admin</h1>
          </div>
          <div className="flex items-center gap-3">
            {admin && <span className="hidden text-sm text-slate-600 sm:inline">{admin.name || admin.username}</span>}
            <button onClick={signOut} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <FiLogOut /> Sign out
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 px-4" role="tablist" aria-label="Sections">
          {TABS.map(([id, Icon, text]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium ${tab === id ? "border-navy-700 text-navy-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
            >
              <Icon /> {text}
            </button>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-5">{tab === "orgs" ? <OrgsPanel /> : <PlansPanel />}</main>
    </div>
  );
}
