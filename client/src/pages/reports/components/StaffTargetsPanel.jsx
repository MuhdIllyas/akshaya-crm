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

  return (
    <div className="bg-white rounded-lg border border-gray-200 mb-6">
      <div className="p-4 flex flex-wrap items-center justify-between gap-3 border-b border-gray-100">
        <div>
          <h3 className="font-bold text-gray-900 flex items-center">
            <FiTarget className="h-4 w-4 mr-2 text-indigo-600" /> Staff Targets (+10% Growth)
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Target = average of previous 3 months' service charges × 1.10, locked at month start
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input type="month" value={month} max={thisMonth()}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          <button onClick={load}
            className="flex items-center px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
            <FiRefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 p-4">
        <div><p className="text-xs text-gray-500">Total Target</p><p className="font-bold">₹{formatINR(totalTarget)}</p></div>
        <div><p className="text-xs text-gray-500">Total Achieved</p><p className="font-bold">₹{formatINR(totalAchieved)}</p></div>
        <div><p className="text-xs text-gray-500">Targets Met</p><p className="font-bold">{metCount} / {rows.length}</p></div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-600">
            <tr>
              <th className="text-left px-4 py-2">Staff</th>
              <th className="text-right px-4 py-2">Baseline (3-mo avg)</th>
              <th className="text-right px-4 py-2">Target</th>
              <th className="text-right px-4 py-2">Achieved</th>
              <th className="px-4 py-2 w-48">Progress</th>
              <th className="px-4 py-2 w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} className="text-center text-gray-400 py-6">{loading ? "Loading…" : "No targets for this month"}</td></tr>
            )}
            {rows.map((r) => {
              const pct = Number(r.achievement_percent || 0);
              return (
                <React.Fragment key={r.id}>
                  <tr className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => toggleHistory(r.staff_id)}>
                    <td className="px-4 py-2 font-medium text-gray-900">
                      {r.staff_name}
                      {r.employment_type === "Probation" && <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 rounded px-1.5 py-0.5">Trainee</span>}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-600">₹{formatINR(r.baseline_amount)}</td>
                    <td className="px-4 py-2 text-right">₹{formatINR(r.target_amount)}</td>
                    <td className="px-4 py-2 text-right font-semibold">₹{formatINR(r.achieved_amount)}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full ${barColor(pct)}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                        <span className="text-xs w-12 text-right">{pct.toFixed(1)}%</span>
                        {pct >= 100 && <FiCheckCircle className="h-3.5 w-3.5 text-emerald-500" />}
                      </div>
                    </td>
                    <td className="px-2">{openId === r.staff_id ? <FiChevronUp /> : <FiChevronDown />}</td>
                  </tr>
                  {openId === r.staff_id && (
                    <tr className="bg-gray-50">
                      <td colSpan={6} className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {(history[r.staff_id] || []).map((h) => (
                            <div key={h.month} className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs">
                              <p className="text-gray-500">{String(h.month).slice(0, 7)}</p>
                              <p className="font-semibold">{Number(h.achievement_percent || 0).toFixed(0)}%</p>
                              <p className="text-gray-400">₹{formatINR(h.achieved_amount)} / ₹{formatINR(h.target_amount)}</p>
                            </div>
                          ))}
                          {!history[r.staff_id] && <span className="text-xs text-gray-400">Loading…</span>}
                        </div>
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