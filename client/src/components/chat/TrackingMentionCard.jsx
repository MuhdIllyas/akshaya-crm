import React, { useEffect, useState } from "react";
import axios from "axios";
import { FiFile, FiBriefcase, FiUser, FiChevronRight } from "react-icons/fi";

const API_BASE_URL = import.meta.env.VITE_API_URL;

/* ══════════════════════════════════════════════════════════════
   Tracking mention card (@284)
   ══════════════════════════════════════════════════════════════ */

export const TrackingMentionCard = ({ entityId, displayText }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    axios
      .get(`${API_BASE_URL}/api/chat/mentions/tracking/${entityId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      })
      .then((res) => { if (isMounted) setData(res.data); })
      .catch((err) => console.error(err))
      .finally(() => { if (isMounted) setLoading(false); });
    return () => { isMounted = false; };
  }, [entityId]);

  if (loading) return <span className="font-medium opacity-70 animate-pulse">{displayText}</span>;
  if (!data) return <span className="font-medium line-through opacity-70" title="Tracking not found">{displayText}</span>;

  const priorityCls =
    data.priority === "High"
      ? "bg-rose-50 text-rose-600 ring-rose-200"
      : data.priority === "Medium"
      ? "bg-amber-50 text-amber-600 ring-amber-200"
      : "bg-emerald-50 text-emerald-600 ring-emerald-200";

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        window.open(`/dashboard/staff/track_service/${data.tracking_id || entityId}`, "_blank");
      }}
      className="block w-72 max-w-full bg-white text-slate-800 rounded-xl shadow-sm ring-1 ring-slate-200 hover:ring-blue-300 transition cursor-pointer text-left overflow-hidden select-none"
    >
      <div className="px-3 py-2 flex items-center justify-between border-b border-slate-100">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-navy-700">
          <FiFile size={12} /> App #{data.application_number || data.tracking_id || entityId}
        </span>
        <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ring-1 ${priorityCls}`}>
          {data.priority || "Normal"}
        </span>
      </div>
      <div className="p-3 space-y-2">
        <p className="flex items-start gap-2 text-sm font-semibold leading-tight">
          <FiBriefcase className="text-slate-400 mt-0.5 shrink-0" size={13} />
          {data.service_name || "Unknown Service"}
        </p>
        <p className="flex items-center gap-2 text-[13px] text-slate-600 truncate">
          <FiUser className="text-slate-400 shrink-0" size={13} />
          {data.customer_name || "No customer attached"}
        </p>
        <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
          <div>
            <p className="text-slate-400">Status</p>
            <p className="font-semibold capitalize truncate">{data.status || "Pending"}</p>
          </div>
          <div>
            <p className="text-slate-400">Step</p>
            <p className="font-semibold text-navy-700 truncate" title={data.current_step}>{data.current_step || "Initial phase"}</p>
          </div>
          {data.estimated_delivery && (
            <div>
              <p className="text-slate-400">Delivery</p>
              <p className="font-semibold truncate">{data.estimated_delivery}</p>
            </div>
          )}
          <div>
            <p className="text-slate-400">Assigned</p>
            <p className="font-semibold truncate">{data.assigned_to || "Unassigned"}</p>
          </div>
        </div>
      </div>
      <div className="px-3 py-2 border-t border-slate-100 flex justify-end">
        <span className="text-xs font-medium text-navy-700 flex items-center gap-0.5">
          Open <FiChevronRight size={12} />
        </span>
      </div>
    </div>
  );
};

export default TrackingMentionCard;
