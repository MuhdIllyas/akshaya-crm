import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  FiSearch, FiPlus, FiMessageSquare, FiPhone, FiX, FiChevronLeft,
  FiRefreshCw, FiLink, FiCheckCircle, FiUserPlus, FiClock, FiSend, FiTrash2, FiFileText, FiArrowRight,
} from "react-icons/fi";
import { toast } from "react-toastify";
import { socket } from "@/services/socket";
// Same reminders panel as Service Entry (WhatsApp templates + staff tasks)
import ScheduledActionsPanel from "@/components/automations/ScheduledActionsPanel";

/* ------------------------------------------------------------------
   Paths in your app — change these two if your routes are different
------------------------------------------------------------------- */
const MESSENGER_PATH = (role) => `/dashboard/${role}/messenger`;
// Service Entry exists only for staff
const SERVICE_ENTRY_PATH = (role) => (role === "staff" ? "/dashboard/staff/service_entry" : null);

const API_BASE_URL = import.meta.env.VITE_API_URL;

const STATUS = {
  new:       { label: "New",       chip: "bg-blue-100 text-blue-700" },
  contacted: { label: "Contacted", chip: "bg-violet-100 text-violet-700" },
  follow_up: { label: "Follow-up", chip: "bg-amber-100 text-amber-800" },
  converted: { label: "Converted", chip: "bg-green-100 text-green-800" },
  lost:      { label: "Lost",      chip: "bg-red-100 text-red-800" },
};
const TABS = [
  ["open", "Open"], ["new", "New"], ["contacted", "Contacted"],
  ["follow_up", "Follow-up"], ["converted", "Converted"], ["lost", "Lost"],
];
const LOST_REASONS = [
  "Went to another centre",
  "Documents not available",
  "Charges too high",
  "No reply from customer",
  "Only an enquiry",
  "Not eligible for the service",
];
const SOURCE_LABEL = {
  whatsapp_bot: "WhatsApp bot", walk_in: "Walk-in", phone_call: "Phone call",
  whatsapp_manual: "WhatsApp", referral: "Referral",
};

/* ---------------- helpers ---------------- */
function readUser(user) {
  const token = localStorage.getItem("token");
  let p = null;
  try { p = token ? JSON.parse(window.atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))) : null; } catch { p = null; }
  return {
    token,
    id: Number(user?.id || p?.id) || null,
    role: user?.role || p?.role || localStorage.getItem("role") || "staff",
    centreId: Number(user?.centre_id || p?.centre_id || localStorage.getItem("centreId")) || null,
  };
}

// Only admin and superadmin can assign / reassign leads
const isManagerRole = (r) => ["admin", "superadmin"].includes(r);

// Pass the "_ist" timestamps from the API (they carry +05:30); plain DB timestamps are IST wall time
function timeAgo(v) {
  if (!v) return "";
  const d = new Date(v);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
}

function fmtDay(day) {
  if (!day) return "";
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function todayStr() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // YYYY-MM-DD
}

// Older bot leads may contain a literal "\n" between name and place
const tidy = (s) => String(s || "").replace(/\s*(?:\\n|\r?\n)+\s*/g, ", ").trim();
const leadName = (l) => tidy(l.customer_details).split(",")[0]?.trim() || l.whatsapp_name || "Unknown";
const fmtPhone = (p) => (p && p.length === 10 ? `+91 ${p.slice(0, 5)} ${p.slice(5)}` : p || "");

function docsChip(d) {
  const v = String(d || "").toLowerCase();
  if (v.startsWith("yes")) return { text: "Ready", cls: "bg-green-100 text-green-800" };
  if (v.startsWith("not yet") || v === "no") return { text: "Not yet", cls: "bg-amber-100 text-amber-800" };
  if (!v) return { text: "—", cls: "bg-gray-100 text-gray-600" };
  return { text: "Not sure", cls: "bg-gray-100 text-gray-700" };
}

function whenText(l) {
  if (l.status === "follow_up" && l.follow_up_day) {
    return { text: l.follow_up_due ? `Due ${l.follow_up_day === todayStr() ? "today" : fmtDay(l.follow_up_day)}` : `On ${fmtDay(l.follow_up_day)}`, late: l.follow_up_due };
  }
  const created = l.created_at_ist || l.created_at;
  return { text: timeAgo(created), late: l.status === "new" && Date.now() - new Date(created).getTime() > 30 * 60000 };
}

const ACTIVITY_TEXT = {
  created: "Lead created", enquiry: "New enquiry from bot", claimed: "Took the lead", assigned: "Assignment changed",
  status: "Status changed", follow_up: "Follow-up set", note: "Note",
  lost: "Marked lost", converted: "Converted", chat_opened: "Opened chat", edited: "Details changed", task: "Follow-up task",
};

/* =================================================================== */
export default function Leads({ user }) {
  const navigate = useNavigate();
  const me = useMemo(() => readUser(user), [user]);
  const manager = isManagerRole(me.role);

  const [tab, setTab] = useState("open");
  const [assigned, setAssigned] = useState("all");
  const [search, setSearch] = useState("");
  const [centreFilter, setCentreFilter] = useState("all");
  const [leads, setLeads] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);

  // Opened from a notification ("Lead assigned to you" etc.) → show that lead
  const location = useLocation();
  useEffect(() => {
    const id = Number(location.state?.openLeadId);
    if (!id) return;
    setTab("open");
    setSelectedId(id);
    navigate(location.pathname, { replace: true, state: {} }); // don't reopen on refresh
  }, [location.state?.openLeadId]); // eslint-disable-line react-hooks/exhaustive-deps
  const [showAdd, setShowAdd] = useState(false);
  const [centres, setCentres] = useState({});
  const [catalog, setCatalog] = useState([]); // services + sub-categories for the pickers

  const api = useCallback(async (path, opts = {}) => {
    const res = await fetch(`${API_BASE_URL}/api/leads${path}`, {
      ...opts,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${me.token}`, ...(opts.headers || {}) },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Something went wrong");
    return data;
  }, [me.token]);

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    try {
      const q = new URLSearchParams({ status: tab, assigned });
      if (search.trim()) q.set("search", search.trim());
      if (me.role === "superadmin" && centreFilter !== "all") q.set("centre_id", centreFilter);
      const sq = me.role === "superadmin" && centreFilter !== "all" ? `?centre_id=${centreFilter}` : "";
      const [list, sum] = await Promise.all([api(`?${q}`), api(`/summary${sq}`)]);
      setLeads(list);
      setSummary(sum);
      if (me.role === "superadmin") {
        setCentres((prev) => {
          const next = { ...prev };
          list.forEach((l) => l.centre_id && (next[l.centre_id] = l.centre_name));
          return next;
        });
      }
    } catch (e) {
      if (!quiet) toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [api, tab, assigned, search, centreFilter, me.role]);

  useEffect(() => {
    api("/services").then((d) => setCatalog(Array.isArray(d) ? d : [])).catch(() => setCatalog([]));
  }, [api]);

  // reload on filter change (search is debounced)
  useEffect(() => {
    const t = setTimeout(() => load(), search ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  // live updates
  const reloadRef = useRef(load);
  reloadRef.current = load;
  useEffect(() => {
    let timer;
    const refresh = () => { clearTimeout(timer); timer = setTimeout(() => reloadRef.current({ quiet: true }), 400); };
    const mine = (centreId) => me.role === "superadmin" || !centreId || Number(centreId) === me.centreId;
    const onChanged = (p) => mine(p?.centre_id) && refresh();
    const onNewLead = (p) => {
      if (!mine(p?.lead?.centre_id)) return;
      toast.info(p?.message || "New WhatsApp lead");
      refresh();
    };
    socket.on("lead_changed_global", onChanged);
    socket.on("new_lead_global", onNewLead);
    return () => {
      clearTimeout(timer);
      socket.off("lead_changed_global", onChanged);
      socket.off("new_lead_global", onNewLead);
    };
  }, [me.role, me.centreId]);

  const selected = leads.find((l) => l.id === selectedId) || null;

  /* ---------- actions shared by list + panel ---------- */
  const patch = async (lead, body, okMsg) => {
    try {
      await api(`/${lead.id}`, { method: "PATCH", body: JSON.stringify(body) });
      if (okMsg) toast.success(okMsg);
      await load({ quiet: true });
      return true;
    } catch (e) {
      toast.error(e.message);
      return false;
    }
  };
  const claim = (lead) => patch(lead, { assigned_to: me.id, ...(lead.status === "new" ? { status: "contacted" } : {}) }, "Lead is yours now");
  const openChat = async (lead) => {
    try {
      const { conversation_id } = await api(`/${lead.id}/open-chat`, { method: "POST" });
      navigate(MESSENGER_PATH(me.role), { state: { openConversationId: conversation_id } });
    } catch (e) {
      toast.error(e.message);
    }
  };

  const tabCount = (k) => (summary ? summary[k] ?? 0 : "–");

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-5 md:px-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <p className="text-sm text-gray-600">Customer enquiries from WhatsApp, walk-ins and calls</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <label className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-3 h-11 flex-1 md:flex-none md:w-72">
            <FiSearch className="text-gray-500 shrink-0" aria-hidden="true" />
            <span className="sr-only">Search leads</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, phone or service"
              className="flex-1 outline-none text-sm bg-transparent"
            />
          </label>
          <label className="sr-only" htmlFor="lead-assigned">Show</label>
          <select
            id="lead-assigned"
            value={assigned}
            onChange={(e) => setAssigned(e.target.value)}
            className="h-11 border border-gray-300 rounded-lg px-3 text-sm bg-white"
          >
            <option value="all">All leads</option>
            {!manager && <option value="me">My leads</option>}
            <option value="unassigned">{manager ? "Not assigned yet" : "Not taken yet"}</option>
          </select>
          {me.role === "superadmin" && (
            <>
              <label className="sr-only" htmlFor="lead-centre">Centre</label>
              <select
                id="lead-centre"
                value={centreFilter}
                onChange={(e) => setCentreFilter(e.target.value)}
                className="h-11 border border-gray-300 rounded-lg px-3 text-sm bg-white"
              >
                <option value="all">All centres</option>
                {Object.entries(centres).map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
            </>
          )}
          <button
            type="button"
            onClick={() => load()}
            aria-label="Refresh"
            className="h-11 w-11 flex items-center justify-center rounded-lg border border-gray-300 bg-white text-navy-700 hover:bg-gray-50"
          >
            <FiRefreshCw className={loading ? "animate-spin" : ""} />
          </button>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="h-11 px-4 rounded-lg bg-navy-700 hover:bg-navy-800 text-white text-sm font-semibold flex items-center gap-2"
          >
            <FiPlus /> Add lead
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Kpi label="New – waiting for reply" value={summary?.new} tone="text-blue-700"
             hint={summary?.unassigned ? `${summary.unassigned} not taken yet` : "All taken"} />
        <Kpi label="Follow-ups due" value={summary?.due_today} tone="text-amber-700" hint="Today or overdue" />
        {manager ? (
          <Kpi label="Not assigned yet" value={summary?.unassigned} tone="text-navy-700" hint="Open a lead to assign a staff member" />
        ) : (
          <Kpi label="My open leads" value={summary?.mine} tone="text-navy-700" hint="Assigned to you" />
        )}
        <Kpi label="Converted this month" value={summary?.converted_month} tone="text-green-700"
             hint={summary?.created_month ? `of ${summary.created_month} leads this month` : "This month"} />
      </div>

      <div className="flex flex-col 2xl:flex-row gap-5 items-start">
        {/* List */}
        <section aria-label="Lead list" className="w-full 2xl:flex-1 min-w-0 bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex gap-5 px-4 border-b border-gray-200 overflow-x-auto">
            {TABS.map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={`py-3 text-sm whitespace-nowrap border-b-[3px] flex items-center gap-1.5 ${
                  tab === k ? "border-navy-700 text-navy-700 font-semibold" : "border-transparent text-gray-600 hover:text-gray-900"
                }`}
              >
                {label}
                <span className="text-xs bg-gray-100 text-gray-700 rounded-full px-2 py-0.5 font-semibold">{tabCount(k)}</span>
              </button>
            ))}
          </div>

          {loading && !leads.length ? (
            <div className="p-10 text-center text-gray-500 text-sm">Loading leads…</div>
          ) : !leads.length ? (
            <div className="p-10 text-center text-gray-500 text-sm">No leads here.</div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
                    <tr>
                      <th className="text-left font-semibold px-4 py-2.5">Customer</th>
                      <th className="text-left font-semibold px-3 py-2.5">Service asked</th>
                      <th className="text-left font-semibold px-3 py-2.5">Docs</th>
                      {me.role === "superadmin" && <th className="text-left font-semibold px-3 py-2.5">Centre</th>}
                      <th className="text-left font-semibold px-3 py-2.5">Assigned</th>
                      <th className="text-left font-semibold px-3 py-2.5">Status</th>
                      <th className="text-left font-semibold px-3 py-2.5">When</th>
                      <th className="text-right font-semibold px-4 py-2.5">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((l) => {
                      const docs = docsChip(l.docs_ready);
                      const when = whenText(l);
                      return (
                        <tr key={l.id} className={`border-t border-gray-100 ${selectedId === l.id ? "bg-indigo-50" : "hover:bg-gray-50"}`}>
                          <td className="px-4 py-3">
                            <button type="button" onClick={() => setSelectedId(l.id)} className="font-semibold text-gray-900 hover:underline text-left">
                              {leadName(l)}
                            </button>
                            <div className="text-xs text-gray-600">{fmtPhone(l.phone)}</div>
                          </td>
                          <td className="px-3 py-3 text-gray-900">{l.service_needed || "Not given"}</td>
                          <td className="px-3 py-3"><span className={`text-xs font-semibold rounded-full px-2.5 py-1 ${docs.cls}`}>{docs.text}</span></td>
                          {me.role === "superadmin" && <td className="px-3 py-3 text-gray-700">{l.centre_name || "—"}</td>}
                          <td className="px-3 py-3">
                            {l.assigned_to ? (
                              <span className="flex items-center gap-2 text-gray-700">
                                <span className="w-7 h-7 rounded-full bg-indigo-100 text-navy-700 text-xs font-bold flex items-center justify-center">
                                  {(l.assigned_to_name || "?")[0]}
                                </span>
                                {l.assigned_to === me.id ? "You" : l.assigned_to_name}
                                {manager && ["new", "contacted", "follow_up"].includes(l.status) && (
                                  <button type="button" onClick={() => setSelectedId(l.id)}
                                          className="text-xs font-semibold text-navy-700 underline underline-offset-2 hover:text-navy-800">
                                    Change
                                  </button>
                                )}
                              </span>
                            ) : ["new", "contacted", "follow_up"].includes(l.status) ? (
                              manager ? (
                                <button type="button" onClick={() => setSelectedId(l.id)} className="h-8 px-3 rounded-lg border border-navy-700 text-navy-700 text-xs font-semibold hover:bg-indigo-50">
                                  Assign
                                </button>
                              ) : (
                                <button type="button" onClick={() => claim(l)} className="h-8 px-3 rounded-lg border border-navy-700 text-navy-700 text-xs font-semibold hover:bg-indigo-50">
                                  Take it
                                </button>
                              )
                            ) : <span className="text-gray-500">—</span>}
                          </td>
                          <td className="px-3 py-3"><span className={`text-xs font-semibold rounded-full px-2.5 py-1 ${STATUS[l.status].chip}`}>{STATUS[l.status].label}</span></td>
                          <td className={`px-3 py-3 ${when.late ? "text-red-700 font-semibold" : "text-gray-600"}`}>{when.text}</td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-1.5">
                              {l.matched_entry_id && (
                                <span title={`Service entry #${l.matched_entry_id} found for this number`} className="h-10 w-10 flex items-center justify-center text-green-700">
                                  <FiCheckCircle aria-label="Service entry found" />
                                </span>
                              )}
                              <IconBtn label="Open WhatsApp chat" onClick={() => openChat(l)} disabled={!l.conversation_id}><FiMessageSquare /></IconBtn>
                              <IconBtn label="Call customer" href={`tel:+91${l.phone}`}><FiPhone /></IconBtn>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden p-3 flex flex-col gap-3">
                {leads.map((l) => {
                  const docs = docsChip(l.docs_ready);
                  const when = whenText(l);
                  const open = ["new", "contacted", "follow_up"].includes(l.status);
                  return (
                    <article key={l.id} className="border border-gray-200 rounded-xl p-3.5 flex flex-col gap-2.5">
                      <div className="flex justify-between gap-2">
                        <button type="button" onClick={() => setSelectedId(l.id)} className="text-left">
                          <div className="font-bold text-gray-900">{leadName(l)}</div>
                          <div className="text-sm text-gray-700">{l.service_needed || "Not given"}</div>
                        </button>
                        <span className={`self-start text-[11px] font-bold rounded-full px-2.5 py-1 whitespace-nowrap ${STATUS[l.status].chip}`}>{STATUS[l.status].label}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className={`font-semibold rounded-full px-2 py-0.5 ${docs.cls}`}>Docs: {docs.text}</span>
                        <span className={when.late ? "text-red-700 font-semibold" : "text-gray-600"}>{when.text}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {open && !l.assigned_to && !manager ? (
                          <button type="button" onClick={() => claim(l)} className="h-11 rounded-lg bg-navy-700 text-white text-sm font-semibold">Take it</button>
                        ) : open && !l.assigned_to ? (
                          <button type="button" onClick={() => setSelectedId(l.id)} className="h-11 rounded-lg bg-navy-700 text-white text-sm font-semibold">Assign</button>
                        ) : (
                          <button type="button" onClick={() => setSelectedId(l.id)} className="h-11 rounded-lg bg-navy-700 text-white text-sm font-semibold">Update</button>
                        )}
                        <button type="button" onClick={() => openChat(l)} disabled={!l.conversation_id} className="h-11 rounded-lg border border-gray-300 text-navy-700 text-sm font-semibold disabled:opacity-40">Chat</button>
                        <a href={`tel:+91${l.phone}`} className="h-11 rounded-lg border border-gray-300 text-navy-700 text-sm font-semibold flex items-center justify-center">Call</a>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </section>

        {/* Detail panel: side panel on desktop, full screen on phone */}
        {selected && (
          <LeadPanel
            key={selected.id}
            lead={selected}
            me={me}
            manager={manager}
            api={api}
            onClose={() => setSelectedId(null)}
            onPatch={patch}
            onClaim={claim}
            onOpenChat={openChat}
            onReload={() => load({ quiet: true })}
            onDeleted={() => { setSelectedId(null); load({ quiet: true }); }}
            catalog={catalog}
            onCreateEntry={(l) =>
              navigate(SERVICE_ENTRY_PATH(me.role), {
                state: { fromLead: { lead_id: l.id, phone: l.phone, customer_name: leadName(l), service: l.service_needed } },
              })
            }
          />
        )}
      </div>

      {showAdd && (
        <AddLeadModal
          api={api}
          me={me}
          catalog={catalog}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); load({ quiet: true }); }}
        />
      )}
    </div>
  );
}

/* ---------------- small pieces ---------------- */
function Kpi({ label, value, hint, tone }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-4 py-3.5">
      <div className="text-xs md:text-sm text-gray-600 font-medium">{label}</div>
      <div className={`text-2xl md:text-3xl font-bold mt-1 ${tone}`}>{value ?? "–"}</div>
      <div className="text-xs text-gray-600 mt-0.5">{hint}</div>
    </div>
  );
}

function IconBtn({ label, onClick, href, disabled, children }) {
  const cls = "h-10 w-10 rounded-lg border border-gray-300 bg-white text-navy-700 flex items-center justify-center hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed";
  if (href) return <a href={href} aria-label={label} title={label} className={cls}>{children}</a>;
  return <button type="button" aria-label={label} title={disabled ? "No WhatsApp chat for this number yet" : label} onClick={onClick} disabled={disabled} className={cls}>{children}</button>;
}

/* =================== Lead detail panel =================== */
function LeadPanel({ lead, me, manager, api, onClose, onPatch, onClaim, onOpenChat, onReload, onCreateEntry, catalog, onDeleted }) {
  const [activity, setActivity] = useState([]);
  const [staff, setStaff] = useState([]);
  const [pending, setPending] = useState(null); // 'follow_up' | 'lost' | 'converted'
  const [followDate, setFollowDate] = useState(lead.follow_up_day || "");
  const [lostReason, setLostReason] = useState(lead.lost_reason || LOST_REASONS[0]);
  const [entryId, setEntryId] = useState(lead.converted_service_entry_id || lead.matched_entry_id || "");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const deleteLead = async () => {
    setSaving(true);
    try {
      await api(`/${lead.id}`, { method: "DELETE" });
      toast.success("Lead deleted");
      onDeleted();
    } catch (e) {
      toast.error(e.message);
      setSaving(false);
    }
  };
  const [draft, setDraft] = useState({
    customer_details: tidy(lead.customer_details),
    service_needed: lead.service_needed || "",
    docs_ready: lead.docs_ready || "",
  });
  // Staff can work on their own lead (or a free one); admins on any
  const canEdit = manager || !lead.assigned_to || lead.assigned_to === me.id;
  const canStartEntry = !!SERVICE_ENTRY_PATH(me.role) && canEdit && ["new", "contacted", "follow_up"].includes(lead.status);

  const loadActivity = useCallback(() => {
    api(`/${lead.id}/activity`).then(setActivity).catch(() => setActivity([]));
  }, [api, lead.id]);

  useEffect(() => { loadActivity(); }, [loadActivity, lead.updated_at_ist, lead.updated_at]);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  useEffect(() => {
    // staff list: reassigning (admins) and choosing who gets a reminder task (everyone)
    const q = me.role === "superadmin" && lead.centre_id ? `?centre_id=${lead.centre_id}` : "";
    api(`/staff${q}`).then(setStaff).catch(() => setStaff([]));
  }, [api, me.role, lead.centre_id]);
  // Reminders use the service picked on the lead ("Service – Sub-category")
  const svcIds = useMemo(() => parseServiceLabel(catalog, lead.service_needed), [catalog, lead.service_needed]);
  const reminderStaff = useMemo(() => staff.map((s) => ({ id: s.id, display: s.name })), [staff]);

  const docs = docsChip(lead.docs_ready);
  const isOpen = ["new", "contacted", "follow_up"].includes(lead.status);

  const saveDetails = async () => {
    if (!draft.service_needed.trim()) return toast.error("Service can't be empty");
    setSaving(true);
    if (await onPatch(lead, draft, "Details saved")) setEditing(false);
    setSaving(false);
  };

  const pickStatus = async (s) => {
    if (s === lead.status && s !== "follow_up") return;
    if (["follow_up", "lost", "converted"].includes(s)) { setPending(s); return; }
    setPending(null);
    await onPatch(lead, { status: s }, `Marked ${STATUS[s].label}`);
  };

  const saveFollowUp = async () => {
    if (!followDate) return toast.error("Pick a date");
    setSaving(true);
    if (await onPatch(lead, { status: "follow_up", follow_up_date: followDate }, `Follow-up on ${fmtDay(followDate)}`)) setPending(null);
    setSaving(false);
  };
  const saveLost = async () => {
    setSaving(true);
    if (await onPatch(lead, { status: "lost", lost_reason: lostReason }, "Marked lost")) setPending(null);
    setSaving(false);
  };
  const saveConverted = async () => {
    setSaving(true);
    const body = { status: "converted" };
    if (entryId) body.converted_service_entry_id = entryId;
    if (await onPatch(lead, body, "Lead converted")) setPending(null);
    setSaving(false);
  };
  const addNote = async () => {
    if (!note.trim()) return;
    setSaving(true);
    try {
      await api(`/${lead.id}/notes`, { method: "POST", body: JSON.stringify({ note }) });
      setNote("");
      loadActivity();
      onReload();
    } catch (e) {
      toast.error(e.message);
    }
    setSaving(false);
  };

  return (
    <>
      {/* Phone: full screen. Laptop: slides over from the right. Very wide screens: sits beside the list. */}
      <div className="fixed inset-0 bg-black/30 z-40 2xl:hidden" onClick={onClose} aria-hidden="true" />
      <aside
        aria-label="Lead details"
        className="fixed inset-y-0 right-0 w-full sm:w-[440px] z-50 overflow-y-auto bg-white p-5 flex flex-col gap-5 shadow-2xl
                   2xl:shadow-none 2xl:z-auto 2xl:inset-auto 2xl:w-[400px] 2xl:shrink-0 2xl:border 2xl:border-gray-200 2xl:rounded-xl 2xl:sticky 2xl:top-4 2xl:max-h-[calc(100vh-2rem)]"
      >
        {/* Head */}
        <div className="flex items-start gap-3">
          <button type="button" onClick={onClose} aria-label="Close" className="h-10 w-10 -ml-2 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100">
            <FiChevronLeft className="sm:hidden" size={22} />
            <FiX className="hidden sm:block" size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-gray-900 truncate">{leadName(lead)}</h2>
            <div className="text-sm text-gray-700">{fmtPhone(lead.phone)}</div>
            <div className="text-xs text-gray-600 mt-0.5">
              {SOURCE_LABEL[lead.source] || lead.source}{lead.centre_name ? ` · ${lead.centre_name}` : ""} · {timeAgo(lead.created_at_ist || lead.created_at)}
            </div>
          </div>
          <span className={`text-xs font-semibold rounded-full px-3 py-1 whitespace-nowrap ${STATUS[lead.status].chip}`}>{STATUS[lead.status].label}</span>
        </div>

        {/* Main actions */}
        {/* When staff can start the entry, that is the main action (navy);
            chat and call become the secondary outline buttons. */}
        {canStartEntry && (
          <button type="button" onClick={() => onCreateEntry(lead)}
                  className="w-full min-h-[44px] py-2.5 rounded-lg bg-navy-700 hover:bg-navy-800 text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-sm">
            <FiFileText className="shrink-0" /> Start service entry
            <FiArrowRight className="shrink-0 opacity-80" />
          </button>
        )}
        <div className="grid grid-cols-2 gap-2.5">
          <button type="button" onClick={() => onOpenChat(lead)} disabled={!lead.conversation_id}
                  className={`h-11 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40 ${
                    canStartEntry
                      ? "border border-gray-300 text-navy-700 hover:bg-gray-50"
                      : "bg-navy-700 hover:bg-navy-800 text-white"
                  }`}>
            <FiMessageSquare /> Open chat
          </button>
          <a href={`tel:+91${lead.phone}`} className="h-11 rounded-lg border border-gray-300 text-navy-700 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-gray-50">
            <FiPhone /> Call
          </a>
        </div>
        {!canEdit && (
          <p className="text-sm bg-amber-50 border border-amber-200 text-amber-900 rounded-lg px-3 py-2">
            This lead is with <strong>{lead.assigned_to_name}</strong>. Only they or an admin can update it.
          </p>
        )}

        {/* Assignment */}
        <div className="flex items-center justify-between gap-3 text-sm">
          <label htmlFor="lead-assign" className="text-gray-600">{manager && lead.assigned_to ? "Reassign to" : "Assigned to"}</label>
          {manager ? (
            <select
              value={lead.assigned_to || ""}
              onChange={(e) => onPatch(lead, { assigned_to: e.target.value || null }, "Assignment saved")}
              id="lead-assign"
              className="h-10 border border-gray-300 rounded-lg px-2 text-sm bg-white max-w-[60%]"
            >
              <option value="">Not assigned – pick staff</option>
              {lead.assigned_to && !staff.some((s) => s.id === lead.assigned_to) && (
                <option value={lead.assigned_to}>{lead.assigned_to_name} (not staff)</option>
              )}
              {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          ) : lead.assigned_to ? (
            <span className="font-semibold text-gray-900">{lead.assigned_to === me.id ? "You" : lead.assigned_to_name}</span>
          ) : isOpen ? (
            <button type="button" onClick={() => onClaim(lead)} className="h-10 px-4 rounded-lg border border-navy-700 text-navy-700 font-semibold flex items-center gap-2 hover:bg-indigo-50">
              <FiUserPlus /> Take this lead
            </button>
          ) : <span className="text-gray-500">—</span>}
        </div>

        {/* What the customer told the bot */}
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              {lead.source === "whatsapp_bot" ? "Customer told the bot" : "Lead details"}
            </span>
            {canEdit && !editing && (
              <button type="button" onClick={() => setEditing(true)} className="text-sm font-semibold text-navy-700 underline underline-offset-2">
                Edit
              </button>
            )}
          </div>
          {editing ? (
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm font-semibold text-gray-900">
                Name
                <input value={draft.customer_details} onChange={(e) => setDraft({ ...draft, customer_details: e.target.value })}
                       className="h-10 border border-gray-300 rounded-lg px-3 text-sm font-normal bg-white" />
              </label>
              <ServicePicker catalog={catalog} value={draft.service_needed}
                             onChange={(v) => setDraft({ ...draft, service_needed: v })} />
              <label className="flex flex-col gap-1 text-sm font-semibold text-gray-900">
                Documents ready?
                <select value={draft.docs_ready} onChange={(e) => setDraft({ ...draft, docs_ready: e.target.value })}
                        className="h-10 border border-gray-300 rounded-lg px-2 text-sm font-normal bg-white">
                  <option value="">Don't know</option>
                  <option value="Yes, ready">Yes, ready</option>
                  <option value="Not yet">Not yet</option>
                  <option value="Not sure">Not sure</option>
                </select>
              </label>
              <PanelButtons saving={saving} onSave={saveDetails} onCancel={() => setEditing(false)} />
            </div>
          ) : (
          <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2 text-sm">
            <dt className="text-gray-600">Service</dt><dd className="font-semibold text-gray-900">{lead.service_needed || "Not given"}</dd>
            <dt className="text-gray-600">Name</dt><dd className="text-gray-900">{tidy(lead.customer_details) || "—"}</dd>
            {lead.whatsapp_name && (<><dt className="text-gray-600">WhatsApp name</dt><dd className="text-gray-900">{lead.whatsapp_name}</dd></>)}
            <dt className="text-gray-600">Documents</dt><dd><span className={`text-xs font-semibold rounded-full px-2.5 py-1 ${docs.cls}`}>{docs.text}</span></dd>
            {lead.customer_id && (<><dt className="text-gray-600">Customer</dt><dd className="text-green-800 font-medium">Existing customer</dd></>)}
          </dl>
          )}
        </div>

        {/* Service entry found automatically */}
        {lead.matched_entry_id && isOpen && (
          <div className="border border-green-200 bg-green-50 rounded-xl p-4 flex flex-col gap-2">
            <div className="text-sm font-semibold text-green-800 flex items-center gap-2"><FiCheckCircle /> Service entry #{lead.matched_entry_id} found for this number</div>
            <p className="text-sm text-gray-700">It was made after this enquiry. Mark the lead as converted and link it?</p>
            <button type="button" disabled={saving}
                    onClick={() => onPatch(lead, { status: "converted", converted_service_entry_id: lead.matched_entry_id }, "Lead converted")}
                    className="h-11 rounded-lg bg-green-700 hover:bg-green-800 text-white text-sm font-semibold flex items-center justify-center gap-2">
              <FiLink /> Link and mark converted
            </button>
          </div>
        )}

        {/* Follow-up task (My Tasks + Calendar) */}
        {lead.status === "follow_up" && lead.follow_up_task_id && lead.follow_up_task_status !== "completed" && (
          <p className="text-sm bg-indigo-50 border border-indigo-100 text-indigo-900 rounded-lg px-3 py-2">
            📅 Follow-up task on <strong>{fmtDay(lead.follow_up_day)}</strong> is in{" "}
            {lead.assigned_to === me.id ? "your" : `${lead.assigned_to_name}'s`} My Tasks and on the Calendar.
          </p>
        )}
        {lead.status === "follow_up" && lead.follow_up_task_status === "completed" && canEdit && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex flex-col gap-2">
            <p className="text-sm font-semibold text-amber-900">Follow-up task is done. What happened with the customer?</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => onPatch(lead, { status: "contacted" }, "Marked Contacted")}
                      className="h-9 px-3 rounded-lg border border-gray-300 bg-white text-sm font-semibold text-gray-800">Spoke – still deciding</button>
              <button type="button" onClick={() => setPending("follow_up")}
                      className="h-9 px-3 rounded-lg border border-gray-300 bg-white text-sm font-semibold text-gray-800">Follow up again</button>
              {canStartEntry && (
                <button type="button" onClick={() => onCreateEntry(lead)}
                        className="h-9 px-3 rounded-lg bg-navy-700 hover:bg-navy-800 text-white text-sm font-semibold">Start service entry</button>
              )}
              <button type="button" onClick={() => setPending("lost")}
                      className="h-9 px-3 rounded-lg border border-red-200 bg-white text-sm font-semibold text-red-800">Lost</button>
            </div>
          </div>
        )}

        {/* Scheduled reminders (WhatsApp to the customer / task for staff).
            They move to the service entry when this lead is converted,
            and stop if it is marked Lost or deleted. */}
        {(isOpen || lead.status === "lost") && (
          <div className="border border-gray-200 rounded-xl p-4">
            {isOpen && catalog.length > 0 && svcIds.svcId === OTHER && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
                Pick a service from the list (Edit above) to see the reminders set up for it.
              </p>
            )}
            <ScheduledActionsPanel
              key={lead.id}
              leadId={lead.id}
              readOnly={!isOpen || !canEdit}
              categoryId={svcIds.svcId && svcIds.svcId !== OTHER ? svcIds.svcId : ""}
              subcategoryId={svcIds.subId}
              customerName={leadName(lead) === "Unknown" ? "" : leadName(lead)}
              serviceName={lead.service_needed || ""}
              staffList={reminderStaff}
              suggestedDocs={[]}
              defaultAssignee={lead.assigned_to || (manager ? "" : me.id) || ""}
            />
          </div>
        )}

        {/* Status */}
        {canEdit && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-gray-900">Update status</span>
          <div className="flex flex-wrap gap-2">
            {Object.entries(STATUS).map(([k, s]) => (
              <button
                key={k}
                type="button"
                onClick={() => pickStatus(k)}
                className={`h-10 px-3.5 rounded-lg text-sm font-semibold border ${
                  (pending || lead.status) === k ? "bg-navy-700 text-white border-navy-700" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {pending === "follow_up" && (
            <div className="flex flex-col gap-2 border border-amber-200 bg-amber-50 rounded-xl p-3">
              <label className="text-sm font-semibold text-gray-900" htmlFor="fu-date">Follow up on</label>
              <p className="text-xs text-gray-700">
                {lead.assigned_to
                  ? "A follow-up task will be added to My Tasks and the Calendar for this date."
                  : "Assign the lead to a staff member to get a follow-up task in My Tasks and the Calendar."}
              </p>
              <div className="flex flex-wrap gap-2">
                {[["Tomorrow", 1], ["In 3 days", 3], ["Next week", 7]].map(([t, n]) => (
                  <button key={t} type="button"
                          onClick={() => { const d = new Date(); d.setDate(d.getDate() + n); setFollowDate(d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })); }}
                          className="h-9 px-3 rounded-lg border border-gray-300 bg-white text-sm">{t}</button>
                ))}
              </div>
              <input id="fu-date" type="date" min={todayStr()} value={followDate} onChange={(e) => setFollowDate(e.target.value)}
                     className="h-11 border border-gray-300 rounded-lg px-3 text-sm bg-white" />
              <PanelButtons saving={saving} onSave={saveFollowUp} onCancel={() => setPending(null)} />
            </div>
          )}

          {pending === "lost" && (
            <div className="flex flex-col gap-2 border border-red-200 bg-red-50 rounded-xl p-3">
              <label className="text-sm font-semibold text-gray-900" htmlFor="lost-reason">Why was it lost? (required)</label>
              <select id="lost-reason" value={lostReason} onChange={(e) => setLostReason(e.target.value)}
                      className="h-11 border border-gray-300 rounded-lg px-3 text-sm bg-white">
                {LOST_REASONS.map((r) => <option key={r}>{r}</option>)}
              </select>
              <PanelButtons saving={saving} onSave={saveLost} onCancel={() => setPending(null)} />
            </div>
          )}

          {pending === "converted" && (
            <div className="flex flex-col gap-2 border border-green-200 bg-green-50 rounded-xl p-3">
              <p className="text-sm text-gray-700">Make the service entry first, then link it here.</p>
              {SERVICE_ENTRY_PATH(me.role) && (
                <button type="button" onClick={() => onCreateEntry(lead)}
                        className="h-11 rounded-lg bg-green-700 hover:bg-green-800 text-white text-sm font-semibold">
                  Create service entry
                </button>
              )}
              <label className="text-sm font-semibold text-gray-900 mt-1" htmlFor="entry-id">Service entry number (optional)</label>
              <input id="entry-id" inputMode="numeric" value={entryId} onChange={(e) => setEntryId(e.target.value.replace(/\D/g, ""))}
                     placeholder="e.g. 10452" className="h-11 border border-gray-300 rounded-lg px-3 text-sm bg-white" />
              <PanelButtons saving={saving} onSave={saveConverted} onCancel={() => setPending(null)} saveText="Mark converted" />
            </div>
          )}

          {lead.status === "lost" && lead.lost_reason && !pending && (
            <p className="text-sm text-red-800">Reason: {lead.lost_reason}</p>
          )}
          {lead.status === "converted" && lead.converted_service_entry_id && !pending && (
            <p className="text-sm text-green-800">Linked to service entry #{lead.converted_service_entry_id}</p>
          )}
        </div>
        )}

        {/* Note */}
        <div className="flex flex-col gap-2">
          <label htmlFor="lead-note" className="text-sm font-semibold text-gray-900">Add a note</label>
          <textarea id="lead-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)}
                    placeholder="Eg: Will come on Saturday with Aadhaar and birth certificate"
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm resize-y" />
          <button type="button" onClick={addNote} disabled={!note.trim() || saving}
                  className="self-end h-10 px-4 rounded-lg bg-navy-700 hover:bg-navy-800 text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-40">
            <FiSend /> Save note
          </button>
        </div>

        {/* Activity */}
        <div className="flex flex-col gap-3">
          <span className="text-sm font-semibold text-gray-900 flex items-center gap-2"><FiClock /> Activity</span>
          {!activity.length && <p className="text-sm text-gray-500">No activity yet.</p>}
          {activity.map((a) => (
            <div key={a.id} className="grid grid-cols-[10px_1fr] gap-3 text-sm">
              <span className="w-2 h-2 rounded-full bg-navy-700 mt-1.5" />
              <div>
                <div className="text-gray-900">
                  <span className="font-medium">{a.staff_name || "System"}</span>
                  {" · "}{ACTIVITY_TEXT[a.action] || a.action}
                </div>
                {a.details && <div className={`text-gray-700 ${a.action === "note" ? "whitespace-pre-line bg-gray-50 rounded-lg px-3 py-2 mt-1" : ""}`}>{a.details}</div>}
                <div className="text-xs text-gray-500 mt-0.5">{timeAgo(a.created_at_ist || a.created_at)}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Delete — admin / superadmin only */}
        {manager && (
          <div className="border-t border-gray-200 pt-4">
            {!confirmDelete ? (
              <button type="button" onClick={() => setConfirmDelete(true)}
                      className="h-10 px-4 rounded-lg border border-red-200 text-red-700 text-sm font-semibold flex items-center gap-2 hover:bg-red-50">
                <FiTrash2 /> Delete lead
              </button>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex flex-col gap-2">
                <p className="text-sm text-red-900">
                  <strong>Delete this lead permanently?</strong> Its notes and history will be removed
                  {lead.follow_up_task_id ? " and its follow-up task closed" : ""}. The WhatsApp chat
                  {lead.converted_service_entry_id ? " and the service entry stay" : " stays"} as they are.
                  {["new", "contacted", "follow_up"].includes(lead.status) && " If it's just closed, marking it Lost keeps the record instead."}
                </p>
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => setConfirmDelete(false)}
                          className="h-10 px-4 rounded-lg border border-gray-300 bg-white text-sm font-semibold text-gray-700">Cancel</button>
                  <button type="button" onClick={deleteLead} disabled={saving}
                          className="h-10 px-4 rounded-lg bg-red-700 hover:bg-red-800 text-white text-sm font-semibold disabled:opacity-50">
                    {saving ? "Deleting…" : "Yes, delete"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </aside>
    </>
  );
}

function PanelButtons({ saving, onSave, onCancel, saveText = "Save" }) {
  return (
    <div className="flex gap-2 justify-end">
      <button type="button" onClick={onCancel} className="h-10 px-4 rounded-lg border border-gray-300 bg-white text-sm font-semibold text-gray-700">Cancel</button>
      <button type="button" onClick={onSave} disabled={saving} className="h-10 px-4 rounded-lg bg-navy-700 hover:bg-navy-800 text-white text-sm font-semibold disabled:opacity-50">
        {saving ? "Saving…" : saveText}
      </button>
    </div>
  );
}

/* =================== Add walk-in / call lead =================== */
function AddLeadModal({ api, me, onClose, onSaved, catalog }) {
  const manager = isManagerRole(me.role);
  const [form, setForm] = useState({ phone: "", customer_details: "", service_needed: "", docs_ready: "", source: "walk_in", notes: "", assign_to_me: true, assigned_to: "" });
  const [saving, setSaving] = useState(false);
  const [staffList, setStaffList] = useState([]);
  useEffect(() => {
    if (manager && me.role !== "superadmin") api("/staff").then(setStaffList).catch(() => setStaffList([]));
  }, [api, manager, me.role]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    if (!form.service_needed.trim()) return toast.error("Choose the service");
    setSaving(true);
    try {
      await api("", { method: "POST", body: JSON.stringify(form) });
      toast.success("Lead added");
      onSaved();
    } catch (err) {
      toast.error(err.message);
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end md:items-center justify-center p-0 md:p-4" role="dialog" aria-modal="true" aria-labelledby="add-lead-title">
      <form onSubmit={save} className="bg-white w-full md:max-w-lg rounded-t-2xl md:rounded-2xl p-5 flex flex-col gap-4 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 id="add-lead-title" className="text-lg font-bold text-gray-900">Add a lead</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="h-10 w-10 flex items-center justify-center rounded-lg hover:bg-gray-100"><FiX size={20} /></button>
        </div>
        <Field label="Phone number" required>
          <input required inputMode="tel" value={form.phone} onChange={set("phone")} placeholder="10-digit mobile number" className="input-lead" />
        </Field>
        <ServicePicker catalog={catalog} value={form.service_needed} required
                       onChange={(v) => setForm((f) => ({ ...f, service_needed: v }))} />
        <Field label="Customer name">
          <input value={form.customer_details} onChange={set("customer_details")} placeholder="Eg: Shameer" className="input-lead" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="How did they contact?">
            <select value={form.source} onChange={set("source")} className="input-lead">
              <option value="walk_in">Walk-in</option>
              <option value="phone_call">Phone call</option>
              <option value="whatsapp_manual">WhatsApp</option>
              <option value="referral">Referral</option>
            </select>
          </Field>
          <Field label="Documents ready?">
            <select value={form.docs_ready} onChange={set("docs_ready")} className="input-lead">
              <option value="">Don't know</option>
              <option value="Yes, ready">Yes, ready</option>
              <option value="Not yet">Not yet</option>
              <option value="Not sure">Not sure</option>
            </select>
          </Field>
        </div>
        <Field label="Note">
          <textarea rows={2} value={form.notes} onChange={set("notes")} className="input-lead py-2 h-auto" />
        </Field>
        {manager ? (
          me.role !== "superadmin" && (
            <Field label="Assign to staff">
              <select value={form.assigned_to} onChange={set("assigned_to")} className="input-lead">
                <option value="">Leave unassigned</option>
                {staffList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
          )
        ) : (
          <label className="flex items-center gap-2 text-sm text-gray-800">
            <input type="checkbox" checked={form.assign_to_me} onChange={set("assign_to_me")} className="w-4 h-4" />
            Assign to me
          </label>
        )}
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="h-11 px-4 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700">Cancel</button>
          <button type="submit" disabled={saving} className="h-11 px-5 rounded-lg bg-navy-700 hover:bg-navy-800 text-white text-sm font-semibold disabled:opacity-50">
            {saving ? "Saving…" : "Add lead"}
          </button>
        </div>
      </form>
      <style>{`.input-lead{height:2.75rem;width:100%;border:1px solid #d1d5db;border-radius:.5rem;padding:0 .75rem;font-size:.875rem;background:#fff}`}</style>
    </div>
  );
}

/* ---------- Service + sub-category picker (from Service Management) ----------
   The value is a text label "Service – Sub-category" — the same format the WhatsApp bot
   saves, so Service Entry can fill in the service from it. "Other" allows free text. */
const OTHER = "__other__";
const SEP = " – ";
function parseServiceLabel(catalog, value) {
  const v = String(value || "").trim();
  if (!v) return { svcId: "", subId: "", other: "" };
  const norm = (x) => String(x || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const [a, b] = v.split(/\s+[–-]\s+/);
  const svc = catalog.find((s) => norm(s.name) === norm(a));
  if (!svc) return { svcId: OTHER, subId: "", other: v };
  const sub = (svc.subcategories || []).find((x) => norm(x.name) === norm(b));
  return { svcId: String(svc.id), subId: sub ? String(sub.id) : "", other: "" };
}

function ServicePicker({ catalog, value, onChange, required }) {
  const [state, setState] = useState(() => parseServiceLabel(catalog, value));
  // catalogue arrives after first render → re-read the current value once it's there
  useEffect(() => { if (catalog.length) setState(parseServiceLabel(catalog, value)); }, [catalog.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const svc = catalog.find((s) => String(s.id) === state.svcId);
  const subs = svc?.subcategories || [];

  const emit = (next) => {
    setState(next);
    if (next.svcId === OTHER) return onChange(next.other.trim());
    const s = catalog.find((x) => String(x.id) === next.svcId);
    if (!s) return onChange("");
    const sub = (s.subcategories || []).find((x) => String(x.id) === next.subId);
    onChange(sub ? `${s.name}${SEP}${sub.name}` : s.name);
  };

  const cls = "h-11 w-full border border-gray-300 rounded-lg px-3 text-sm font-normal bg-white";
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <label className="flex flex-col gap-1.5 text-sm font-semibold text-gray-900">
        <span>Service{required && <span className="text-red-700"> *</span>}</span>
        <select value={state.svcId} required={required} className={cls}
                onChange={(e) => {
                  const id = e.target.value;
                  const s = catalog.find((x) => String(x.id) === id);
                  const firstSub = s?.subcategories?.length === 1 ? String(s.subcategories[0].id) : "";
                  emit({ svcId: id, subId: firstSub, other: state.other });
                }}>
          <option value="">{catalog.length ? "Choose service" : "Loading services…"}</option>
          {catalog.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          <option value={OTHER}>Other (type it)</option>
        </select>
      </label>
      {state.svcId === OTHER ? (
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-gray-900">
          <span>Service name</span>
          <input value={state.other} required={required} placeholder="Type the service" className={cls}
                 onChange={(e) => emit({ ...state, other: e.target.value })} />
        </label>
      ) : (
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-gray-900">
          <span>Sub-category</span>
          <select value={state.subId} disabled={!svc || subs.length === 0} className={`${cls} disabled:bg-gray-50 disabled:text-gray-500`}
                  onChange={(e) => emit({ ...state, subId: e.target.value })}>
            <option value="">{!svc ? "Choose service first" : subs.length ? "Choose sub-category" : "No sub-categories"}</option>
            {subs.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </label>
      )}
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-semibold text-gray-900">
      <span>{label}{required && <span className="text-red-700"> *</span>}</span>
      {children}
    </label>
  );
}