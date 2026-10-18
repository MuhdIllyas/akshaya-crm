// Past target results: staff × month grid.  <StaffTargetHistory centreId={centreId} />
import React, { useEffect, useMemo, useState } from "react";
import { FiCheck, FiX, FiClock } from "react-icons/fi";

const formatINR = (v) => Number(v || 0).toLocaleString("en-IN");
const monthLabel = (m) =>
  new Date(`${String(m).slice(0, 7)}-01T00:00:00`).toLocaleString("en-IN", { month: "short", year: "2-digit" });

const StaffTargetHistory = ({ centreId }) => {
  const [months, setMonths] = useState(12);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("token");
        const qs = new URLSearchParams({ months });
        if (centreId) qs.append("centreId", centreId);
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/staffreport/staff-targets/history?${qs}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setRows(res.ok ? await res.json() : []);
      } catch (e) { console.error(e); setRows([]); }
      finally { setLoading(false); }
    })();
  }, [months, centreId]);

  const { monthKeys, staff } = useMemo(() => {
    const keys = [...new Set(rows.map((r) => String(r.month).slice(0, 7)))].sort();
    const map = new Map();
    rows.forEach((r) => {
      if (!map.has(r.staff_id)) map.set(r.staff_id, { id: r.staff_id, name: r.staff_name, cells: {} });
      map.get(r.staff_id).cells[String(r.month).slice(0, 7)] = r;
    });
    return { monthKeys: keys, staff: [...map.values()] };
  }, [rows]);

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4 sm:p-5">
        <div>
          <h3 className="font-bold text-slate-900">Target History</h3>
          <p className="mt-1 text-xs text-slate-500">✓ achieved (≥100%) · ✗ missed · — no target that month</p>
        </div>
        <select value={months} onChange={(e) => setMonths(Number(e.target.value))}
          aria-label="History range"
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-500/30">
          {[6, 12, 24].map((n) => <option key={n} value={n}>Last {n} months</option>)}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="sticky left-0 bg-slate-50 px-4 py-3 text-left font-semibold uppercase tracking-wider">Staff</th>
              {monthKeys.map((k) => <th key={k} className="whitespace-nowrap px-2 py-3 text-center font-semibold">{monthLabel(k)}</th>)}
              <th className="px-3 py-3 text-center font-semibold">Met</th>
            </tr>
          </thead>
          <tbody>
            {staff.length === 0 && (
              <tr><td colSpan={monthKeys.length + 2} className="py-6 text-center text-slate-400">{loading ? "Loading…" : "No data"}</td></tr>
            )}
            {staff.map((s) => {
              const withTarget = Object.values(s.cells).filter((c) => Number(c.target_amount) > 0 && c.status === "closed");
              const met = withTarget.filter((c) => Number(c.achievement_percent) >= 100).length;
              return (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="sticky left-0 whitespace-nowrap bg-white px-4 py-2 font-medium text-slate-900">{s.name}</td>
                  {monthKeys.map((k) => {
                    const c = s.cells[k];
                    if (!c || !(Number(c.target_amount) > 0))
                      return <td key={k} className="px-2 py-2 text-center text-slate-300">—</td>;
                    const pct = Number(c.achievement_percent || 0);
                    const open = c.status === "active";
                    const cls = open ? "bg-blue-50 text-blue-700" : pct >= 100 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700";
                    return (
                      <td key={k} className="px-1 py-1 text-center"
                        title={`Target ₹${formatINR(c.target_amount)} · Achieved ₹${formatINR(c.achieved_amount)}${c.source === "backfill" ? " · reconstructed" : ""}`}>
                        <div className={`rounded-lg px-1.5 py-1 ${cls}`}>
                          <div className="flex items-center justify-center">
                            {open ? <FiClock className="h-3 w-3" /> : pct >= 100 ? <FiCheck className="h-3 w-3" /> : <FiX className="h-3 w-3" />}
                          </div>
                          <div className="font-semibold">{pct.toFixed(0)}%</div>
                        </div>
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-center font-semibold text-slate-900">{met}/{withTarget.length}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StaffTargetHistory;