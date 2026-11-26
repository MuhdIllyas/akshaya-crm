import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { FiClock, FiSave } from "react-icons/fi";

/* Admin Settings → Supervisor: the centre's evening time. Before it a
   supervisor's home opens on their own work (tokens, online queue); from it
   on the centre accounts dashboard for the evening close. */

const API = import.meta.env.VITE_API_URL;
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}`, "Content-Type": "application/json" });
const to12h = (hhmm) => {
  const [h, m] = String(hhmm || "18:00").split(":").map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
};

const SupervisorCloseTimeSettings = () => {
  const [saved, setSaved] = useState(null);
  const [value, setValue] = useState("18:00");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API}/api/org-settings/supervisor-close-time`, { headers: headers() })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d) => { setSaved(d); setValue(d.close_time); })
      .catch(() => toast.error("Failed to load the evening time"));
  }, []);

  const save = async () => {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
      setError("Pick a time");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch(`${API}/api/org-settings/supervisor-close-time`, {
        method: "PUT", headers: headers(), body: JSON.stringify({ close_time: value }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed to save");
      setSaved(d);
      toast.success(`Evening close set to ${to12h(d.close_time)}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h2 className="mb-2 text-2xl font-bold text-slate-900">Supervisor</h2>
      <p className="mb-6 text-sm text-slate-600">
        A supervisor does staff work during the day and the centre's accounts in the evening. Before this time their
        home page opens on <strong className="font-semibold">My Work</strong> (tokens and online queue); from this time it
        opens on the <strong className="font-semibold">centre accounts dashboard</strong> for the evening close. They can switch any time.
      </p>
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <label htmlFor="sv-close-time" className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <FiClock className="h-4 w-4 text-amber-700" aria-hidden="true" /> Evening close starts at
        </label>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            id="sv-close-time"
            type="time"
            value={value}
            onChange={(e) => { setValue(e.target.value); setError(""); }}
            aria-invalid={!!error}
            aria-describedby={error ? "sv-close-time-error" : undefined}
            className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-base focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-500/30"
          />
          <button
            type="button"
            onClick={save}
            disabled={saving || !saved || value === saved.close_time && !saved.is_default}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-navy-700 px-4 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-50"
          >
            <FiSave className="h-4 w-4" aria-hidden="true" /> {saving ? "Saving…" : "Save"}
          </button>
        </div>
        {error && <p id="sv-close-time-error" className="mt-2 text-sm text-red-700">{error}</p>}
        <p className="mt-3 text-sm text-slate-500">
          {saved ? (saved.is_default ? `Not set yet, so 6:00 PM is used.` : `Saved: ${to12h(saved.close_time)}.`) : "Loading…"}
        </p>
      </div>
    </div>
  );
};

export default SupervisorCloseTimeSettings;
