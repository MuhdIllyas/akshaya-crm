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
    <div className="bg-white rounded-lg border border-gray-200 mb-6">
      <div className="p-4 flex items-center justify-between border-b border-gray-100">
        <div>
          <h3 className="font-bold text-gray-900">Target History</h3>
          <p className="text-xs text-gray-500 mt-1">✓ achieved (≥100%) · ✗ missed · — no target that month</p>
        </div>
        <select value={months} onChange={(e) => setMonths(Number(e.target.value))}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          {[6, 12, 24].map((n) => <option key={n} value={n}>Last {n} months</option>)}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left px-4 py-2 sticky left-0 bg-gray-50">Staff</th>
              {monthKeys.map((k) => <th key={k} className="px-2 py-2 text-center whitespace-nowrap">{monthLabel(k)}</th>)}
              <th className="px-3 py-2 text-center">Met</th>
            </tr>
          </thead>
          <tbody>
            {staff.length === 0 && (
              <tr><td colSpan={monthKeys.length + 2} className="text-center text-gray-400 py-6">{loading ? "Loading…" : "No data"}</td></tr>
            )}
            {staff.map((s) => {
              const withTarget = Object.values(s.cells).filter((c) => Number(c.target_amount) > 0 && c.status === "closed");
              const met = withTarget.filter((c) => Number(c.achievement_percent) >= 100).length;
              return (
                <tr key={s.id} className="border-t border-gray-100">
                  <td className="px-4 py-2 font-medium text-gray-900 sticky left-0 bg-white">{s.name}</td>
                  {monthKeys.map((k) => {
                    const c = s.cells[k];
                    if (!c || !(Number(c.target_amount) > 0))
                      return <td key={k} className="px-2 py-2 text-center text-gray-300">—</td>;
                    const pct = Number(c.achievement_percent || 0);
                    const open = c.status === "active";
                    const cls = open ? "bg-blue-50 text-blue-700" : pct >= 100 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700";
                    return (
                      <td key={k} className="px-1 py-1 text-center"
                        title={`Target ₹${formatINR(c.target_amount)} · Achieved ₹${formatINR(c.achieved_amount)}${c.source === "backfill" ? " · reconstructed" : ""}`}>
                        <div className={`rounded px-1.5 py-1 ${cls}`}>
                          <div className="flex items-center justify-center">
                            {open ? <FiClock className="h-3 w-3" /> : pct >= 100 ? <FiCheck className="h-3 w-3" /> : <FiX className="h-3 w-3" />}
                          </div>
                          <div className="font-semibold">{pct.toFixed(0)}%</div>
                        </div>
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-center font-semibold">{met}/{withTarget.length}</td>
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