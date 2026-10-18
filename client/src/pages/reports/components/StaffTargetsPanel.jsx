// src/.../StaffTargetsPanel.jsx  — drop inside StaffPerformanceSection, e.g. above "Quick View: Revenue Breakdown"
//   <StaffTargetsPanel centreId={centreId} />
import React, { useEffect, useState, useCallback } from "react";
import { FiTarget, FiRefreshCw, FiCheckCircle, FiChevronDown, FiChevronUp } from "react-icons/fi";

const formatINR = (v) => Number(v || 0).toLocaleString("en-IN");
const thisMonth = () => new Date().toISOString().slice(0, 7); // YYYY-MM

const authFetch = async (path, params = {}) => {
  const token = localStorage.getItem("token");
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v));
  const res = await fetch(`${import.meta.env.VITE_API_URL}/api/staffreport/${path}?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Request failed");
  return res.json();
};

const barColor = (p) => (p >= 100 ? "bg-emerald-500" : p >= 50 ? "bg-amber-400" : "bg-rose-400");

const StaffTargetsPanel = ({ centreId }) => {
  const [month, setMonth] = useState(thisMonth());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [history, setHistory] = useState({});

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setRows(await authFetch("staff-targets", { month, centreId }));
    } catch (e) {
      console.error(e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [month, centreId]);

  useEffect(() => { load(); }, [load]);

  const toggleHistory = async (staffId) => {
    if (openId === staffId) return setOpenId(null);
    setOpenId(staffId);
    if (!history[staffId]) {
      try {
        const h = await authFetch(`staff/${staffId}/target-history`, { months: 6, centreId });
        setHistory((p) => ({ ...p, [staffId]: h }));
      } catch (e) { console.error(e); }
    }
  };

  const totalTarget = rows.reduce((s, r) => s + Number(r.target_amount), 0);
  const totalAchieved = rows.reduce((s, r) => s + Number(r.achieved_amount), 0);
  const metCount = rows.filter((r) => Number(r.achievement_percent) >= 100).length;

  const renderHistory = (r) => (
    <div className="flex flex-wrap gap-2">
      {(history[r.staff_id] || []).map((h) => (
        <div key={h.month} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs">
          <p className="text-slate-500">{String(h.month).slice(0, 7)}</p>
          <p className="font-semibold text-slate-900">{Number(h.achievement_percent || 0).toFixed(0)}%</p>
          <p className="text-slate-400">₹{formatINR(h.achieved_amount)} / ₹{formatINR(h.target_amount)}</p>
        </div>
      ))}
      {!history[r.staff_id] && <span className="text-xs text-slate-400">Loading…</span>}
    </div>
  );

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4 sm:p-5">
        <div>
          <h3 className="flex items-center font-bold text-slate-900">
            <FiTarget className="mr-2 h-4 w-4 text-navy-700" /> Staff Targets (+10% Growth)
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Target = average of previous 3 months' service charges × 1.10, locked at month start
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input type="month" value={month} max={thisMonth()}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
            aria-label="Month"
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-500/30" />
          <button onClick={load} aria-label="Refresh targets"
            className="flex items-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50">
            <FiRefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 p-4 sm:p-5">
        <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Total Target</p><p className="truncate font-bold text-slate-900">₹{formatINR(totalTarget)}</p></div>
        <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Total Achieved</p><p className="truncate font-bold text-slate-900">₹{formatINR(totalAchieved)}</p></div>
        <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Targets Met</p><p className="font-bold text-slate-900">{metCount} / {rows.length}</p></div>
      </div>

      {/* Mobile cards */}
      <div className="divide-y divide-slate-100 border-t border-slate-100 md:hidden">
        {rows.length === 0 && (
          <p className="py-6 text-center text-sm text-slate-400">{loading ? "Loading…" : "No targets for this month"}</p>
        )}
        {rows.map((r) => {
          const pct = Number(r.achievement_percent || 0);
          return (
            <div key={r.id} className="p-4">
              <button className="w-full text-left" aria-expanded={openId === r.staff_id} onClick={() => toggleHistory(r.staff_id)}>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-slate-900">
                    {r.staff_name}
                    {r.employment_type === "Probation" && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">Trainee</span>}
                  </p>
                  <span className="text-slate-400">{openId === r.staff_id ? <FiChevronUp /> : <FiChevronDown />}</span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-slate-500">
                  <span>Baseline<br /><span className="font-semibold text-slate-700">₹{formatINR(r.baseline_amount)}</span></span>
                  <span>Target<br /><span className="font-semibold text-slate-700">₹{formatINR(r.target_amount)}</span></span>
                  <span>Achieved<br /><span className="font-semibold text-slate-900">₹{formatINR(r.achieved_amount)}</span></span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full ${barColor(pct)}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                  <span className="w-12 text-right text-xs">{pct.toFixed(1)}%</span>
                  {pct >= 100 && <FiCheckCircle className="h-3.5 w-3.5 text-emerald-500" />}
                </div>
              </button>
              {openId === r.staff_id && <div className="mt-3 rounded-xl bg-slate-50 p-3">{renderHistory(r)}</div>}
            </div>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Staff</th>
              <th className="px-4 py-3 text-right font-semibold">Baseline (3-mo avg)</th>
              <th className="px-4 py-3 text-right font-semibold">Target</th>
              <th className="px-4 py-3 text-right font-semibold">Achieved</th>
              <th className="w-48 px-4 py-3 font-semibold">Progress</th>
              <th className="w-8 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} className="py-6 text-center text-slate-400">{loading ? "Loading…" : "No targets for this month"}</td></tr>
            )}
            {rows.map((r) => {
              const pct = Number(r.achievement_percent || 0);
              return (
                <React.Fragment key={r.id}>
                  <tr className="cursor-pointer border-t border-slate-100 transition-colors hover:bg-slate-50" onClick={() => toggleHistory(r.staff_id)}>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {r.staff_name}
                      {r.employment_type === "Probation" && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">Trainee</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">₹{formatINR(r.baseline_amount)}</td>
                    <td className="px-4 py-3 text-right text-slate-800">₹{formatINR(r.target_amount)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">₹{formatINR(r.achieved_amount)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div className={`h-full ${barColor(pct)}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                        <span className="w-12 text-right text-xs">{pct.toFixed(1)}%</span>
                        {pct >= 100 && <FiCheckCircle className="h-3.5 w-3.5 text-emerald-500" />}
                      </div>
                    </td>
                    <td className="px-2 text-slate-400">{openId === r.staff_id ? <FiChevronUp /> : <FiChevronDown />}</td>
                  </tr>
                  {openId === r.staff_id && (
                    <tr className="bg-slate-50">
                      <td colSpan={6} className="px-4 py-3">
                        {renderHistory(r)}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StaffTargetsPanel;