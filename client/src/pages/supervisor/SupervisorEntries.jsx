import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiAlertTriangle, FiCheck, FiEdit3, FiRefreshCw, FiSearch } from "react-icons/fi";
import { todayIST } from "../../utils/dates";

/* Supervisor → Today's entries: one view of the day for the whole centre.
   Day totals, entries whose charges don't match the service's usual charges
   (a service charge and department fee entered the wrong way round shows up
   as "Swapped?"), each staff member's collection for the day, and the full
   list with an Edit button (the same override edit the admin has). */

const API = import.meta.env.VITE_API_URL;
const rupees = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const timeOf = (d) => new Date(d).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
const dayLabel = (ymd) =>
  new Date(`${ymd}T00:00:00+05:30`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" });

const CHECK = {
  swapped: { label: "Swapped?", cls: "bg-red-50 text-red-800 ring-1 ring-red-200", row: "bg-red-50" },
  sc_differs: { label: "Different from usual", cls: "bg-amber-50 text-amber-900 ring-1 ring-amber-200", row: "bg-amber-50" },
};

const checkText = (e) =>
  e.check === "swapped"
    ? `service charge ${rupees(e.serviceCharge)}, department ${rupees(e.departmentCharge)}. Usually service ${rupees(e.usualServiceCharge)}, department ${rupees(e.usualDepartmentCharge)}.`
    : `service charge ${rupees(e.serviceCharge)}. Usually ${rupees(e.usualServiceCharge)}.`;

const Stat = ({ label, value, tone = "bg-slate-50", labelCls = "text-slate-500" }) => (
  <div className={`rounded-xl p-3 ${tone}`}>
    <div className={`text-xs ${labelCls}`}>{label}</div>
    <div className="text-xl font-bold text-slate-900 sm:text-2xl">{value}</div>
  </div>
);

const SupervisorEntries = () => {
  const navigate = useNavigate();
  const [date, setDate] = useState(todayIST());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [staffFilter, setStaffFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [onlyChecks, setOnlyChecks] = useState(false);
  const [search, setSearch] = useState("");

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
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { load(); }, [load]);

  // The day's services (each once, with how many entries), for the service filter
  const services = useMemo(() => {
    const map = new Map();
    for (const e of data?.entries || []) {
      const key = String(e.categoryId);
      const s = map.get(key) || { key, name: e.serviceName || "Service", count: 0 };
      s.count += 1;
      map.set(key, s);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);
  // A day without the picked service: show all again
  useEffect(() => {
    if (serviceFilter !== "all" && data && !services.some((s) => s.key === serviceFilter)) setServiceFilter("all");
  }, [data, services, serviceFilter]);

  const entries = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.entries || []).filter((e) =>
      (staffFilter === "all" || String(e.staffId) === staffFilter) &&
      (serviceFilter === "all" || String(e.categoryId) === serviceFilter) &&
      (!onlyChecks || e.check) &&
      (!q || [e.customerName, e.phone, e.serviceName, e.subcategoryName, String(e.id)].some((v) => String(v || "").toLowerCase().includes(q)))
    );
  }, [data, staffFilter, serviceFilter, onlyChecks, search]);
  const filtered = staffFilter !== "all" || serviceFilter !== "all" || onlyChecks || search.trim() !== "";
  const shown = entries.reduce((t, e) => ({
    sc: t.sc + e.serviceCharge, dept: t.dept + e.departmentCharge, total: t.total + e.totalCharge, pending: t.pending + e.pending,
  }), { sc: 0, dept: 0, total: 0, pending: 0 });
  const toCheck = (data?.entries || []).filter((e) => e.check);

  // The same override edit the admin uses from Service Logs; the entry stays with its staff member
  const edit = (e) =>
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

  return (
    <div className="space-y-5">
      {/* ===== Day ===== */}
      <section aria-label="Day" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{isToday ? "Today's entries" : "Entries"}</h1>
            <p className="mt-1 text-sm text-slate-500">All staff · {dayLabel(date)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              Day
              <input
                type="date"
                value={date}
                max={todayIST()}
                onChange={(e) => e.target.value && setDate(e.target.value)}
                className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-sm focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-500/30"
              />
            </label>
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
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6" aria-busy={loading && !data}>
            <Stat label="Entries" value={t ? t.entries : "–"} />
            <Stat label="Service charge" value={t ? rupees(t.serviceCharge) : "–"} />
            <Stat label="Department" value={t ? rupees(t.departmentCharge) : "–"} />
            <Stat label="Total" value={t ? rupees(t.total) : "–"} />
            <Stat label="Collected" value={t ? rupees(t.collected) : "–"} tone="bg-emerald-50" labelCls="text-emerald-700" />
            <Stat label="Pending" value={t ? rupees(t.pending) : "–"} tone={t?.pending ? "bg-amber-50" : "bg-slate-50"} labelCls={t?.pending ? "text-amber-800" : "text-slate-500"} />
          </div>
        )}
      </section>

      {/* ===== Needs a look ===== */}
      {data && toCheck.length > 0 && (
        <section aria-labelledby="sv-check-title" className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="sv-check-title" className="flex items-center gap-2 text-lg font-bold text-amber-900">
              <FiAlertTriangle className="h-5 w-5" aria-hidden="true" />
              {toCheck.length} {toCheck.length === 1 ? "entry needs" : "entries need"} a look
            </h2>
            <span className="text-sm text-amber-800">Compared with the charges set for each service at this centre</span>
          </div>
          <ul className="flex flex-col gap-2">
            {toCheck.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-white p-3">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${CHECK[e.check].cls}`}>{CHECK[e.check].label}</span>
                <span className="min-w-[240px] flex-1 text-sm text-slate-700">
                  <strong className="font-semibold text-slate-900">{e.serviceName}{e.subcategoryName ? ` · ${e.subcategoryName}` : ""}</strong>{" "}
                  by {e.staffName} at {timeOf(e.createdAt)}: {checkText(e)}
                </span>
                <button type="button" onClick={() => edit(e)} className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-navy-700 hover:bg-slate-50">
                  <FiEdit3 className="h-4 w-4" aria-hidden="true" /> Edit
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {data && !data.chargeCheck && (
        <p className="text-sm text-slate-500">The charge check is off: this centre has no service charges set up to compare with.</p>
      )}

      {/* ===== Staff collection ===== */}
      <section aria-labelledby="sv-staff-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="sv-staff-title" className="text-lg font-bold text-slate-900">Staff collection {isToday ? "today" : ""}</h2>
          <span className="text-sm text-slate-500">Pick a row to show only that staff member's entries</span>
        </div>
        {!data ? (
          <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
        ) : data.staff.length === 0 ? (
          <p className="text-sm text-slate-600">No entries on this day.</p>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2 font-semibold">Staff</th>
                  <th className="px-3 py-2 text-right font-semibold">Entries</th>
                  <th className="px-3 py-2 text-right font-semibold">Service</th>
                  <th className="px-3 py-2 text-right font-semibold">Dept</th>
                  <th className="px-3 py-2 text-right font-semibold">Total</th>
                  <th className="px-3 py-2 text-right font-semibold">Collected</th>
                  <th className="px-3 py-2 text-right font-semibold">Pending</th>
                  <th className="px-3 py-2 font-semibold">Check</th>
                </tr>
              </thead>
              <tbody>
                {data.staff.map((s) => {
                  const picked = staffFilter === String(s.staffId);
                  return (
                    <tr key={s.staffId}
                      className={`cursor-pointer border-t border-slate-100 hover:bg-slate-50 ${picked ? "bg-navy-50" : s.swapped ? "bg-red-50" : s.checks ? "bg-amber-50" : ""}`}
                      onClick={() => setStaffFilter(picked ? "all" : String(s.staffId))}>
                      <td className="px-3 py-3">
                        <button type="button" aria-pressed={picked} className="font-semibold text-slate-900 hover:underline"
                          onClick={(ev) => { ev.stopPropagation(); setStaffFilter(picked ? "all" : String(s.staffId)); }}>
                          {s.staffName}
                        </button>
                      </td>
                      <td className="px-3 py-3 text-right">{s.entries}</td>
                      <td className="px-3 py-3 text-right">{rupees(s.serviceCharge)}</td>
                      <td className="px-3 py-3 text-right">{rupees(s.departmentCharge)}</td>
                      <td className="px-3 py-3 text-right">{rupees(s.total)}</td>
                      <td className="px-3 py-3 text-right font-semibold text-emerald-700">{rupees(s.collected)}</td>
                      <td className={`px-3 py-3 text-right ${s.pending ? "font-bold text-amber-700" : "text-slate-400"}`}>{s.pending ? rupees(s.pending) : "–"}</td>
                      <td className="px-3 py-3">
                        {s.swapped ? (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${CHECK.swapped.cls}`}>{s.swapped} swapped?</span>
                        ) : s.checks ? (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${CHECK.sc_differs.cls}`}>{s.checks} to check</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-emerald-700"><FiCheck className="h-4 w-4" aria-hidden="true" /> OK</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ===== Entries ===== */}
      <section aria-labelledby="sv-list-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="sv-list-title" className="text-lg font-bold text-slate-900">Entries {data ? `· ${entries.length}` : ""}</h2>
            {data && filtered && entries.length > 0 && (
              <p className="mt-0.5 text-sm text-slate-600" aria-live="polite">
                Shown: service {rupees(shown.sc)} · dept {rupees(shown.dept)} · total {rupees(shown.total)}
                {shown.pending > 0 ? ` · ${rupees(shown.pending)} pending` : ""}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative">
              <span className="sr-only">Search entries</span>
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Customer, phone or service"
                className="min-h-[40px] w-60 rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-500/30" />
            </label>
            <label className="sr-only" htmlFor="sv-staff-filter">Staff</label>
            <select id="sv-staff-filter" value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)}
              className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 text-sm focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-500/30">
              <option value="all">All staff</option>
              {(data?.staff || []).map((s) => <option key={s.staffId} value={String(s.staffId)}>{s.staffName}</option>)}
            </select>
            <label className="sr-only" htmlFor="sv-service-filter">Service</label>
            <select id="sv-service-filter" value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)}
              className="min-h-[40px] max-w-[220px] rounded-lg border border-slate-300 bg-white px-3 text-sm focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-500/30">
              <option value="all">All services</option>
              {services.map((s) => <option key={s.key} value={s.key}>{s.name} ({s.count})</option>)}
            </select>
            <label className="inline-flex min-h-[40px] items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={onlyChecks} onChange={(e) => setOnlyChecks(e.target.checked)} className="h-4 w-4" />
              Only to check
            </label>
          </div>
        </div>
        {!data ? (
          <div className="h-40 animate-pulse rounded-xl bg-slate-100" aria-busy="true" />
        ) : entries.length === 0 ? (
          <p className="text-sm text-slate-600">{data.entries.length ? "No entries match these filters." : "No entries on this day."}</p>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2 font-semibold">Time</th>
                  <th className="px-3 py-2 font-semibold">Customer</th>
                  <th className="px-3 py-2 font-semibold">Service</th>
                  <th className="px-3 py-2 font-semibold">Staff</th>
                  <th className="px-3 py-2 text-right font-semibold">Service</th>
                  <th className="px-3 py-2 text-right font-semibold">Dept</th>
                  <th className="px-3 py-2 text-right font-semibold">Paid</th>
                  <th className="px-3 py-2 font-semibold">Check</th>
                  <th className="px-3 py-2"><span className="sr-only">Action</span></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className={`border-t border-slate-100 ${e.check ? CHECK[e.check].row : ""}`}>
                    <td className="whitespace-nowrap px-3 py-3 text-slate-600">{timeOf(e.createdAt)}</td>
                    <td className="px-3 py-3">
                      <div className="font-medium text-slate-900">{e.customerName || "Customer"}</div>
                      <div className="text-xs text-slate-500">ID {e.id}{e.phone ? ` · ${e.phone}` : ""}</div>
                    </td>
                    <td className="px-3 py-3">{e.serviceName}{e.subcategoryName ? ` · ${e.subcategoryName}` : ""}</td>
                    <td className="px-3 py-3">{e.staffName}</td>
                    <td className={`px-3 py-3 text-right ${e.check ? "font-bold text-red-800" : ""}`}>{rupees(e.serviceCharge)}</td>
                    <td className={`px-3 py-3 text-right ${e.check === "swapped" ? "font-bold text-red-800" : ""}`}>{rupees(e.departmentCharge)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right">
                      {e.pending ? (
                        <span className="font-semibold text-amber-700">{rupees(e.received)} · {rupees(e.pending)} due</span>
                      ) : (
                        rupees(e.received)
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {e.check ? (
                        <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold ${CHECK[e.check].cls}`}
                          title={checkText(e)}>
                          {e.check === "sc_differs" ? `Usually ${rupees(e.usualServiceCharge)}` : CHECK[e.check].label}
                        </span>
                      ) : (
                        <FiCheck className="h-4 w-4 text-emerald-600" aria-label="OK" />
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button type="button" onClick={() => edit(e)} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 font-semibold text-navy-700 hover:bg-slate-50">
                        <FiEdit3 className="h-4 w-4" aria-hidden="true" /> Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default SupervisorEntries;
