//for superadmin dashboard - centre closing logs from all centres
import { useEffect, useState } from "react";
import axios from "axios";
import { FiCheckCircle, FiAlertCircle, FiXCircle, FiLoader } from "react-icons/fi";

// Adjust the path if your accounting router is mounted somewhere else
const CLOSING_ENDPOINT = `${import.meta.env.VITE_API_URL}/api/accounting/nightly-close/all`;

const inr = (n) => `₹${Math.abs(Number(n || 0)).toLocaleString("en-IN")}`;

const todayIST = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

const getStatusView = (row) => {
  if (row.status === "not_closed") {
    return {
      Icon: FiXCircle,
      label: "Not closed",
      detail: "No closing submitted",
      wrap: "bg-rose-50 border-rose-200",
      text: "text-rose-700",
    };
  }
  if (row.status === "incomplete") {
    return {
      Icon: FiAlertCircle,
      label: "Not fully closed",
      detail: `Cash counted (${inr(row.actual_cash)}), closing not completed`,
      wrap: "bg-amber-50 border-amber-200",
      text: "text-amber-700",
    };
  }
  const variance = Number(row.cash_variance || 0);
  if (variance === 0) {
    return {
      Icon: FiCheckCircle,
      label: "Closed",
      detail: `Cash ${inr(row.actual_cash)} • no variance`,
      wrap: "bg-emerald-50 border-emerald-200",
      text: "text-emerald-700",
    };
  }
  return {
    Icon: FiAlertCircle,
    label: "Closed with variance",
    detail: `Cash ${inr(row.actual_cash)} • ${inr(variance)} ${variance < 0 ? "short" : "over"}`,
    wrap: "bg-rose-50 border-rose-200",
    text: "text-rose-700",
  };
};

const CentreClosingLog = () => {
  const [date, setDate] = useState(""); // empty = backend default (yesterday, IST)
  const [data, setData] = useState({ date: "", rows: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(false);

    axios
      .get(CLOSING_ENDPOINT, {
        params: date ? { date } : {},
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        signal: controller.signal,
      })
      .then((res) => {
        setData(res.data);
        setLoading(false);
      })
      .catch((err) => {
        if (axios.isCancel(err)) return;
        console.error("Closing log error:", err);
        setError(true);
        setLoading(false);
      });

    return () => controller.abort();
  }, [date]);

  const total = data.rows.length;
  const closedCount = data.rows.filter((r) => r.status === "closed").length;

  return (
    <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
      <div className="flex items-start justify-between mb-4 gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-700 flex items-center">
            <span className="mr-2">📒</span> Accounting Closing Log
          </h2>
          {!loading && !error && (
            <p className="text-xs text-gray-500 mt-1">
              {closedCount} of {total} centres closed
            </p>
          )}
        </div>
        <input
          type="date"
          value={date || data.date || ""}
          max={todayIST()}
          onChange={(e) => setDate(e.target.value)}
          className="border border-gray-300 rounded-lg px-2 py-1 text-xs text-gray-700"
          aria-label="Accounting date"
        />
      </div>

      <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
        {loading ? (
          <div className="flex justify-center py-8">
            <FiLoader className="animate-spin h-6 w-6 text-indigo-600" />
          </div>
        ) : error ? (
          <div className="text-sm text-rose-600 p-4 text-center bg-rose-50 rounded-lg">
            Could not load closing log.
          </div>
        ) : total === 0 ? (
          <div className="text-gray-500 text-sm italic p-4 text-center bg-gray-50 rounded-lg">
            No centres found.
          </div>
        ) : (
          data.rows.map((row) => {
            const v = getStatusView(row);
            return (
              <div
                key={row.centre_id}
                className={`p-3 rounded-lg border flex items-start space-x-3 ${v.wrap}`}
              >
                <v.Icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${v.text}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {row.centre_name}
                    </p>
                    <span className={`text-xs font-medium whitespace-nowrap ${v.text}`}>
                      {v.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5">{v.detail}</p>
                  {row.status === "closed" && row.closed_at && (
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Closed {new Date(row.closed_at).toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {row.closed_by_name ? ` by ${row.closed_by_name}` : ""}
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default CentreClosingLog;