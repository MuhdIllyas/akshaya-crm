// Platform control panel (/platform) for the software owner and their team:
// overview, organizations, subscriptions, payments, plans, admins, activity
// log and account settings. Styled like the main app's dashboard: white
// sidebar card, navy highlight, cards on a light grey page.

import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  FiActivity,
  FiBriefcase,
  FiCreditCard,
  FiFileText,
  FiGrid,
  FiLayers,
  FiLogOut,
  FiPlus,
  FiSettings,
  FiUsers,
} from "react-icons/fi";
import platformApi, { formatDateTime, getPlatformToken, permissions, ROLE_LABELS, setPlatformToken } from "./platformApi";
import OverviewPanel from "./OverviewPanel";
import OrgsPanel from "./OrgsPanel";
import SubscriptionsPanel from "./SubscriptionsPanel";
import PaymentsPanel from "./PaymentsPanel";
import PlansPanel from "./PlansPanel";
import AdminsPanel from "./AdminsPanel";
import ActivityPanel from "./ActivityPanel";
import SettingsPanel from "./SettingsPanel";
import OrgDetail from "./OrgDetail";

const SECTIONS = [
  { id: "overview", label: "Overview", icon: FiGrid },
  { id: "orgs", label: "Organizations", icon: FiBriefcase },
  { id: "subscriptions", label: "Subscriptions", icon: FiFileText },
  { id: "payments", label: "Payments", icon: FiCreditCard },
  { id: "plans", label: "Plans", icon: FiLayers },
  { id: "admins", label: "Platform admins", icon: FiUsers, owner: true, group: "Administration" },
  { id: "activity", label: "Activity log", icon: FiActivity, owner: true, group: "Administration" },
  { id: "settings", label: "Settings", icon: FiSettings, group: "Administration" },
];

const greeting = () => {
  const h = Number(new Date().toLocaleString("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

export default function PlatformAdmin() {
  const navigate = useNavigate();
  const hasToken = Boolean(getPlatformToken());
  const [me, setMe] = useState(null);
  const [previous, setPrevious] = useState(null);
  const [section, setSection] = useState("overview");
  const [createRequest, setCreateRequest] = useState(0);
  const [plans, setPlans] = useState([]);
  const [openSlug, setOpenSlug] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!hasToken) return;
    platformApi
      .get("/auth/me")
      .then(({ data }) => {
        setMe(data.admin);
        setPrevious(data.previous_sign_in);
      })
      .catch(() => {});
    platformApi.get("/plans").then(({ data }) => setPlans(data)).catch(() => {});
  }, [hasToken]);

  if (!hasToken) return <Navigate to="/platform/login" replace />;

  const can = permissions(me?.role);
  const visible = SECTIONS.filter((s) => !s.owner || can.manageOwnerOnly);
  const current = visible.find((s) => s.id === section) || visible[0];

  const signOut = () => {
    setPlatformToken("");
    navigate("/platform/login", { replace: true });
  };

  // Opening an organization from any section uses the same detail panel.
  const openOrg = (slug) => setOpenSlug(slug);
  const changed = () => setRefreshKey((k) => k + 1);

  const newOrganization = () => {
    setSection("orgs");
    setCreateRequest((n) => n + 1);
  };

  const panels = {
    overview: <OverviewPanel key={refreshKey} onOpenOrg={openOrg} />,
    orgs: <OrgsPanel key={`orgs-${refreshKey}`} role={me?.role} createRequest={createRequest} />,
    subscriptions: <SubscriptionsPanel key={`subs-${refreshKey}`} onOpenOrg={openOrg} />,
    payments: <PaymentsPanel key={`pay-${refreshKey}`} onOpenOrg={openOrg} />,
    plans: <PlansPanel role={me?.role} />,
    admins: <AdminsPanel />,
    activity: <ActivityPanel />,
    settings: <SettingsPanel me={me} />,
  };

  let lastGroup;
  return (
    <div className="min-h-screen bg-slate-100 p-3 sm:p-4">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-3 md:flex-row md:items-start">
        {/* Sidebar (top bar on phones) */}
        <aside className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm md:sticky md:top-4 md:w-60 md:shrink-0 md:p-3">
          <div className="flex items-center gap-2.5 px-2 pb-2 md:pb-4">
            <img src="/logo-light.png" alt="" className="h-9 w-9 rounded-lg border border-slate-200 object-contain p-1" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900">
                Akshaya <span className="text-teal-600">Sahayi</span>
              </p>
              <p className="text-xs text-slate-500">Control panel</p>
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible" aria-label="Control panel sections">
            {visible.map((s) => {
              const heading = s.group && s.group !== lastGroup ? s.group : null;
              lastGroup = s.group;
              const Icon = s.icon;
              const active = current.id === s.id;
              return (
                <div key={s.id} className="shrink-0 md:shrink">
                  {heading && <p className="mt-3 hidden px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 md:block">{heading}</p>}
                  <button
                    onClick={() => setSection(s.id)}
                    aria-current={active ? "page" : undefined}
                    className={`flex w-full items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                      active ? "bg-navy-700 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {s.label}
                  </button>
                </div>
              );
            })}
          </nav>
          <button
            onClick={signOut}
            className="mt-3 hidden w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-rose-700 hover:bg-rose-50 md:flex"
          >
            <FiLogOut className="h-4 w-4" aria-hidden="true" /> Sign out
          </button>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {/* Header */}
          <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold text-slate-900 sm:text-lg">
                {current.id === "overview" ? `${greeting()}${me?.name ? `, ${me.name.split(" ")[0]}` : ""}` : current.label}
              </h1>
              <p className="truncate text-xs text-slate-500">
                {previous ? `Last sign-in: ${formatDateTime(previous.created_at)} from ${previous.ip || "unknown IP"}` : "First sign-in on record"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {can.manageBilling && (
                <button onClick={newOrganization} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-navy-700 px-3 text-sm font-medium text-white hover:bg-navy-800">
                  <FiPlus aria-hidden="true" /> <span className="hidden sm:inline">New organization</span>
                </button>
              )}
              {me && (
                <button
                  onClick={() => setSection("settings")}
                  className="hidden h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm text-slate-700 hover:bg-slate-50 sm:inline-flex"
                  title="Your account"
                >
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-navy-500/10 text-xs font-semibold text-navy-700">
                    {(me.name || me.username).slice(0, 1).toUpperCase()}
                  </span>
                  <span className="max-w-[10rem] truncate">{me.name || me.username}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{ROLE_LABELS[me.role]}</span>
                </button>
              )}
              <button onClick={signOut} className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-3 text-rose-700 hover:bg-rose-50 md:hidden" aria-label="Sign out">
                <FiLogOut aria-hidden="true" />
              </button>
            </div>
          </header>

          <main className="min-w-0">{panels[current.id]}</main>
        </div>
      </div>

      {openSlug && (
        <OrgDetail
          slug={openSlug}
          plans={plans}
          role={me?.role}
          onClose={() => setOpenSlug(null)}
          onChanged={changed}
        />
      )}
    </div>
  );
}
