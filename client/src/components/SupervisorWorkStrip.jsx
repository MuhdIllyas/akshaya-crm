import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FiArrowRight, FiShield } from "react-icons/fi";
import { fetchCloseTime, isEvening, to12h } from "../utils/supervisorHome";

/* Shown inside the welcome banner of a supervisor's My Work page: a way back
   to the centre accounts dashboard, and a nudge once the evening close starts. */
const SupervisorWorkStrip = () => {
  const [closeTime, setCloseTime] = useState(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    fetchCloseTime().then(setCloseTime);
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const evening = closeTime && isEvening(closeTime, now);

  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl bg-white/10 p-3 ring-1 ring-white/20">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold tracking-wide text-amber-900 ring-1 ring-amber-200">
        <FiShield className="h-3.5 w-3.5" aria-hidden="true" /> SUPERVISOR
      </span>
      <span className="text-sm text-white/90">
        {!closeTime
          ? "Centre accounts"
          : evening
            ? "It's evening close time: the centre accounts are waiting."
            : `Your work first. Evening close from ${to12h(closeTime)}.`}
      </span>
      <Link
        to="/dashboard/supervisor"
        className={`ml-auto inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-3 text-sm font-semibold ${
          evening ? "bg-white text-navy-700 hover:bg-slate-100" : "bg-white/15 text-white hover:bg-white/25"
        }`}
      >
        Centre accounts <FiArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </div>
  );
};

export default SupervisorWorkStrip;
