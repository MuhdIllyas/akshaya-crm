import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiChevronLeft, FiChevronRight, FiRefreshCw, FiSearch } from "react-icons/fi";
import { EntryPanel, DeleteEntryDialog, EditedTag } from "./EntryDialogs";
import { rupees, timeOf } from "./entryFormat";
import { todayIST } from "../../utils/dates";

/* Supervisor → Today's entries: the whole centre's day.
   Top: one "collected of total" bar. Staff chips filter the list. Tabs: All /
   To check (charges that look wrong) / Due (money still to collect) / Edited.
   Each row says what is wrong in plain words and has the button for the job.
   Clicking a row opens it in EntryPanel: on the right on wide screens, full
   screen on phones, with charges, payments, collect and the entry's history. */

const API = import.meta.env.VITE_API_URL;
const dayLabel = (ymd) =>
  new Date(`${ymd}T00:00:00+05:30`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" });
const shiftDay = (ymd, n) => {
  const d = new Date(`${ymd}T12:00:00+05:30`);
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
};
const initials = (name) => String(name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

const issueText = (e) =>
  e.check === "swapped"
    ? `Looks swapped: service ${rupees(e.serviceCharge)}, dept ${rupees(e.departmentCharge)} (usually ${rupees(e.usualServiceCharge)} / ${rupees(e.usualDepartmentCharge)})`
    : e.check === "sc_low"
      ? `Service charge ${rupees(e.serviceCharge)}, below the usual ${rupees(e.usualServiceCharge)}`
      : "";

const TABS = [
  { key: "all", label: "All", cls: "text-slate-900" },
  { key: "check", label: "To check", cls: "text-orange-800" },
  { key: "due", label: "Due", cls: "text-amber-800" },
  { key: "edited", label: "Edited", cls: "text-sky-800" },
];
const inTab = (e, tab) =>
  tab === "all" || (tab === "check" && !!e.check) || (tab === "due" && e.pending > 0) || (tab === "edited" && e.edited);

const SupervisorEntries = () => {
  const navigate = useNavigate();
  const [date, setDate] = useState(todayIST());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [staffFilter, setStaffFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState(null);   // entry in the panel
  const [focus, setFocus] = useState(null);     // what the panel focuses: "collect" | "fix" | null
  const [version, setVersion] = useState(0);    // a fresh panel after each reload
  const [deleting, setDeleting] = useState(null);
  const me = Number(localStorage.getItem("id"));

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/api/servicemanagement/supervisor/day?date=${date}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to load the entries");
      setData(body);
      setVersion((v) => v + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setOpenId(null); }, [date]);

  const all = useMemo(() => data?.entries || [], [data]);

  // The day's services (each once, with how many entries), for the service filter
  const services = useMemo(() => {
    const map = new Map();
    for (const e of all) {
      const key = String(e.categoryId);
      const s = map.get(key) || { key, name: e.serviceName || "Service", count: 0 };
      s.count += 1;
      map.set(key, s);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [all]);
  useEffect(() => {
    if (serviceFilter !== "all" && data && !services.some((s) => s.key === serviceFilter)) setServiceFilter("all");
  }, [data, services, serviceFilter]);

  // Everything but the tab, so each tab can show its count
  const base = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((e) =>
      (staffFilter === "all" || String(e.staffId) === staffFilter) &&
      (serviceFilter === "all" || String(e.categoryId) === serviceFilter) &&
      (!q || [e.customerName, e.phone, e.serviceName, e.subcategoryName, String(e.id)].some((v) => String(v || "").toLowerCase().includes(q)))
    );
  }, [all, staffFilter, serviceFilter, search]);
  const entries = base.filter((e) => inTab(e, tab));
  const filtered = staffFilter !== "all" || serviceFilter !== "all" || tab !== "all" || search.trim() !== "";
  const shown = entries.reduce((t, e) => ({ total: t.total + e.totalCharge, pending: t.pending + e.pending }), { total: 0, pending: 0 });

  const open = all.find((e) => e.id === openId) || null;
  const openEntry = (e, f = null) => { setOpenId(e.id); setFocus(f); };
  const closePanel = useCallback(() => setOpenId(null), []);

  // The same override edit the admin uses from Service Logs; the entry stays with its staff member
  const fullEdit = (e) =>
    navigate("/dashboard/staff/service_entry", {
      state: {
        adminEditEntry: {
          serviceEntryId: e.id,
          tokenId: e.tokenId || "",
          customerName: e.customerName,
          phone: e.phone,
          categoryId: e.categoryId,
          subcategoryId: e.subcategoryId,
          serviceCharge: e.serviceCharge,
          departmentCharge: e.departmentCharge,
          totalCharge: e.totalCharge,
          status: e.status,
          expiryDate: e.expiryDate || "",
          serviceWalletId: e.serviceWalletId,
        },
      },
    });

  const t = data?.totals;
  const isToday = date === todayIST();
  const collectedPct = t && t.total > 0 ? Math.min(100, Math.round((t.collected / t.total) * 100)) : 0;
  const staffName = (s) => (Number(s.staffId) === me ? `${s.staffName} (you)` : s.staffName);

  return (
    <div className="space-y-4">
      {/* ===== Day ===== */}
      <section aria-label="Day" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{isToday ? "Today's entries" : "Entries"}</h1>
            <p className="mt-1 text-sm text-slate-600">
              All staff{t ? ` · ${t.entries} ${t.entries === 1 ? "entry" : "entries"}` : ""} · {dayLabel(date)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button type="button" onClick={() => setDate(shiftDay(date, -1))} aria-label="Previous day"
              className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
              <FiChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <label className="relative">
              <span className="sr-only">Day</span>
              <input type="date" value={date} max={todayIST()} onChange={(e) => e.target.value && setDate(e.target.value)}
                className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-500/30" />
            </label>
            <button type="button" onClick={() => setDate(shiftDay(date, 1))} disabled={isToday} aria-label="Next day"
              className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40">
              <FiChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
            {!isToday && (
              <button type="button" onClick={() => setDate(todayIST())} className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-navy-700 hover:bg-slate-50">
                Today
              </button>
            )}
            <button type="button" onClick={load} disabled={loading} aria-label="Refresh"
              className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50">
              <FiRefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
            </button>
          </div>
        </div>

        {error ? (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>
        ) : !t ? (
          <div className="mt-4 h-16 animate-pulse rounded-xl bg-slate-100" aria-busy="true" />
        ) : t.entries === 0 ? (
          <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            {isToday ? "No entries yet today. They show here as staff save them." : "No entries on this day."}
          </p>
        ) : (
          <div className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-4">
            <div className="min-w-0 flex-[2_1_320px]">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm text-slate-600">
                  <strong className="text-2xl font-bold text-slate-900">{rupees(t.collected)}</strong> collected of {rupees(t.total)}
                </span>
                {t.pending > 0 ? (
                  <span className="text-sm font-bold text-amber-700">{rupees(t.pending)} still to collect</span>
                ) : (
                  t.total > 0 && <span className="text-sm font-semibold text-emerald-700">All collected</span>
                )}
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-amber-200" role="img" aria-label={`${collectedPct}% collected`}>
                <div className="h-full rounded-full bg-emerald-600" style={{ width: `${collectedPct}%` }} />
              </div>
            </div>
            <dl className="grid flex-[1_1_240px] grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <div><dt className="text-slate-600">Service charge</dt><dd className="text-lg font-bold text-slate-900">{rupees(t.serviceCharge)}</dd></div>
              <div><dt className="text-slate-600">Department</dt><dd className="text-lg font-bold text-slate-900">{rupees(t.departmentCharge)}</dd></div>
            </dl>
          </div>
        )}
      </section>

      {/* ===== Staff chips ===== */}
      {data?.staff?.length > 0 && (
        <section aria-label="Filter by staff" className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={staffFilter === "all"} onClick={() => setStaffFilter("all")}
            className={`min-h-[44px] rounded-full border px-4 text-sm font-semibold ${staffFilter === "all" ? "border-navy-700 bg-navy-700 text-white" : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"}`}>
            All staff
          </button>
          {data.staff.map((s) => {
            const on = staffFilter === String(s.staffId);
            return (
              <button key={s.staffId} type="button" aria-pressed={on} onClick={() => setStaffFilter(on ? "all" : String(s.staffId))}
                className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border px-3 text-sm ${on ? "border-navy-700 bg-navy-700 text-white" : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"}`}>
                <span className={`grid h-7 w-7 place-items-center rounded-full text-[11px] font-bold ${on ? "bg-white/20 text-white" : "bg-slate-100 text-navy-700"}`} aria-hidden="true">
                  {initials(s.staffName)}
                </span>
                <span className="font-medium">{staffName(s)} · {s.entries}</span>
                {s.pending > 0 ? (
                  <span className={`font-bold ${on ? "text-amber-200" : "text-amber-700"}`}>{rupees(s.pending)} due</span>
                ) : (
                  <span className={on ? "text-emerald-200" : "text-emerald-700"}>all collected</span>
                )}
              </button>
            );
          })}
        </section>
      )}

      <div className={open ? "xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(360px,420px)] xl:items-start xl:gap-4" : ""}>
        {/* ===== Entries ===== */}
        <section aria-labelledby="sv-list-title" className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <h2 id="sv-list-title" className="sr-only">Entries</h2>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 p-3">
            <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1" role="group" aria-label="Show">
              {TABS.map((tb) => {
                const n = base.filter((e) => inTab(e, tb.key)).length;
                const on = tab === tb.key;
                return (
                  <button key={tb.key} type="button" aria-pressed={on} onClick={() => setTab(tb.key)}
                    className={`min-h-[36px] rounded-lg px-3 text-sm ${on ? "bg-white font-semibold text-slate-900 shadow-sm" : `font-medium ${n ? tb.cls : "text-slate-500"} hover:bg-white/60`}`}>
                    {tb.label} {data ? n : ""}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-1 flex-wrap justify-end gap-2">
              <label className="relative min-w-[180px] max-w-[260px] flex-1">
                <span className="sr-only">Search entries</span>
                <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Customer, phone, ID, service"
                  className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-500/30" />
              </label>
              <label className="sr-only" htmlFor="sv-service-filter">Service</label>
              <select id="sv-service-filter" value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)}
                className="min-h-[40px] max-w-[200px] rounded-lg border border-slate-300 bg-white px-3 text-sm focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-500/30">
                <option value="all">All services</option>
                {services.map((s) => <option key={s.key} value={s.key}>{s.name} ({s.count})</option>)}
              </select>
            </div>
          </div>

          {data && filtered && entries.length > 0 && (
            <p className="border-b border-slate-100 px-4 py-2 text-sm text-slate-600" aria-live="polite">
              Shown: {entries.length} {entries.length === 1 ? "entry" : "entries"} · total {rupees(shown.total)}
              {shown.pending > 0 ? ` · ${rupees(shown.pending)} due` : ""}
            </p>
          )}

          {!data ? (
            <div className="m-4 h-40 animate-pulse rounded-xl bg-slate-100" aria-busy="true" />
          ) : entries.length === 0 ? (
            <p className="p-5 text-sm text-slate-600">
              {all.length === 0 ? "No entries on this day." : tab === "check" ? "Nothing to check. The charges look right." : tab === "due" ? "Nothing due. Everything is collected." : "No entries match these filters."}
            </p>
          ) : (
            <ul>
              {entries.map((e) => {
                const isOpen = e.id === openId;
                const issue = issueText(e);
                const tone = isOpen ? "bg-navy-50 shadow-[inset_4px_0_0_var(--color-navy-700)]" : e.check === "swapped" ? "bg-red-50" : e.check ? "bg-amber-50" : "";
                const action = e.check
                  ? { label: "Fix charges", f: "fix", cls: "bg-navy-700 text-white hover:bg-navy-800" }
                  : e.pending > 0
                    ? { label: "Collect", f: "collect", cls: "bg-emerald-700 text-white hover:bg-emerald-800" }
                    : { label: "Open", f: null, cls: "border border-slate-300 bg-white text-navy-700 hover:bg-slate-50" };
                return (
                  <li key={e.id} className={`flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 px-4 py-3 first:border-t-0 ${tone}`}>
                    <span className="hidden w-16 shrink-0 text-sm text-slate-600 sm:block">{timeOf(e.createdAt)}</span>
                    <button type="button" onClick={() => openEntry(e)} aria-current={isOpen ? "true" : undefined}
                      className="min-w-[200px] flex-1 rounded-lg text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-500">
                      <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                        <span className="font-semibold text-slate-900">{e.customerName || "Customer"}</span>
                        <span className="text-sm text-slate-600">· {Number(e.staffId) === me ? `${e.staffName} (you)` : e.staffName}</span>
                        {e.edited && <EditedTag e={e} />}
                      </span>
                      <span className="block text-sm text-slate-600"><span className="sm:hidden">{timeOf(e.createdAt)} · </span>{e.serviceName}{e.subcategoryName ? ` · ${e.subcategoryName}` : ""} · ID {e.id}</span>
                      {issue && <span className={`mt-0.5 block text-sm font-semibold ${e.check === "swapped" ? "text-red-800" : "text-amber-800"}`}>{issue}</span>}
                    </button>
                    <span className="ml-auto w-20 text-right sm:ml-0">
                      <span className="block font-bold text-slate-900">{rupees(e.totalCharge)}</span>
                      {!open && <span className="block whitespace-nowrap text-xs text-slate-500">SC {rupees(e.serviceCharge)} · Dept {rupees(e.departmentCharge)}</span>}
                    </span>
                    <span className="w-[5.5rem] text-center">
                      {e.pending > 0 ? (
                        <span className="inline-block whitespace-nowrap rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-800 ring-1 ring-amber-200">{rupees(e.pending)} due</span>
                      ) : (
                        <span className="inline-block rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800">Paid</span>
                      )}
                    </span>
                    <button type="button" onClick={() => openEntry(e, action.f)} aria-label={`${action.label}: entry ${e.id}, ${e.customerName || "customer"}`}
                      className={`min-h-[40px] shrink-0 rounded-lg px-3 text-sm font-semibold ${action.cls}`}>
                      {action.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {open && (
          <EntryPanel
            key={`${open.id}-${version}`}
            entry={open}
            day={date}
            focus={focus}
            onClose={closePanel}
            onSaved={() => { setFocus(null); load(); }}
            onFullEdit={() => fullEdit(open)}
            onDelete={Number(open.staffId) !== me ? () => setDeleting(open) : null}
          />
        )}
      </div>

      {data && !data.chargeCheck && (
        <p className="text-sm text-slate-500">The charge check is off: this centre has no service charges set up to compare with.</p>
      )}

      {deleting && (
        <DeleteEntryDialog
          entry={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => { setDeleting(null); setOpenId(null); load(); }}
        />
      )}
    </div>
  );
};

export default SupervisorEntries;
